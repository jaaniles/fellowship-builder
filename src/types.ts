import { z } from "zod";

// ============================================================================
// STAT TYPES
// ============================================================================

export const StatTypeSchema = z.enum(["combat", "survival", "social", "chaos"]);
export type StatType = z.infer<typeof StatTypeSchema>;

export const StatsSchema = z.object({
  combat: z.number(),
  survival: z.number(),
  social: z.number(),
  chaos: z.number(),
});
export type Stats = z.infer<typeof StatsSchema>;

// ============================================================================
// MEMBER
// ============================================================================

export const MemberRankSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type MemberRank = z.infer<typeof MemberRankSchema>;

export const MemberTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  primaryStats: z.array(StatTypeSchema).min(1),
  rank: MemberRankSchema,
  baseValue: z.number(),
  scaling: z.number(),
  description: z.string(),
});
export type MemberTemplate = z.infer<typeof MemberTemplateSchema>;

export const MemberInstanceSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  name: z.string(),
  primaryStats: z.array(StatTypeSchema).min(1),
  rank: MemberRankSchema,
  baseValue: z.number(),
  scaling: z.number(),
  level: z.number(),
});
export type MemberInstance = z.infer<typeof MemberInstanceSchema>;

// ============================================================================
// LEADER
// ============================================================================

export const LeaderSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  baseStats: StatsSchema.partial(),
  bonusHp: z.number(),
  baseMemberSlots: z.number(),
  tacticsPoolId: z.string().nullable(),
});
export type Leader = z.infer<typeof LeaderSchema>;

// ============================================================================
// GEAR
// ============================================================================

export const GearTypeSchema = z.enum(["extra_slot", "auto_success", "heal"]);
export type GearType = z.infer<typeof GearTypeSchema>;

export const GearSchema = z.object({
  id: z.string(),
  type: GearTypeSchema,
  name: z.string(),
  description: z.string(),
  value: z.number(), // healAmount, or statType index for auto_success
  statType: StatTypeSchema.optional(), // for auto_success tokens
});
export type Gear = z.infer<typeof GearSchema>;

export const GearInstanceSchema = GearSchema.extend({
  instanceId: z.string(),
  used: z.boolean(),
});
export type GearInstance = z.infer<typeof GearInstanceSchema>;

// ============================================================================
// TACTIC
// ============================================================================

export const TacticTypeSchema = z.enum(["permanent_boost", "next_segment_boost", "skip_event"]);
export type TacticType = z.infer<typeof TacticTypeSchema>;

export const TacticSchema = z.object({
  id: z.string(),
  type: TacticTypeSchema,
  name: z.string(),
  description: z.string(),
  value: z.number(), // boost amount or percentage
  statType: StatTypeSchema.optional(), // which stat to boost
  targetMemberId: z.string().optional(), // for permanent_boost targeting a member
});
export type Tactic = z.infer<typeof TacticSchema>;

export const TacticInstanceSchema = TacticSchema.extend({
  instanceId: z.string(),
  expiresAfterSegment: z.number().optional(), // segment index after which it expires
  used: z.boolean(),
});
export type TacticInstance = z.infer<typeof TacticInstanceSchema>;

// ============================================================================
// SEGMENT & EVENT
// ============================================================================

export const SegmentTypeSchema = z.enum([
  "COMBAT",
  "SURVIVAL",
  "SOCIAL",
  "CHAOS",
  "COMBAT/SURVIVAL",
  "COMBAT/SOCIAL",
  "COMBAT/CHAOS",
  "SURVIVAL/SOCIAL",
  "SURVIVAL/CHAOS",
  "SOCIAL/CHAOS",
]);
export type SegmentType = z.infer<typeof SegmentTypeSchema>;

export const EventCheckTypeSchema = z.union([
  StatTypeSchema,
  z.enum([
    "combat+survival",
    "combat+social",
    "combat+chaos",
    "survival+social",
    "survival+chaos",
    "social+chaos",
  ]),
]);
export type EventCheckType = z.infer<typeof EventCheckTypeSchema>;

export const EventOutcomeSchema = z.enum(["SUCCESS", "MITIGATED_FAILURE", "FAILURE"]);
export type EventOutcome = z.infer<typeof EventOutcomeSchema>;

export const EventDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  checkType: EventCheckTypeSchema,
  thresholds: z.object({
    combat: z.number().optional(),
    survival: z.number().optional(),
    social: z.number().optional(),
    chaos: z.number().optional(),
  }),
  damage: z.object({
    success: z.number(),
    mitigated: z.number(),
    failure: z.number(),
  }),
});
export type EventDefinition = z.infer<typeof EventDefinitionSchema>;

export const SegmentDefinitionSchema = z.object({
  index: z.number().min(1).max(10),
  type: SegmentTypeSchema,
  events: z.array(EventDefinitionSchema).length(3),
});
export type SegmentDefinition = z.infer<typeof SegmentDefinitionSchema>;

// ============================================================================
// RUN STATE
// ============================================================================

export const RunStateSchema = z.object({
  leaderId: z.string(),
  leader: LeaderSchema,
  hp: z.number(),
  maxHp: z.number(),
  stats: StatsSchema,
  members: z.array(MemberInstanceSchema),
  memberSlots: z.number(),
  segmentIndex: z.number(),
  segments: z.array(SegmentDefinitionSchema), // Run-specific randomized segments
  gear: z.array(GearInstanceSchema),
  tactics: z.array(TacticInstanceSchema),
  permanentBoosts: z.record(z.string(), z.record(z.string(), z.number())), // memberId -> statType -> bonus amount
  rngSeed: z.string(),
  eventLog: z.array(z.string()),
  skipNextEvent: z.boolean(),
});
export type RunState = z.infer<typeof RunStateSchema>;

// ============================================================================
// DRAFT OPTIONS
// ============================================================================

export const DraftOptionTypeSchema = z.enum(["member", "gear", "tactic"]);
export type DraftOptionType = z.infer<typeof DraftOptionTypeSchema>;

export const DraftOptionSchema = z.object({
  type: DraftOptionTypeSchema,
  description: z.string(),
  payload: z.union([MemberTemplateSchema, GearSchema, TacticSchema]),
});
export type DraftOption = z.infer<typeof DraftOptionSchema>;

// ============================================================================
// RUN CONFIG
// ============================================================================

export const RunConfigSchema = z.object({
  baseHp: z.number(),
  baseMemberSlots: z.number(),
  leaders: z.array(LeaderSchema),
  memberTemplates: z.array(MemberTemplateSchema),
  gearTemplates: z.array(GearSchema),
  tacticTemplates: z.array(TacticSchema),
  tacticPools: z.record(z.string(), z.array(TacticSchema)),
  segments: z.array(SegmentDefinitionSchema),
  startingMemberIds: z.array(z.string()),
  healAmount: z.number(),
  autoSuccessValue: z.number(),
  permanentBoostValue: z.number(),
  nextSegmentBoostPercent: z.number(),
});
export type RunConfig = z.infer<typeof RunConfigSchema>;

// ============================================================================
// BOT TYPES
// ============================================================================

export interface BotStrategy {
  chooseDraft(
    runState: RunState,
    draftOptions: DraftOption[],
    segmentIndex: number
  ): number; // returns 0-3 (0 = skip)
}

export interface BotRunSummary {
  success: boolean;
  segmentReached: number;
  finalHp: number;
  finalStats: Stats;
  finalMembers: MemberInstance[];
  score: number;
  totalEventsSucceeded: number;
  totalEventsFailed: number;
  totalEventsMitigated: number;
}

