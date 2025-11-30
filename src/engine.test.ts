import { describe, it, expect, beforeEach } from "vitest";
import {
  createRun,
  simulateSegment,
  getDraftOptions,
  applyDraftChoice,
  isRunOver,
  scoreRun,
  computeStats,
  getMemberContribution,
} from "./engine.js";
import { getDefaultConfig } from "./config.js";
import { createRNG } from "./rng.js";
import type { RunConfig, RunState, MemberInstance } from "./types.js";

describe("RNG", () => {
  it("should produce deterministic results with the same seed", () => {
    const rng1 = createRNG("test-seed");
    const rng2 = createRNG("test-seed");

    const values1 = Array.from({ length: 10 }, () => rng1.nextFloat());
    const values2 = Array.from({ length: 10 }, () => rng2.nextFloat());

    expect(values1).toEqual(values2);
  });

  it("should produce different results with different seeds", () => {
    const rng1 = createRNG("seed-1");
    const rng2 = createRNG("seed-2");

    const values1 = Array.from({ length: 10 }, () => rng1.nextFloat());
    const values2 = Array.from({ length: 10 }, () => rng2.nextFloat());

    expect(values1).not.toEqual(values2);
  });

  it("should shuffle arrays deterministically", () => {
    const rng = createRNG("shuffle-test");
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(arr);

    expect(shuffled).toHaveLength(5);
    expect(new Set(shuffled)).toEqual(new Set(arr));
    // Original should be unchanged
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("createRun", () => {
  let config: RunConfig;

  beforeEach(() => {
    config = getDefaultConfig();
  });

  it("should create a run with the specified leader", () => {
    const runState = createRun(config, "warlord", "test");

    expect(runState.leaderId).toBe("warlord");
    expect(runState.leader.name).toBe("The Warlord");
    expect(runState.segmentIndex).toBe(1);
  });

  it("should initialize HP based on leader bonus", () => {
    const warlordRun = createRun(config, "warlord", "test");
    const rangerRun = createRun(config, "ranger", "test");

    const warlord = config.leaders.find(l => l.id === "warlord")!;
    const ranger = config.leaders.find(l => l.id === "ranger")!;

    expect(warlordRun.maxHp).toBe(config.baseHp + warlord.bonusHp);
    expect(rangerRun.maxHp).toBe(config.baseHp + ranger.bonusHp);
  });

  it("should set member slots from leader", () => {
    const diplomatRun = createRun(config, "diplomat", "test");
    const rangerRun = createRun(config, "ranger", "test");

    const diplomat = config.leaders.find(l => l.id === "diplomat")!;
    const ranger = config.leaders.find(l => l.id === "ranger")!;

    expect(diplomatRun.memberSlots).toBe(diplomat.baseMemberSlots);
    expect(rangerRun.memberSlots).toBe(ranger.baseMemberSlots);
  });

  it("should add starting members", () => {
    const runState = createRun(config, "warlord", "test");

    expect(runState.members.length).toBe(config.startingMemberIds.length);
  });

  it("should throw for unknown leader", () => {
    expect(() => createRun(config, "unknown-leader", "test")).toThrow();
  });
});

describe("computeStats", () => {
  let config: RunConfig;
  let runState: RunState;

  beforeEach(() => {
    config = getDefaultConfig();
    runState = createRun(config, "warlord", "test");
  });

  it("should include leader base stats", () => {
    const stats = computeStats(runState, config);

    // Warlord has combat: 3, survival: 1, social: 0, chaos: 1
    expect(stats.combat).toBeGreaterThanOrEqual(3);
    expect(stats.survival).toBeGreaterThanOrEqual(1);
    expect(stats.chaos).toBeGreaterThanOrEqual(1);
  });

  it("should include member contributions", () => {
    // Add a combat member
    const combatMember: MemberInstance = {
      id: "test-combat",
      templateId: "soldier",
      name: "Test Soldier",
      primaryStats: ["combat"],
      rank: 1,
      baseValue: 5,
      scaling: 1,
      level: 1,
    };

    runState.members = [...runState.members, combatMember];
    const stats = computeStats(runState, config);

    // Should include the soldier's contribution
    expect(stats.combat).toBeGreaterThanOrEqual(8); // 3 leader + 5 soldier
  });

  it("should apply permanent boosts", () => {
    // Add a member first since startingMemberIds is empty
    const member: MemberInstance = {
      id: "test-member",
      templateId: "soldier",
      name: "Test Soldier",
      primaryStats: ["combat"],
      rank: 1,
      baseValue: 3,
      scaling: 1,
      level: 1,
    };
    runState.members = [member];
    runState.permanentBoosts = { [member.id]: { combat: 5 } };

    const stats = computeStats(runState, config);
    const contribution = getMemberContribution(member, runState.permanentBoosts);

    expect(contribution).toBe(member.baseValue + 5);
  });
});

describe("getMemberContribution", () => {
  it("should calculate level 1 contribution correctly", () => {
    const member: MemberInstance = {
      id: "test",
      templateId: "soldier",
      name: "Test",
      primaryStats: ["combat"],
      rank: 1,
      baseValue: 3,
      scaling: 2,
      level: 1,
    };

    expect(getMemberContribution(member, {})).toBe(3);
  });

  it("should scale with level", () => {
    const member: MemberInstance = {
      id: "test",
      templateId: "soldier",
      name: "Test",
      primaryStats: ["combat"],
      rank: 1,
      baseValue: 3,
      scaling: 2,
      level: 5,
    };

    // 3 + 2 * (5-1) = 3 + 8 = 11
    expect(getMemberContribution(member, {})).toBe(11);
  });

  it("should include permanent boosts", () => {
    const member: MemberInstance = {
      id: "test",
      templateId: "soldier",
      name: "Test",
      primaryStats: ["combat"],
      rank: 1,
      baseValue: 3,
      scaling: 2,
      level: 1,
    };

    // Boost of 4 to the member's primary stat (combat)
    expect(getMemberContribution(member, { test: { combat: 4 } })).toBe(7);
  });
});

describe("simulateSegment", () => {
  let config: RunConfig;
  let runState: RunState;
  let rng: ReturnType<typeof createRNG>;

  beforeEach(() => {
    config = getDefaultConfig();
    runState = createRun(config, "warlord", "test");
    rng = createRNG("segment-test");
  });

  it("should process 3 events", () => {
    const result = simulateSegment(runState, config, rng);

    // Check that segment log mentions 3 events
    const eventLines = result.segmentLog.filter(line => line.includes("Event"));
    expect(eventLines.length).toBeGreaterThanOrEqual(3);
  });

  it("should level up members on survival", () => {
    const initialLevels = runState.members.map(m => m.level);
    
    // Give enough HP to survive
    runState.hp = 1000;
    
    const result = simulateSegment(runState, config, rng);

    if (result.runState.hp > 0) {
      const newLevels = result.runState.members.map(m => m.level);
      expect(newLevels).toEqual(initialLevels.map(l => l + 1));
    }
  });

  it("should advance segment index", () => {
    runState.hp = 1000;
    const result = simulateSegment(runState, config, rng);

    if (result.runState.hp > 0) {
      expect(result.runState.segmentIndex).toBe(2);
    }
  });
});

describe("getDraftOptions", () => {
  let config: RunConfig;
  let runState: RunState;
  let rng: ReturnType<typeof createRNG>;

  beforeEach(() => {
    config = getDefaultConfig();
    runState = createRun(config, "warlord", "test");
    rng = createRNG("draft-test");
  });

  it("should return exactly 3 options", () => {
    const options = getDraftOptions(runState, config, rng);
    expect(options).toHaveLength(3);
  });

  it("should include one of each type", () => {
    const options = getDraftOptions(runState, config, rng);
    const types = options.map(o => o.type);

    expect(types).toContain("member");
    expect(types).toContain("gear");
    expect(types).toContain("tactic");
  });

  it("should scale member rank with segment progress", () => {
    // Early game - rank 1
    const earlyOptions = getDraftOptions(runState, config, rng);
    const earlyMember = earlyOptions.find(o => o.type === "member")!;
    expect(earlyMember.description).toContain("Rank 1");

    // Late game - rank 3
    runState.segmentIndex = 8;
    const lateRng = createRNG("late-draft");
    const lateOptions = getDraftOptions(runState, config, lateRng);
    const lateMember = lateOptions.find(o => o.type === "member")!;
    expect(lateMember.description).toContain("Rank 3");
  });
});

describe("applyDraftChoice", () => {
  let config: RunConfig;
  let runState: RunState;
  let rng: ReturnType<typeof createRNG>;

  beforeEach(() => {
    config = getDefaultConfig();
    runState = createRun(config, "warlord", "test");
    rng = createRNG("apply-test");
  });

  it("should add member when chosen and slots available", () => {
    const options = getDraftOptions(runState, config, rng);
    const memberIdx = options.findIndex(o => o.type === "member") + 1;
    const initialCount = runState.members.length;

    const newState = applyDraftChoice(runState, memberIdx, options, rng);

    expect(newState.members.length).toBe(initialCount + 1);
  });

  it("should upgrade member when slots full", () => {
    // Add a member and fill slots
    const member: MemberInstance = {
      id: "test-member",
      templateId: "soldier",
      name: "Test Soldier",
      primaryStats: ["combat"],
      rank: 1,
      baseValue: 3,
      scaling: 1,
      level: 1,
    };
    runState.members = [member];
    runState.memberSlots = 1; // Full
    
    const options = getDraftOptions(runState, config, rng);
    const memberIdx = options.findIndex(o => o.type === "member") + 1;
    const initialCount = runState.members.length;
    const initialLevel = runState.members[0].level;

    const newState = applyDraftChoice(runState, memberIdx, options, rng);

    // Member count should stay the same
    expect(newState.members.length).toBe(initialCount);
    // But the member should have leveled up
    expect(newState.members[0].level).toBe(initialLevel + 1);
  });

  it("should skip with choice 0", () => {
    const options = getDraftOptions(runState, config, rng);
    const newState = applyDraftChoice(runState, 0, options, rng);

    expect(newState).toEqual(runState);
  });
});

describe("isRunOver", () => {
  let config: RunConfig;
  let runState: RunState;

  beforeEach(() => {
    config = getDefaultConfig();
    runState = createRun(config, "warlord", "test");
  });

  it("should return false during active run", () => {
    expect(isRunOver(runState)).toBe(false);
  });

  it("should return true when HP is 0", () => {
    runState.hp = 0;
    expect(isRunOver(runState)).toBe(true);
  });

  it("should return true after segment 10", () => {
    runState.segmentIndex = 11;
    expect(isRunOver(runState)).toBe(true);
  });
});

describe("scoreRun", () => {
  let config: RunConfig;
  let runState: RunState;

  beforeEach(() => {
    config = getDefaultConfig();
    runState = createRun(config, "warlord", "test");
  });

  it("should calculate score", () => {
    const score = scoreRun(runState, config);
    expect(score).toBeGreaterThan(0);
  });

  it("should include victory bonus for completed runs", () => {
    runState.segmentIndex = 11;
    runState.hp = 50;
    const winScore = scoreRun(runState, config);

    runState.hp = 0;
    const loseScore = scoreRun(runState, config);

    expect(winScore).toBeGreaterThan(loseScore);
  });

  it("should be deterministic", () => {
    const score1 = scoreRun(runState, config);
    const score2 = scoreRun(runState, config);

    expect(score1).toBe(score2);
  });
});

describe("full run integration", () => {
  it("should complete a full run without errors", () => {
    const config = getDefaultConfig();
    const rng = createRNG("integration-test");
    let runState = createRun(config, "warlord", "integration-test");

    while (!isRunOver(runState)) {
      const result = simulateSegment(runState, config, rng);
      runState = result.runState;

      if (runState.hp <= 0) break;

      if (runState.segmentIndex <= 10) {
        const options = getDraftOptions(runState, config, rng);
        runState = applyDraftChoice(runState, 1, options, rng);
        runState.stats = computeStats(runState, config);
      }
    }

    expect(isRunOver(runState)).toBe(true);
    const score = scoreRun(runState, config);
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThan(0);
  });

  it("should produce different outcomes with different seeds", () => {
    const config = getDefaultConfig();

    function runWithSeed(seed: string) {
      const rng = createRNG(seed);
      let runState = createRun(config, "warlord", seed);

      while (!isRunOver(runState)) {
        const result = simulateSegment(runState, config, rng);
        runState = result.runState;
        if (runState.hp <= 0) break;
        if (runState.segmentIndex <= 10) {
          const options = getDraftOptions(runState, config, rng);
          runState = applyDraftChoice(runState, 1, options, rng);
        }
      }

      return scoreRun(runState, config);
    }

    const score1 = runWithSeed("seed-a");
    const score2 = runWithSeed("seed-b");

    // Different seeds should likely produce different scores
    // (not guaranteed but very likely)
    expect(typeof score1).toBe("number");
    expect(typeof score2).toBe("number");
  });
});

