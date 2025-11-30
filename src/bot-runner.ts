import { getDefaultConfig } from "./config.js";
import {
  createRun,
  simulateSegment,
  getDraftOptions,
  applyDraftChoice,
  isRunOver,
  scoreRun,
  computeStats,
} from "./engine.js";
import { createRNG, type RNG } from "./rng.js";
import type {
  RunConfig,
  RunState,
  DraftOption,
  BotStrategy,
  BotRunSummary,
  Stats,
} from "./types.js";

// ============================================================================
// BOT STRATEGIES
// ============================================================================

/**
 * Always picks Member drafts when possible
 */
export const memberFocusStrategy: BotStrategy = {
  chooseDraft(runState: RunState, options: DraftOption[]): number {
    const memberIdx = options.findIndex(o => o.type === "member");
    if (memberIdx >= 0 && runState.members.length < runState.memberSlots) {
      return memberIdx + 1;
    }
    // Fall back to gear
    const gearIdx = options.findIndex(o => o.type === "gear");
    return gearIdx >= 0 ? gearIdx + 1 : 1;
  },
};

/**
 * Always picks Gear drafts
 */
export const gearFocusStrategy: BotStrategy = {
  chooseDraft(_runState: RunState, options: DraftOption[]): number {
    const gearIdx = options.findIndex(o => o.type === "gear");
    return gearIdx >= 0 ? gearIdx + 1 : 1;
  },
};

/**
 * Always picks Tactic drafts
 */
export const tacticFocusStrategy: BotStrategy = {
  chooseDraft(_runState: RunState, options: DraftOption[]): number {
    const tacticIdx = options.findIndex(o => o.type === "tactic");
    return tacticIdx >= 0 ? tacticIdx + 1 : 1;
  },
};

/**
 * Random choice each time
 */
export const randomStrategy: BotStrategy = {
  chooseDraft(_runState: RunState, _options: DraftOption[]): number {
    return Math.floor(Math.random() * 3) + 1;
  },
};

/**
 * Smart strategy that analyzes current stats and upcoming challenges
 */
export const smartStrategy: BotStrategy = {
  chooseDraft(runState: RunState, options: DraftOption[], segmentIndex: number): number {
    // Prioritize healing if HP is low
    const hpPercent = runState.hp / runState.maxHp;
    if (hpPercent < 0.4) {
      const healIdx = options.findIndex(
        o => o.type === "gear" && o.description.toLowerCase().includes("heal")
      );
      if (healIdx >= 0) return healIdx + 1;
    }

    // If we have room for members, prioritize recruitment
    if (runState.members.length < runState.memberSlots) {
      const memberIdx = options.findIndex(o => o.type === "member");
      if (memberIdx >= 0) return memberIdx + 1;
    }

    // Otherwise, look for slot expansion or tactics
    const slotIdx = options.findIndex(
      o => o.type === "gear" && o.description.toLowerCase().includes("slot")
    );
    if (slotIdx >= 0) return slotIdx + 1;

    // Default to tactics for boosts
    const tacticIdx = options.findIndex(o => o.type === "tactic");
    return tacticIdx >= 0 ? tacticIdx + 1 : 1;
  },
};

/**
 * Balanced strategy that rotates between options
 */
export const balancedStrategy: BotStrategy = {
  chooseDraft(runState: RunState, options: DraftOption[], segmentIndex: number): number {
    // Rotate based on segment
    const rotation = segmentIndex % 3;
    
    if (rotation === 0 && runState.members.length < runState.memberSlots) {
      return options.findIndex(o => o.type === "member") + 1;
    } else if (rotation === 1) {
      return options.findIndex(o => o.type === "gear") + 1;
    } else {
      return options.findIndex(o => o.type === "tactic") + 1;
    }
  },
};

/**
 * Worst case strategy - intentionally makes bad choices to validate game design
 * Skips drafts entirely to test minimum viable progression
 */
export const worstCaseStrategy: BotStrategy = {
  chooseDraft(_runState: RunState, _options: DraftOption[]): number {
    // Skip all drafts - the truly worst choice
    return 0;
  },
};

/**
 * Upgrade Heavy strategy - fills slots quickly then spams member picks for level upgrades
 * Tests if stacking member levels beats stat diversity
 */
export const upgradeHeavyStrategy: BotStrategy = {
  chooseDraft(runState: RunState, options: DraftOption[]): number {
    // Always pick members - either for recruitment or upgrades
    const memberIdx = options.findIndex(o => o.type === "member");
    if (memberIdx >= 0) return memberIdx + 1;
    
    // Fallback to tactics for boosts
    const tacticIdx = options.findIndex(o => o.type === "tactic");
    return tacticIdx >= 0 ? tacticIdx + 1 : 1;
  },
};

/**
 * Leader Synergy strategy - heavily favors tactics when leader has a tactic pool
 * Leverages the stronger +6/+150% leader-specific tactics
 */
export const leaderSynergyStrategy: BotStrategy = {
  chooseDraft(runState: RunState, options: DraftOption[]): number {
    const hasTacticPool = runState.leader.tacticsPoolId !== null;
    
    // Prioritize healing if HP is critical
    const hpPercent = runState.hp / runState.maxHp;
    if (hpPercent < 0.3) {
      const healIdx = options.findIndex(
        o => o.type === "gear" && o.description.toLowerCase().includes("heal")
      );
      if (healIdx >= 0) return healIdx + 1;
    }
    
    // If leader has tactic pool, heavily favor tactics (70% of the time after initial setup)
    if (hasTacticPool && runState.members.length >= 2) {
      const tacticIdx = options.findIndex(o => o.type === "tactic");
      if (tacticIdx >= 0) return tacticIdx + 1;
    }
    
    // Build up members first
    if (runState.members.length < runState.memberSlots) {
      const memberIdx = options.findIndex(o => o.type === "member");
      if (memberIdx >= 0) return memberIdx + 1;
    }
    
    // Then tactics
    const tacticIdx = options.findIndex(o => o.type === "tactic");
    return tacticIdx >= 0 ? tacticIdx + 1 : 1;
  },
};

/**
 * Auto-Success Focus strategy - prioritizes auto-success token gear
 * Tests if guaranteed event wins outweigh stat building
 */
export const autoSuccessFocusStrategy: BotStrategy = {
  chooseDraft(runState: RunState, options: DraftOption[]): number {
    // Look for auto-success gear first
    const autoSuccessIdx = options.findIndex(
      o => o.type === "gear" && o.description.toLowerCase().includes("auto-succeed")
    );
    if (autoSuccessIdx >= 0) return autoSuccessIdx + 1;
    
    // Then healing if needed
    const hpPercent = runState.hp / runState.maxHp;
    if (hpPercent < 0.5) {
      const healIdx = options.findIndex(
        o => o.type === "gear" && o.description.toLowerCase().includes("heal")
      );
      if (healIdx >= 0) return healIdx + 1;
    }
    
    // Then members for slot filling
    if (runState.members.length < runState.memberSlots) {
      const memberIdx = options.findIndex(o => o.type === "member");
      if (memberIdx >= 0) return memberIdx + 1;
    }
    
    // Default to any gear
    const gearIdx = options.findIndex(o => o.type === "gear");
    return gearIdx >= 0 ? gearIdx + 1 : 1;
  },
};

/**
 * Adaptive Stat strategy - analyzes current stats and picks to shore up weakest
 * Aims for balanced stats to handle any segment type
 */
export const adaptiveStatStrategy: BotStrategy = {
  chooseDraft(runState: RunState, options: DraftOption[]): number {
    // Prioritize healing if HP is low
    const hpPercent = runState.hp / runState.maxHp;
    if (hpPercent < 0.4) {
      const healIdx = options.findIndex(
        o => o.type === "gear" && o.description.toLowerCase().includes("heal")
      );
      if (healIdx >= 0) return healIdx + 1;
    }
    
    // Find weakest stat
    const stats = runState.stats;
    const statEntries: Array<[string, number]> = [
      ["combat", stats.combat],
      ["survival", stats.survival],
      ["social", stats.social],
      ["chaos", stats.chaos],
    ];
    statEntries.sort((a, b) => a[1] - b[1]);
    const weakestStat = statEntries[0][0];
    
    // Look for member with matching primary stat
    if (runState.members.length < runState.memberSlots) {
      const memberIdx = options.findIndex(
        o => o.type === "member" && o.description.toLowerCase().includes(weakestStat)
      );
      if (memberIdx >= 0) return memberIdx + 1;
    }
    
    // Look for tactic that boosts weakest stat
    const tacticIdx = options.findIndex(
      o => o.type === "tactic" && o.description.toLowerCase().includes(weakestStat)
    );
    if (tacticIdx >= 0) return tacticIdx + 1;
    
    // Fallback: any member if slots available
    if (runState.members.length < runState.memberSlots) {
      const memberIdx = options.findIndex(o => o.type === "member");
      if (memberIdx >= 0) return memberIdx + 1;
    }
    
    // Otherwise any tactic
    const anyTacticIdx = options.findIndex(o => o.type === "tactic");
    return anyTacticIdx >= 0 ? anyTacticIdx + 1 : 1;
  },
};

/**
 * Solo Leader strategy - never picks members, stacks boosts on leader
 * Tests the "lone wolf" playstyle where leader trains themselves
 */
export const soloLeaderStrategy: BotStrategy = {
  chooseDraft(runState: RunState, options: DraftOption[]): number {
    // Prioritize healing if HP is low (solo = fragile)
    const hpPercent = runState.hp / runState.maxHp;
    if (hpPercent < 0.5) {
      const healIdx = options.findIndex(
        o => o.type === "gear" && o.description.toLowerCase().includes("heal")
      );
      if (healIdx >= 0) return healIdx + 1;
    }
    
    // Look for permanent boost tactics (these go to leader when no members)
    const permBoostIdx = options.findIndex(
      o => o.type === "tactic" && o.description.toLowerCase().includes("permanently")
    );
    if (permBoostIdx >= 0) return permBoostIdx + 1;
    
    // Look for auto-success tokens (guaranteed wins for weak stats)
    const autoSuccessIdx = options.findIndex(
      o => o.type === "gear" && o.description.toLowerCase().includes("auto-succeed")
    );
    if (autoSuccessIdx >= 0) return autoSuccessIdx + 1;
    
    // Any other tactic (next segment boosts, skip event)
    const tacticIdx = options.findIndex(o => o.type === "tactic");
    if (tacticIdx >= 0) return tacticIdx + 1;
    
    // Fallback to any gear (never pick members!)
    const gearIdx = options.findIndex(o => o.type === "gear");
    return gearIdx >= 0 ? gearIdx + 1 : 0; // Skip if only member option
  },
};

// ============================================================================
// BOT RUNNER
// ============================================================================

/**
 * Run a complete game with the specified bot strategy
 */
export function runBot(
  config: RunConfig,
  leaderId: string,
  strategy: BotStrategy,
  rngSeed: string | number
): BotRunSummary {
  const rng = createRNG(rngSeed);
  let runState = createRun(config, leaderId, rngSeed);

  // Initial draft phase before Segment 1 - 3 picks to prepare
  for (let i = 0; i < 3; i++) {
    const initialOptions = getDraftOptions(runState, config, rng);
    const initialChoice = strategy.chooseDraft(runState, initialOptions, 0);
    runState = applyDraftChoice(runState, initialChoice, initialOptions, rng);
    runState.stats = computeStats(runState, config);
  }

  let successes = 0;
  let mitigated = 0;
  let failures = 0;

  // Main game loop
  while (!isRunOver(runState)) {
    // Simulate segment
    const result = simulateSegment(runState, config, rng);
    runState = result.runState;

    // Count outcomes from log (simple parsing)
    for (const line of result.segmentLog) {
      if (line.includes("✅ Result: SUCCESS")) successes++;
      if (line.includes("⚠️ Result: MITIGATED_FAILURE")) mitigated++;
      if (line.includes("❌ Result: FAILURE")) failures++;
    }

    // Check for death
    if (runState.hp <= 0) break;

    // Draft phase
    if (runState.segmentIndex <= 10) {
      const options = getDraftOptions(runState, config, rng);
      const choice = strategy.chooseDraft(runState, options, runState.segmentIndex);
      runState = applyDraftChoice(runState, choice, options, rng);
      runState.stats = computeStats(runState, config);
    }
  }

  const score = scoreRun(runState, config);
  const success = runState.hp > 0 && runState.segmentIndex > 10;

  return {
    success,
    segmentReached: Math.min(runState.segmentIndex, 10),
    finalHp: runState.hp,
    finalStats: { ...runState.stats },
    finalMembers: [...runState.members],
    score,
    totalEventsSucceeded: successes,
    totalEventsFailed: failures,
    totalEventsMitigated: mitigated,
  };
}

/**
 * Run multiple bot games and aggregate statistics
 */
export function runBotBatch(
  config: RunConfig,
  leaderId: string,
  strategy: BotStrategy,
  numRuns: number,
  baseSeed: string = "batch"
): {
  runs: BotRunSummary[];
  winRate: number;
  avgScore: number;
  avgSegmentReached: number;
  avgFinalHp: number;
  avgStats: Stats;
} {
  const runs: BotRunSummary[] = [];

  for (let i = 0; i < numRuns; i++) {
    const seed = `${baseSeed}_${i}`;
    const summary = runBot(config, leaderId, strategy, seed);
    runs.push(summary);
  }

  const wins = runs.filter(r => r.success).length;
  const totalScore = runs.reduce((sum, r) => sum + r.score, 0);
  const totalSegments = runs.reduce((sum, r) => sum + r.segmentReached, 0);
  const totalHp = runs.reduce((sum, r) => sum + r.finalHp, 0);

  const avgStats: Stats = {
    combat: runs.reduce((sum, r) => sum + r.finalStats.combat, 0) / numRuns,
    survival: runs.reduce((sum, r) => sum + r.finalStats.survival, 0) / numRuns,
    social: runs.reduce((sum, r) => sum + r.finalStats.social, 0) / numRuns,
    chaos: runs.reduce((sum, r) => sum + r.finalStats.chaos, 0) / numRuns,
  };

  return {
    runs,
    winRate: wins / numRuns,
    avgScore: totalScore / numRuns,
    avgSegmentReached: totalSegments / numRuns,
    avgFinalHp: totalHp / numRuns,
    avgStats,
  };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

function printResults(
  leaderName: string,
  strategyName: string,
  results: ReturnType<typeof runBotBatch>
): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊 Bot Results: ${leaderName} with ${strategyName}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Runs: ${results.runs.length}`);
  console.log(`  Win Rate: ${(results.winRate * 100).toFixed(1)}%`);
  console.log(`  Avg Score: ${results.avgScore.toFixed(0)}`);
  console.log(`  Avg Segments Reached: ${results.avgSegmentReached.toFixed(1)}/10`);
  console.log(`  Avg Final HP: ${results.avgFinalHp.toFixed(1)}`);
  console.log(`\n  Avg Final Stats:`);
  console.log(`    Combat: ${results.avgStats.combat.toFixed(1)}`);
  console.log(`    Survival: ${results.avgStats.survival.toFixed(1)}`);
  console.log(`    Social: ${results.avgStats.social.toFixed(1)}`);
  console.log(`    Chaos: ${results.avgStats.chaos.toFixed(1)}`);
}

async function main(): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   FELLOWSHIP BUILDER                          ║
║                   Bot Runner & Balancer                       ║
╚═══════════════════════════════════════════════════════════════╝
`);

  const config = getDefaultConfig();
  const numRuns = 100;

  const strategies: Array<[string, BotStrategy]> = [
    ["Member Focus", memberFocusStrategy],
    ["Gear Focus", gearFocusStrategy],
    ["Tactic Focus", tacticFocusStrategy],
    ["Smart", smartStrategy],
    ["Balanced", balancedStrategy],
    ["Upgrade Heavy", upgradeHeavyStrategy],
    ["Leader Synergy", leaderSynergyStrategy],
    ["Auto-Success", autoSuccessFocusStrategy],
    ["Adaptive Stat", adaptiveStatStrategy],
    ["Solo Leader", soloLeaderStrategy],
    ["Worst Case", worstCaseStrategy],
  ];

  console.log(`Running ${numRuns} simulations per leader/strategy combination...\n`);

  const allResults: Array<{
    leader: string;
    strategy: string;
    winRate: number;
    avgScore: number;
  }> = [];

  for (const leader of config.leaders) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`👑 Testing Leader: ${leader.name}`);
    console.log(`${"─".repeat(60)}`);

    for (const [strategyName, strategy] of strategies) {
      const results = runBotBatch(config, leader.id, strategy, numRuns, `${leader.id}_${strategyName}`);
      printResults(leader.name, strategyName, results);
      
      allResults.push({
        leader: leader.name,
        strategy: strategyName,
        winRate: results.winRate,
        avgScore: results.avgScore,
      });
    }
  }

  // Summary table
  console.log(`\n\n${"═".repeat(80)}`);
  console.log(`📈 SUMMARY TABLE`);
  console.log(`${"═".repeat(80)}`);
  console.log(`\n${"Leader".padEnd(20)} | ${"Strategy".padEnd(15)} | ${"Win Rate".padEnd(10)} | Avg Score`);
  console.log(`${"─".repeat(20)} | ${"─".repeat(15)} | ${"─".repeat(10)} | ${"─".repeat(10)}`);

  // Sort by win rate
  allResults.sort((a, b) => b.winRate - a.winRate);

  for (const result of allResults) {
    const winPct = `${(result.winRate * 100).toFixed(1)}%`;
    console.log(
      `${result.leader.padEnd(20)} | ${result.strategy.padEnd(15)} | ${winPct.padEnd(10)} | ${result.avgScore.toFixed(0)}`
    );
  }

  console.log(`\n${"═".repeat(80)}`);
  console.log(`\n✅ Bot testing complete!`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

