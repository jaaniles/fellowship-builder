// Core types
export * from "./types.js";

// RNG
export { type RNG, SeededRNG, createRNG } from "./rng.js";

// Configuration
export { defaultConfig, getDefaultConfig } from "./config.js";

// Engine
export {
  createRun,
  simulateSegment,
  getDraftOptions,
  applyDraftChoice,
  isRunOver,
  scoreRun,
  getRunSummary,
  computeStats,
  getMemberContribution,
  getMemberAllStats,
  resolveEvent,
} from "./engine.js";

// Bot runner
export {
  runBot,
  runBotBatch,
  memberFocusStrategy,
  gearFocusStrategy,
  tacticFocusStrategy,
  randomStrategy,
  smartStrategy,
  balancedStrategy,
} from "./bot-runner.js";

