# Fellowship Builder

A roguelike/idle Fellowship-building CLI game prototype built in pure TypeScript.

## Overview

Lead a small Fellowship through 10 journey segments filled with challenges. Your Fellowship has four stats (**Combat**, **Survival**, **Social**, **Chaos**) that are tested against segment-specific checks. Build and shape your Fellowship by drafting new members, gear, and tactics between segments.

## Quick Start

```bash
# Install dependencies
npm install

# Play the game
npm run dev

# Run automated bot testing
npm run bot

# Run tests
npm test
```

## Game Mechanics

### Core Loop

1. **Choose a Leader** - Each leader provides unique starting stats, HP bonus, and member slots
2. **Survive 10 Segments** - Each segment contains 3 events (skill checks)
3. **Draft Upgrades** - After each segment, choose between a new Member, Gear, or Tactic
4. **Level Up** - All members gain +1 level after surviving each segment

### Stats

| Stat | Description |
|------|-------------|
| Combat | Fighting prowess and battle readiness |
| Survival | Wilderness skills and endurance |
| Social | Diplomacy and negotiation ability |
| Chaos | Luck and unpredictability |

### Skill Checks

Each event tests one or two stats against thresholds:

- **SUCCESS** (stat > threshold): No or minimal damage
- **MITIGATED FAILURE** (stat = threshold): Medium damage
- **FAILURE** (stat < threshold): Full damage

### Draft Options

After each segment, choose one:

| Type | Description |
|------|-------------|
| **Member** | Add a new fellowship member (if slots available) |
| **Gear** | Gain items like healing potions, auto-success tokens, or extra member slots |
| **Tactic** | Apply permanent boosts, temporary buffs, or skip events |

### Leaders

| Leader | Specialty | HP Bonus | Slots |
|--------|-----------|----------|-------|
| The Warlord | Combat focused | +10 | 4 |
| The Diplomat | Social focused | +5 | 5 |
| The Ranger | Survival focused | +15 | 3 |
| The Trickster | Chaos focused | +8 | 4 |
| The Wanderer | Balanced | +12 | 4 |

## Architecture

```
src/
├── types.ts       # Core type definitions (Zod schemas)
├── rng.ts         # Deterministic seeded RNG
├── config.ts      # Game configuration and content
├── engine.ts      # Pure game engine functions
├── cli.ts         # Interactive CLI interface
├── bot-runner.ts  # Automated bot testing
└── index.ts       # Module exports
```

### Engine API

The game engine is designed for testability and bot automation:

```typescript
import {
  createRun,
  simulateSegment,
  getDraftOptions,
  applyDraftChoice,
  isRunOver,
  scoreRun
} from './engine';

// Create a new run
const runState = createRun(config, 'warlord', 'my-seed');

// Simulate a segment
const result = simulateSegment(runState, config, rng);

// Get draft options
const options = getDraftOptions(runState, config, rng);

// Apply a choice (1-3, or 0 to skip)
const newState = applyDraftChoice(runState, 1, options, rng);

// Check if run is over
if (isRunOver(runState)) {
  const score = scoreRun(runState, config);
}
```

### Bot Strategies

Built-in strategies for automated testing:

- `memberFocusStrategy` - Prioritizes recruiting members
- `gearFocusStrategy` - Prioritizes gear items
- `tacticFocusStrategy` - Prioritizes tactics
- `smartStrategy` - Adapts based on HP and capacity
- `balancedStrategy` - Rotates between options
- `randomStrategy` - Random choices

## Development

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests in watch mode
npm run test:watch
```

## Configuration

All game balance values are centralized in `src/config.ts`:

- Base HP and member slots
- Leader stats and bonuses
- Member templates with stats and scaling
- Gear and tactic definitions
- Segment progression and event thresholds
- Damage values per outcome

## Design Goals

This prototype validates:

1. Core game loop feels engaging
2. Drafting choices feel meaningful
3. Multiple stat types create interesting tension
4. Member progression creates satisfying power growth
5. Leaders meaningfully change run dynamics

## License

MIT

