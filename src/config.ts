import type {
  RunConfig,
  Leader,
  MemberTemplate,
  Gear,
  Tactic,
  SegmentDefinition,
  EventDefinition,
  SegmentType,
  StatType,
} from "./types.js";
import type { RNG } from "./rng.js";

// ============================================================================
// LEADERS
// ============================================================================

const leaders: Leader[] = [
  {
    id: "warlord",
    name: "The Warlord",
    description: "A battle-hardened commander. Strong in combat, learns to lead.",
    baseStats: { combat: 5, survival: 2, social: 1, chaos: 2 },
    bonusHp: 15,
    baseMemberSlots: 3,
    tacticsPoolId: "military",
  },
  {
    id: "diplomat",
    name: "The Diplomat",
    description: "A silver-tongued negotiator. Excels socially, avoids direct fights.",
    baseStats: { combat: 2, survival: 2, social: 5, chaos: 1 },
    bonusHp: 10,
    baseMemberSlots: 4,
    tacticsPoolId: "political",
  },
  {
    id: "ranger",
    name: "The Ranger",
    description: "A wilderness expert. Thrives in harsh conditions.",
    baseStats: { combat: 2, survival: 5, social: 1, chaos: 2 },
    bonusHp: 20,
    baseMemberSlots: 3,
    tacticsPoolId: "wilderness",
  },
  {
    id: "trickster",
    name: "The Trickster",
    description: "A chaotic wildcard. Unpredictable but resourceful.",
    baseStats: { combat: 2, survival: 2, social: 2, chaos: 5 },
    bonusHp: 12,
    baseMemberSlots: 3,
    tacticsPoolId: "tricks",
  },
  {
    id: "balanced",
    name: "The Wanderer",
    description: "A jack of all trades. Balanced but unremarkable.",
    baseStats: { combat: 2, survival: 2, social: 2, chaos: 2 },
    bonusHp: 20,
    baseMemberSlots: 4,
    tacticsPoolId: null,
  },
];

// ============================================================================
// MEMBER TEMPLATES
// ============================================================================

const memberTemplates: MemberTemplate[] = [
  // RANK 1 - Combat
  { id: "soldier", name: "Soldier", primaryStats: ["combat"], rank: 1, baseValue: 2, scaling: 1, description: "A trained warrior." },
  { id: "guard", name: "Guard", primaryStats: ["combat"], rank: 1, baseValue: 1, scaling: 2, description: "Defensive fighter, grows stronger." },
  
  // RANK 1 - Survival
  { id: "scout", name: "Scout", primaryStats: ["survival"], rank: 1, baseValue: 2, scaling: 1, description: "Quick and observant." },
  { id: "herbalist", name: "Herbalist", primaryStats: ["survival"], rank: 1, baseValue: 1, scaling: 2, description: "Knows the land's secrets." },
  
  // RANK 1 - Social
  { id: "bard", name: "Bard", primaryStats: ["social"], rank: 1, baseValue: 2, scaling: 1, description: "Charming entertainer." },
  { id: "merchant", name: "Merchant", primaryStats: ["social"], rank: 1, baseValue: 1, scaling: 2, description: "Shrewd negotiator." },
  
  // RANK 1 - Chaos
  { id: "gambler", name: "Gambler", primaryStats: ["chaos"], rank: 1, baseValue: 2, scaling: 1, description: "Lucky and reckless." },
  { id: "pickpocket", name: "Pickpocket", primaryStats: ["chaos"], rank: 1, baseValue: 1, scaling: 2, description: "Nimble fingers." },
  
  // RANK 2 - Combat
  { id: "knight", name: "Knight", primaryStats: ["combat"], rank: 2, baseValue: 3, scaling: 2, description: "Armored elite warrior." },
  { id: "berserker", name: "Berserker", primaryStats: ["combat"], rank: 2, baseValue: 4, scaling: 1, description: "Fury incarnate." },
  
  // RANK 2 - Survival
  { id: "tracker", name: "Tracker", primaryStats: ["survival"], rank: 2, baseValue: 3, scaling: 2, description: "Master of the wilds." },
  { id: "healer", name: "Healer", primaryStats: ["survival"], rank: 2, baseValue: 4, scaling: 1, description: "Keeps the fellowship alive." },
  
  // RANK 2 - Social
  { id: "noble", name: "Noble", primaryStats: ["social"], rank: 2, baseValue: 3, scaling: 2, description: "Born to lead." },
  { id: "spy", name: "Spy", primaryStats: ["social"], rank: 2, baseValue: 4, scaling: 1, description: "Gathers secrets." },
  
  // RANK 2 - Chaos
  { id: "alchemist", name: "Alchemist", primaryStats: ["chaos"], rank: 2, baseValue: 3, scaling: 2, description: "Explosive experiments." },
  { id: "saboteur", name: "Saboteur", primaryStats: ["chaos"], rank: 2, baseValue: 4, scaling: 1, description: "Breaks things expertly." },
  
  // RANK 3 - Combat
  { id: "champion", name: "Champion", primaryStats: ["combat"], rank: 3, baseValue: 5, scaling: 3, description: "Legendary fighter." },
  { id: "assassin", name: "Assassin", primaryStats: ["combat"], rank: 3, baseValue: 6, scaling: 2, description: "Silent death." },
  
  // RANK 3 - Survival
  { id: "druid", name: "Druid", primaryStats: ["survival"], rank: 3, baseValue: 5, scaling: 3, description: "One with nature." },
  { id: "pathfinder", name: "Pathfinder", primaryStats: ["survival"], rank: 3, baseValue: 6, scaling: 2, description: "Finds a way through anything." },
  
  // RANK 3 - Social
  { id: "ambassador", name: "Ambassador", primaryStats: ["social"], rank: 3, baseValue: 5, scaling: 3, description: "Master negotiator." },
  { id: "prophet", name: "Prophet", primaryStats: ["social"], rank: 3, baseValue: 6, scaling: 2, description: "Voice of inspiration." },
  
  // RANK 3 - Chaos
  { id: "wildmage", name: "Wild Mage", primaryStats: ["chaos"], rank: 3, baseValue: 5, scaling: 3, description: "Unpredictable magic." },
  { id: "anarchist", name: "Anarchist", primaryStats: ["chaos"], rank: 3, baseValue: 6, scaling: 2, description: "Order is overrated." },
];

// ============================================================================
// GEAR TEMPLATES
// ============================================================================

const gearTemplates: Gear[] = [
  { id: "extra_slot_1", type: "extra_slot", name: "Recruitment Banner", description: "+1 member slot", value: 1 },
  { id: "heal_small", type: "heal", name: "Healing Salve", description: "Restore 20 HP", value: 20 },
  { id: "heal_medium", type: "heal", name: "Healing Potion", description: "Restore 40 HP", value: 40 },
  { id: "auto_combat", type: "auto_success", name: "Battle Standard", description: "Auto-succeed next combat check", value: 1, statType: "combat" },
  { id: "auto_survival", type: "auto_success", name: "Survival Kit", description: "Auto-succeed next survival check", value: 1, statType: "survival" },
  { id: "auto_social", type: "auto_success", name: "Royal Seal", description: "Auto-succeed next social check", value: 1, statType: "social" },
  { id: "auto_chaos", type: "auto_success", name: "Lucky Charm", description: "Auto-succeed next chaos check", value: 1, statType: "chaos" },
];

// ============================================================================
// TACTIC TEMPLATES
// ============================================================================

const tacticTemplates: Tactic[] = [
  { id: "boost_combat_perm", type: "permanent_boost", name: "Combat Training", description: "Permanently boost a member's combat contribution by 5", value: 5, statType: "combat" },
  { id: "boost_survival_perm", type: "permanent_boost", name: "Wilderness Lore", description: "Permanently boost a member's survival contribution by 5", value: 5, statType: "survival" },
  { id: "boost_social_perm", type: "permanent_boost", name: "Etiquette Lessons", description: "Permanently boost a member's social contribution by 5", value: 5, statType: "social" },
  { id: "boost_chaos_perm", type: "permanent_boost", name: "Chaos Theory", description: "Permanently boost a member's chaos contribution by 5", value: 5, statType: "chaos" },
  { id: "next_combat_boost", type: "next_segment_boost", name: "Battle Cry", description: "+100% combat for next segment", value: 100, statType: "combat" },
  { id: "next_survival_boost", type: "next_segment_boost", name: "Emergency Rations", description: "+100% survival for next segment", value: 100, statType: "survival" },
  { id: "next_social_boost", type: "next_segment_boost", name: "Diplomatic Pouch", description: "+100% social for next segment", value: 100, statType: "social" },
  { id: "next_chaos_boost", type: "next_segment_boost", name: "Wild Magic Surge", description: "+100% chaos for next segment", value: 100, statType: "chaos" },
  { id: "skip_event", type: "skip_event", name: "Evasive Maneuvers", description: "Skip the next event entirely", value: 1 },
];

// ============================================================================
// LEADER-SPECIFIC TACTIC POOLS
// ============================================================================

const tacticPools: Record<string, Tactic[]> = {
  // Military tactics for The Warlord - combat focus + social/survival support
  military: [
    { id: "shield_wall", type: "permanent_boost", name: "Shield Wall Drill", description: "Train in defensive combat tactics (+6 combat)", value: 6, statType: "combat" },
    { id: "flanking_maneuver", type: "next_segment_boost", name: "Flanking Maneuver", description: "+150% combat for next segment", value: 150, statType: "combat" },
    { id: "tactical_retreat", type: "skip_event", name: "Tactical Retreat", description: "Strategically avoid the next encounter", value: 1 },
    // Off-stat tactics to cover weaknesses
    { id: "intimidation", type: "permanent_boost", name: "Intimidation", description: "Your battle reputation precedes you (+5 social)", value: 5, statType: "social" },
    { id: "field_medicine", type: "permanent_boost", name: "Field Medicine", description: "Treat wounds like a soldier (+4 survival)", value: 4, statType: "survival" },
    { id: "commanders_presence", type: "next_segment_boost", name: "Commander's Presence", description: "Lead with authority (+100% social for next segment)", value: 100, statType: "social" },
  ],
  // Political tactics for The Diplomat - social focus + combat/survival support
  political: [
    { id: "court_intrigue", type: "permanent_boost", name: "Court Intrigue", description: "Master political maneuvering (+6 social)", value: 6, statType: "social" },
    { id: "silver_tongue", type: "next_segment_boost", name: "Silver Tongue", description: "+150% social for next segment", value: 150, statType: "social" },
    { id: "diplomatic_immunity", type: "skip_event", name: "Diplomatic Immunity", description: "Invoke protection to avoid confrontation", value: 1 },
    // Off-stat tactics to cover weaknesses
    { id: "hire_mercenaries", type: "permanent_boost", name: "Hire Mercenaries", description: "Gold speaks louder than swords (+5 combat)", value: 5, statType: "combat" },
    { id: "trade_routes", type: "permanent_boost", name: "Trade Routes", description: "Connections keep you supplied (+4 survival)", value: 4, statType: "survival" },
    { id: "bodyguard_detail", type: "next_segment_boost", name: "Bodyguard Detail", description: "Your allies protect you (+100% combat for next segment)", value: 100, statType: "combat" },
  ],
  // Wilderness tactics for The Ranger - survival focus + social/chaos support
  wilderness: [
    { id: "foraging_expertise", type: "permanent_boost", name: "Foraging Expertise", description: "Master living off the land (+6 survival)", value: 6, statType: "survival" },
    { id: "natures_blessing", type: "next_segment_boost", name: "Nature's Blessing", description: "+150% survival for next segment", value: 150, statType: "survival" },
    { id: "camouflage", type: "skip_event", name: "Camouflage", description: "Blend into surroundings to avoid danger", value: 1 },
    // Off-stat tactics to cover weaknesses
    { id: "trappers_cunning", type: "permanent_boost", name: "Trapper's Cunning", description: "The wild teaches unpredictability (+5 chaos)", value: 5, statType: "chaos" },
    { id: "rangers_tales", type: "permanent_boost", name: "Ranger's Tales", description: "Stories of adventure captivate (+4 social)", value: 4, statType: "social" },
    { id: "primal_instinct", type: "next_segment_boost", name: "Primal Instinct", description: "Trust your gut (+100% chaos for next segment)", value: 100, statType: "chaos" },
  ],
  // Tricks tactics for The Trickster - chaos focus + combat/survival support
  tricks: [
    { id: "chaos_gambit", type: "permanent_boost", name: "Chaos Gambit", description: "Embrace unpredictability (+6 chaos)", value: 6, statType: "chaos" },
    { id: "wild_card", type: "next_segment_boost", name: "Wild Card", description: "+150% chaos for next segment", value: 150, statType: "chaos" },
    { id: "smoke_and_mirrors", type: "skip_event", name: "Smoke and Mirrors", description: "Create a diversion to escape trouble", value: 1 },
    // Off-stat tactics to cover weaknesses
    { id: "dirty_fighting", type: "permanent_boost", name: "Dirty Fighting", description: "No rules in a street fight (+5 combat)", value: 5, statType: "combat" },
    { id: "scavenger", type: "permanent_boost", name: "Scavenger", description: "Find opportunity everywhere (+4 survival)", value: 4, statType: "survival" },
    { id: "misdirection", type: "next_segment_boost", name: "Misdirection", description: "Strike when they least expect (+100% combat for next segment)", value: 100, statType: "combat" },
  ],
};

// ============================================================================
// SEGMENT & EVENT GENERATION HELPERS
// ============================================================================

function createEvent(
  id: string,
  name: string,
  description: string,
  checkType: EventDefinition["checkType"],
  baseThreshold: number,
  segmentIndex: number
): EventDefinition {
  // Threshold scales gently with segment index
  // Early segments are easier, late segments are challenging but achievable
  const scaledThreshold = baseThreshold + Math.floor(segmentIndex * 0.5);
  
  const thresholds: EventDefinition["thresholds"] = {};
  
  if (checkType.includes("+")) {
    const [stat1, stat2] = checkType.split("+") as [StatType, StatType];
    thresholds[stat1] = scaledThreshold;
    thresholds[stat2] = scaledThreshold;
  } else {
    thresholds[checkType as StatType] = scaledThreshold;
  }
  
  return {
    id,
    name,
    description,
    checkType,
    thresholds,
    damage: {
      success: 0,
      mitigated: 3 + Math.floor(segmentIndex * 0.4),
      failure: 7 + segmentIndex,
    },
  };
}

// Event templates for variety
const eventTemplates: Record<StatType, Array<{ name: string; desc: string }>> = {
  combat: [
    { name: "Ambush!", desc: "Bandits attack from the shadows." },
    { name: "Monster Attack", desc: "A beast blocks your path." },
    { name: "Hostile Patrol", desc: "Armed soldiers demand you halt." },
    { name: "Bar Brawl", desc: "A tavern dispute turns violent." },
  ],
  survival: [
    { name: "Treacherous Path", desc: "The terrain becomes dangerous." },
    { name: "Sudden Storm", desc: "Weather turns hostile." },
    { name: "Food Shortage", desc: "Supplies are running low." },
    { name: "Disease Outbreak", desc: "Illness spreads through camp." },
  ],
  social: [
    { name: "Suspicious Guards", desc: "Officials question your intent." },
    { name: "Merchant Dispute", desc: "A deal goes sour." },
    { name: "Noble's Request", desc: "A lord demands your attention." },
    { name: "Crowd Unrest", desc: "Locals grow restless." },
  ],
  chaos: [
    { name: "Strange Occurrence", desc: "Reality bends around you." },
    { name: "Trickster's Game", desc: "Someone plays a dangerous prank." },
    { name: "Unstable Magic", desc: "Wild energy crackles in the air." },
    { name: "Fortune's Wheel", desc: "Fate itself seems to test you." },
  ],
};

// Available segment types for randomization
const singleStatSegments: SegmentType[] = ["COMBAT", "SURVIVAL", "SOCIAL", "CHAOS"];
const dualStatSegments: SegmentType[] = [
  "COMBAT/SURVIVAL",
  "COMBAT/SOCIAL", 
  "COMBAT/CHAOS",
  "SURVIVAL/SOCIAL",
  "SURVIVAL/CHAOS",
  "SOCIAL/CHAOS",
];

/**
 * Generate randomized segments for a run
 * - Early segments (1-4): mostly single stat challenges
 * - Mid segments (5-7): mix of single and dual stat
 * - Late segments (8-10): mostly dual stat challenges
 */
export function generateSegments(rng: RNG): SegmentDefinition[] {
  const segments: SegmentDefinition[] = [];
  
  for (let i = 1; i <= 10; i++) {
    // Determine segment type based on difficulty tier
    let segmentType: SegmentType;
    
    if (i <= 4) {
      // Early: 80% single, 20% dual
      segmentType = rng.nextFloat() < 0.8 
        ? rng.pick(singleStatSegments)
        : rng.pick(dualStatSegments);
    } else if (i <= 7) {
      // Mid: 50% single, 50% dual
      segmentType = rng.nextFloat() < 0.5
        ? rng.pick(singleStatSegments)
        : rng.pick(dualStatSegments);
    } else {
      // Late: 20% single, 80% dual
      segmentType = rng.nextFloat() < 0.2
        ? rng.pick(singleStatSegments)
        : rng.pick(dualStatSegments);
    }
    
    const events: EventDefinition[] = [];
    
    // Parse segment type to get relevant stats
    const stats = segmentType.includes("/")
      ? (segmentType.split("/").map(s => s.toLowerCase()) as StatType[])
      : [segmentType.toLowerCase() as StatType];
    
    // Generate 3 events per segment
    for (let e = 0; e < 3; e++) {
      let checkType: EventDefinition["checkType"];
      let eventStat: StatType;
      
      if (stats.length === 2) {
        // Dual-stat segment: randomize each event's check type
        const checkOptions: EventDefinition["checkType"][] = [
          stats[0],
          stats[1],
          `${stats[0]}+${stats[1]}` as EventDefinition["checkType"],
        ];
        checkType = rng.pick(checkOptions);
        // Pick event template based on primary stat used
        eventStat = checkType.includes("+") ? stats[0] : checkType as StatType;
      } else {
        // Single-stat segment: all events use that stat
        checkType = stats[0];
        eventStat = stats[0];
      }
      
      const template = rng.pick(eventTemplates[eventStat]);
      
      events.push(createEvent(
        `seg${i}_event${e + 1}`,
        template.name,
        template.desc,
        checkType,
        3 + e, // Base threshold increases per event in segment
        i
      ));
    }
    
    segments.push({
      index: i,
      type: segmentType,
      events,
    });
  }
  
  return segments;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const defaultConfig: RunConfig = {
  baseHp: 135,
  baseMemberSlots: 4,
  leaders,
  memberTemplates,
  gearTemplates,
  tacticTemplates,
  tacticPools,
  segments: [], // Segments are generated per-run with RNG in createRun()
  startingMemberIds: [], // No free members - player drafts before Segment 1
  healAmount: 15,
  autoSuccessValue: 100, // High value ensures success
  permanentBoostValue: 5,
  nextSegmentBoostPercent: 100,
};

// Helper to get config
export function getDefaultConfig(): RunConfig {
  return { ...defaultConfig };
}

