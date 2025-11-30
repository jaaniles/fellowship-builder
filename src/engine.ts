import type {
  RunConfig,
  RunState,
  Stats,
  MemberInstance,
  MemberTemplate,
  DraftOption,
  EventDefinition,
  EventOutcome,
  GearInstance,
  TacticInstance,
  StatType,
  MemberRank,
} from "./types.js";
import { type RNG, createRNG } from "./rng.js";
import { generateSegments } from "./config.js";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for instances
 */
function generateId(prefix: string, rng: RNG): string {
  return `${prefix}_${Math.floor(rng.nextFloat() * 1000000)}`;
}

/**
 * Check if a stat is a primary stat for a member
 */
export function isPrimaryStat(member: MemberInstance, statType: StatType): boolean {
  return member.primaryStats.includes(statType);
}

/**
 * Calculate a member's total contribution for their first primary stat
 */
export function getMemberContribution(member: MemberInstance, permanentBoosts: Record<string, Record<string, number>>): number {
  const memberBoosts = permanentBoosts[member.id] || {};
  const firstPrimaryStat = member.primaryStats[0];
  const primaryBoost = memberBoosts[firstPrimaryStat] || 0;
  return member.baseValue + member.scaling * (member.level - 1) + primaryBoost;
}

/**
 * Get all stat contributions for a member (primary stats + any boosted stats)
 */
export function getMemberAllStats(member: MemberInstance, permanentBoosts: Record<string, Record<string, number>>): Partial<Stats> {
  const memberBoosts = permanentBoosts[member.id] || {};
  const result: Partial<Stats> = {};
  
  // Base contribution from member level (distributed across all primary stats)
  const baseContribution = member.baseValue + member.scaling * (member.level - 1);
  
  // Add base contribution to each primary stat
  for (const primaryStat of member.primaryStats) {
    const boost = memberBoosts[primaryStat] || 0;
    result[primaryStat] = baseContribution + boost;
  }
  
  // Any additional boosted stats (secondary stats only get boost value)
  for (const [statType, boost] of Object.entries(memberBoosts)) {
    if (!member.primaryStats.includes(statType as StatType) && boost > 0) {
      result[statType as StatType] = boost;
    }
  }
  
  return result;
}

/**
 * Compute fellowship stats from members, leader, and modifiers
 */
export function computeStats(
  runState: RunState,
  config: RunConfig,
  temporaryBoosts?: Partial<Stats>
): Stats {
  const stats: Stats = {
    combat: 0,
    survival: 0,
    social: 0,
    chaos: 0,
  };

  // Add leader base stats
  const leader = runState.leader;
  stats.combat += leader.baseStats.combat || 0;
  stats.survival += leader.baseStats.survival || 0;
  stats.social += leader.baseStats.social || 0;
  stats.chaos += leader.baseStats.chaos || 0;

  // Add member contributions (primary stat + any boosted stats)
  for (const member of runState.members) {
    const memberStats = getMemberAllStats(member, runState.permanentBoosts);
    for (const [statType, value] of Object.entries(memberStats)) {
      if (value) {
        stats[statType as StatType] += value;
      }
    }
  }

  // Apply temporary boosts (percentage-based)
  if (temporaryBoosts) {
    for (const [stat, boost] of Object.entries(temporaryBoosts)) {
      if (boost) {
        stats[stat as StatType] = Math.floor(stats[stat as StatType] * (1 + boost / 100));
      }
    }
  }

  return stats;
}

/**
 * Get temporary stat boosts from active tactics
 */
function getTemporaryBoosts(runState: RunState): Partial<Stats> {
  const boosts: Partial<Stats> = {};
  
  for (const tactic of runState.tactics) {
    if (
      tactic.type === "next_segment_boost" &&
      !tactic.used &&
      tactic.expiresAfterSegment === runState.segmentIndex &&
      tactic.statType
    ) {
      boosts[tactic.statType] = (boosts[tactic.statType] || 0) + tactic.value;
    }
  }
  
  return boosts;
}

/**
 * Check if an auto-success token is available for a stat
 */
function hasAutoSuccess(runState: RunState, statType: StatType): GearInstance | undefined {
  return runState.gear.find(
    g => g.type === "auto_success" && g.statType === statType && !g.used
  );
}

/**
 * Parse check type into individual stats
 */
function parseCheckType(checkType: EventDefinition["checkType"]): StatType[] {
  if (checkType.includes("+")) {
    return checkType.split("+") as StatType[];
  }
  return [checkType as StatType];
}

// ============================================================================
// CORE ENGINE FUNCTIONS
// ============================================================================

/**
 * Create a new run with the specified leader
 */
export function createRun(
  config: RunConfig,
  leaderId: string,
  rngSeed: string | number
): RunState {
  const leader = config.leaders.find(l => l.id === leaderId);
  if (!leader) {
    throw new Error(`Leader not found: ${leaderId}`);
  }

  const rng = createRNG(rngSeed);

  // Create starting members
  const members: MemberInstance[] = [];
  for (const templateId of config.startingMemberIds) {
    const template = config.memberTemplates.find(m => m.id === templateId);
    if (template) {
      members.push({
        id: generateId("member", rng),
        templateId: template.id,
        name: template.name,
        primaryStats: [...template.primaryStats],
        rank: template.rank,
        baseValue: template.baseValue,
        scaling: template.scaling,
        level: 1,
      });
    }
  }

  const maxHp = config.baseHp + leader.bonusHp;

  // Generate randomized segments for this run
  const segments = generateSegments(rng);

  const runState: RunState = {
    leaderId: leader.id,
    leader,
    hp: maxHp,
    maxHp,
    stats: { combat: 0, survival: 0, social: 0, chaos: 0 },
    members,
    memberSlots: leader.baseMemberSlots,
    segmentIndex: 1,
    segments,
    gear: [],
    tactics: [],
    permanentBoosts: {},
    rngSeed: String(rngSeed),
    eventLog: [],
    skipNextEvent: false,
  };

  // Compute initial stats
  runState.stats = computeStats(runState, config);

  return runState;
}

/**
 * Resolve a single event and return the outcome
 */
export function resolveEvent(
  runState: RunState,
  event: EventDefinition,
  stats: Stats,
  rng: RNG
): { outcome: EventOutcome; log: string[]; damage: number; runState: RunState } {
  const log: string[] = [];
  let updatedState = { ...runState };

  // Check if we should skip this event
  if (runState.skipNextEvent) {
    updatedState.skipNextEvent = false;
    log.push(`  ⏭️  SKIPPED: ${event.name} (Evasive Maneuvers used)`);
    return { outcome: "SUCCESS", log, damage: 0, runState: updatedState };
  }

  log.push(`  📋 ${event.name}: ${event.description}`);

  const checkStats = parseCheckType(event.checkType);
  const results: Array<{ stat: StatType; value: number; threshold: number; result: "pass" | "tie" | "fail" }> = [];

  for (const stat of checkStats) {
    const threshold = event.thresholds[stat] || 0;
    let value = stats[stat];

    // Check for auto-success token
    const autoSuccessGear = hasAutoSuccess(updatedState, stat);
    if (autoSuccessGear) {
      log.push(`    🎯 ${autoSuccessGear.name} activated! Auto-success on ${stat} check.`);
      // Mark gear as used
      updatedState = {
        ...updatedState,
        gear: updatedState.gear.map(g =>
          g.instanceId === autoSuccessGear.instanceId ? { ...g, used: true } : g
        ),
      };
      value = threshold + 10; // Guaranteed pass
    }

    let result: "pass" | "tie" | "fail";
    if (value > threshold) {
      result = "pass";
    } else if (value === threshold) {
      result = "tie";
    } else {
      result = "fail";
    }

    results.push({ stat, value, threshold, result });
    log.push(`    ${stat.toUpperCase()}: ${value} vs ${threshold} → ${result.toUpperCase()}`);
  }

  // Determine overall outcome
  let outcome: EventOutcome;
  if (results.some(r => r.result === "fail")) {
    outcome = "FAILURE";
  } else if (results.some(r => r.result === "tie")) {
    outcome = "MITIGATED_FAILURE";
  } else {
    outcome = "SUCCESS";
  }

  const damage = event.damage[outcome === "SUCCESS" ? "success" : outcome === "MITIGATED_FAILURE" ? "mitigated" : "failure"];

  const outcomeEmoji = outcome === "SUCCESS" ? "✅" : outcome === "MITIGATED_FAILURE" ? "⚠️" : "❌";
  log.push(`  ${outcomeEmoji} Result: ${outcome}${damage > 0 ? ` (-${damage} HP)` : ""}`);

  return { outcome, log, damage, runState: updatedState };
}

/**
 * Simulate a complete segment
 */
export function simulateSegment(
  runState: RunState,
  config: RunConfig,
  rng: RNG
): { runState: RunState; segmentLog: string[] } {
  const log: string[] = [];
  let state = { ...runState };

  const segment = state.segments.find(s => s.index === state.segmentIndex);
  if (!segment) {
    throw new Error(`Segment not found: ${state.segmentIndex}`);
  }

  log.push(`\n${"═".repeat(50)}`);
  log.push(`📍 SEGMENT ${segment.index}: ${segment.type}`);
  log.push(`${"═".repeat(50)}`);

  // Get temporary boosts from tactics
  const tempBoosts = getTemporaryBoosts(state);

  // Compute stats with temporary boosts
  const stats = computeStats(state, config, tempBoosts);
  state.stats = stats;

  log.push(`\n💪 Fellowship Stats: Combat ${stats.combat} | Survival ${stats.survival} | Social ${stats.social} | Chaos ${stats.chaos}`);
  log.push(`❤️  HP: ${state.hp}/${state.maxHp}`);

  if (Object.keys(tempBoosts).length > 0) {
    const boostStr = Object.entries(tempBoosts)
      .map(([stat, val]) => `${stat}+${val}%`)
      .join(", ");
    log.push(`✨ Active Boosts: ${boostStr}`);
  }

  log.push("");

  // Track outcomes for summary
  let successes = 0;
  let mitigated = 0;
  let failures = 0;
  let totalDamage = 0;

  // Process each event
  for (let i = 0; i < segment.events.length; i++) {
    const event = segment.events[i];
    log.push(`\n🎲 Event ${i + 1}/3:`);

    const result = resolveEvent(state, event, stats, rng);
    log.push(...result.log);
    state = result.runState;

    // Apply damage and track total
    totalDamage += result.damage;
    state.hp = Math.max(0, state.hp - result.damage);

    // Track outcomes
    if (result.outcome === "SUCCESS") successes++;
    else if (result.outcome === "MITIGATED_FAILURE") mitigated++;
    else failures++;

    // Check for death
    if (state.hp <= 0) {
      log.push(`\n💀 THE FELLOWSHIP HAS FALLEN!`);
      state.eventLog = [...state.eventLog, ...log];
      return { runState: state, segmentLog: log };
    }
  }

  // Segment survived - check if members level up (requires 2+ successes)
  log.push(`\n${"─".repeat(50)}`);
  log.push(`📊 Segment Summary: ${successes} Success | ${mitigated} Mitigated | ${failures} Failures`);
  log.push(`💔 Damage Taken: ${totalDamage} HP`);
  log.push(`❤️  HP remaining: ${state.hp}/${state.maxHp}`);

  if (successes >= 2) {
    // Capture old stats before level up
    const oldMemberStats: Map<string, { level: number; stats: Partial<Stats> }> = new Map();
    for (const member of state.members) {
      oldMemberStats.set(member.id, {
        level: member.level,
        stats: getMemberAllStats(member, state.permanentBoosts),
      });
    }

    // Level up all members
    state.members = state.members.map(m => ({ ...m, level: m.level + 1 }));
    log.push(`\n⬆️  All members leveled up! (${successes}/3 successes)`);

    // Show member levels with stat gains
    for (const member of state.members) {
      const oldData = oldMemberStats.get(member.id);
      const newStats = getMemberAllStats(member, state.permanentBoosts);
      
      // Build display showing each stat with gain (primary stats first, then secondary)
      const statsDisplay: string[] = [];
      
      // Primary stats (these scale with level)
      for (const stat of member.primaryStats) {
        const oldVal = oldData?.stats[stat] || 0;
        const newVal = newStats[stat] || 0;
        const gain = newVal - oldVal;
        statsDisplay.push(`${stat} ${newVal} (+${gain})`);
      }
      
      // Secondary stats with boosts (these don't scale, but should still be shown)
      for (const [stat, val] of Object.entries(newStats)) {
        if (!member.primaryStats.includes(stat as StatType) && val && val > 0) {
          statsDisplay.push(`${stat} ${val}`);
        }
      }
      
      log.push(`   ${member.name}: Lv${oldData?.level || 1} → Lv${member.level} | ${statsDisplay.join(", ")} | 📈 +${member.scaling}/lv`);
    }
  } else {
    log.push(`\n⚠️  Members did NOT level up (need 2+ successes, got ${successes})`);
  }

  // Clear expired tactics
  state.tactics = state.tactics.map(t => 
    t.expiresAfterSegment === state.segmentIndex ? { ...t, used: true } : t
  );

  // Advance segment
  state.segmentIndex++;
  state.eventLog = [...state.eventLog, ...log];

  return { runState: state, segmentLog: log };
}

/**
 * Get draft options for the current state
 */
export function getDraftOptions(
  runState: RunState,
  config: RunConfig,
  rng: RNG
): DraftOption[] {
  const options: DraftOption[] = [];

  // Determine rank based on segment progress
  const rank: MemberRank = runState.segmentIndex <= 3 ? 1 : runState.segmentIndex <= 6 ? 2 : 3;

  // Option 1: Member
  const availableMembers = config.memberTemplates.filter(m => m.rank === rank);
  const memberTemplate = rng.pick(availableMembers);
  const primaryStatsDisplay = memberTemplate.primaryStats.join("/");
  options.push({
    type: "member",
    description: `Recruit ${memberTemplate.name} (${primaryStatsDisplay}, Rank ${memberTemplate.rank}, 📈 +${memberTemplate.scaling}/lv): ${memberTemplate.description}`,
    payload: memberTemplate,
  });

  // Option 2: Gear
  const gearTemplate = rng.pick(config.gearTemplates);
  options.push({
    type: "gear",
    description: `${gearTemplate.name}: ${gearTemplate.description}`,
    payload: gearTemplate,
  });

  // Option 3: Tactic - use leader-specific pool if available
  const leaderTacticsPoolId = runState.leader.tacticsPoolId;
  let availableTactics = config.tacticTemplates;
  
  if (leaderTacticsPoolId && config.tacticPools[leaderTacticsPoolId]) {
    // Combine leader-specific tactics with generic tactics
    availableTactics = [
      ...config.tacticPools[leaderTacticsPoolId],
      ...config.tacticTemplates,
    ];
  }
  
  const tacticTemplate = rng.pick(availableTactics);
  options.push({
    type: "tactic",
    description: `${tacticTemplate.name}: ${tacticTemplate.description}`,
    payload: tacticTemplate,
  });

  return options;
}

/**
 * Apply a draft choice to the run state
 */
export function applyDraftChoice(
  runState: RunState,
  choiceIndex: number,
  draftOptions: DraftOption[],
  rng: RNG
): RunState {
  if (choiceIndex < 1 || choiceIndex > 3) {
    return runState; // Skip or invalid choice
  }

  const option = draftOptions[choiceIndex - 1];
  let state = { ...runState };

  switch (option.type) {
    case "member": {
      const template = option.payload as MemberTemplate;
      
      if (state.members.length >= state.memberSlots) {
        // UPGRADE MODE: Find member with matching primary stat to train
        const matches = state.members.filter(m =>
          m.primaryStats.some(ps => template.primaryStats.includes(ps))
        );
        const target = matches.length > 0 ? rng.pick(matches) : rng.pick(state.members);
        
        // Create updated members array with the target leveled up
        state.members = state.members.map(m =>
          m.id === target.id ? { ...m, level: m.level + 1 } : m
        );
        state.stats = computeStats(state, {} as RunConfig);
        state.eventLog = [...state.eventLog, `⬆️ ${target.name} trained with ${template.name}! Now Level ${target.level + 1}`];
      } else {
        // Normal recruitment
        const newMember: MemberInstance = {
          id: generateId("member", rng),
          templateId: template.id,
          name: template.name,
          primaryStats: [...template.primaryStats],
          rank: template.rank,
          baseValue: template.baseValue,
          scaling: template.scaling,
          level: 1,
        };
        state.members = [...state.members, newMember];
        state.stats = computeStats(state, {} as RunConfig);
        state.eventLog = [...state.eventLog, `🧑 Recruited ${newMember.name}!`];
      }
      break;
    }

    case "gear": {
      const gear = option.payload as GearInstance;
      
      if (gear.type === "extra_slot") {
        state.memberSlots += 1;
        state.eventLog = [...state.eventLog, `📦 Gained ${gear.name}! Member slots: ${state.memberSlots}`];
      } else if (gear.type === "heal") {
        const healAmount = gear.value;
        const oldHp = state.hp;
        state.hp = Math.min(state.maxHp, state.hp + healAmount);
        state.eventLog = [...state.eventLog, `💊 Used ${gear.name}! HP: ${oldHp} → ${state.hp}`];
      } else if (gear.type === "auto_success") {
        const gearInstance: GearInstance = {
          ...gear,
          instanceId: generateId("gear", rng),
          used: false,
        };
        state.gear = [...state.gear, gearInstance];
        state.eventLog = [...state.eventLog, `🎯 Acquired ${gear.name}!`];
      }
      break;
    }

    case "tactic": {
      const tactic = option.payload as TacticInstance;

      if (tactic.type === "permanent_boost" && tactic.statType) {
        if (state.members.length > 0) {
          // Prioritize members who have the tactic's stat as a primary stat
          const primaryMatches = state.members.filter(m => 
            m.primaryStats.includes(tactic.statType!)
          );
          const target = primaryMatches.length > 0 
            ? rng.pick(primaryMatches) 
            : rng.pick(state.members);
          
          // Full value for primary stats, half (rounded down) for secondary stats
          const isPrimary = target.primaryStats.includes(tactic.statType);
          const boostValue = isPrimary ? tactic.value : Math.floor(tactic.value / 2);
          
          const existingBoosts = state.permanentBoosts[target.id] || {};
          const currentBoost = existingBoosts[tactic.statType] || 0;
          
          state.permanentBoosts = {
            ...state.permanentBoosts,
            [target.id]: {
              ...existingBoosts,
              [tactic.statType]: currentBoost + boostValue,
            },
          };
          
          const statLabel = isPrimary ? "" : ` (secondary: half effect)`;
          state.eventLog = [...state.eventLog, `📈 ${target.name} gained +${boostValue} ${tactic.statType}${statLabel}!`];
        } else {
          // No members - apply boost to leader's base stats
          state.leader = {
            ...state.leader,
            baseStats: {
              ...state.leader.baseStats,
              [tactic.statType]: (state.leader.baseStats[tactic.statType] || 0) + tactic.value,
            },
          };
          state.eventLog = [...state.eventLog, `📈 ${state.leader.name} trained in ${tactic.statType}! (+${tactic.value})`];
        }
      } else if (tactic.type === "next_segment_boost") {
        const tacticInstance: TacticInstance = {
          ...tactic,
          instanceId: generateId("tactic", rng),
          expiresAfterSegment: state.segmentIndex,
          used: false,
        };
        state.tactics = [...state.tactics, tacticInstance];
        state.eventLog = [...state.eventLog, `⚡ ${tactic.name} active for next segment!`];
      } else if (tactic.type === "skip_event") {
        state.skipNextEvent = true;
        state.eventLog = [...state.eventLog, `⏭️  Evasive Maneuvers ready! Next event will be skipped.`];
      }
      break;
    }
  }

  return state;
}

/**
 * Check if the run is over
 */
export function isRunOver(runState: RunState): boolean {
  return runState.hp <= 0 || runState.segmentIndex > 10;
}

/**
 * Calculate final score
 */
export function scoreRun(runState: RunState, config: RunConfig): number {
  const segmentScore = (runState.segmentIndex - 1) * 100; // Segments completed
  const hpScore = runState.hp * 2;
  const statsScore = runState.stats.combat + runState.stats.survival + runState.stats.social + runState.stats.chaos;
  const memberScore = runState.members.reduce((sum, m) => sum + m.level * 5, 0);
  const victoryBonus = runState.hp > 0 && runState.segmentIndex > 10 ? 500 : 0;

  return segmentScore + hpScore + statsScore + memberScore + victoryBonus;
}

/**
 * Get a summary of the current run state
 */
export function getRunSummary(runState: RunState): string {
  const lines: string[] = [];
  
  lines.push(`\n${"═".repeat(50)}`);
  lines.push(`📜 FELLOWSHIP STATUS`);
  lines.push(`${"═".repeat(50)}`);
  lines.push(`👑 Leader: ${runState.leader.name}`);
  lines.push(`❤️  HP: ${runState.hp}/${runState.maxHp}`);
  lines.push(`📍 Segment: ${runState.segmentIndex}/10`);
  lines.push(`\n💪 Stats:`);
  lines.push(`   Combat: ${runState.stats.combat}`);
  lines.push(`   Survival: ${runState.stats.survival}`);
  lines.push(`   Social: ${runState.stats.social}`);
  lines.push(`   Chaos: ${runState.stats.chaos}`);
  lines.push(`\n👥 Members (${runState.members.length}/${runState.memberSlots}):`);
  
  for (const member of runState.members) {
    const allStats = getMemberAllStats(member, runState.permanentBoosts);
    const statsDisplay = Object.entries(allStats)
      .filter(([_, val]) => val && val > 0)
      .map(([stat, val]) => `${stat} +${val}`)
      .join(", ");
    lines.push(`   ${member.name} Lv${member.level} (${statsDisplay}) 📈 +${member.scaling}/lv`);
  }

  if (runState.gear.filter(g => !g.used).length > 0) {
    lines.push(`\n🎒 Gear:`);
    for (const gear of runState.gear.filter(g => !g.used)) {
      lines.push(`   ${gear.name}`);
    }
  }

  return lines.join("\n");
}

