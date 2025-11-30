# AI Agent Instructions

## Project Overview

Fellowship Builder is a roguelike deck-builder style game engine where players lead a fellowship through 10 segments of challenges. The game features:

- **Leaders** with unique stats and tactic pools
- **Members** with primary stats that can be recruited or upgraded
- **Gear** for healing, auto-success tokens, and slot expansion
- **Tactics** for permanent boosts, temporary buffs, and event skipping
- **Randomized segments** with single-stat and dual-stat challenges

## Code Structure

| File | Purpose |
|------|---------|
| `types.ts` | Zod schemas and TypeScript types |
| `config.ts` | Game content (leaders, members, gear, tactics, segment generation) |
| `engine.ts` | Core game logic (run creation, event resolution, drafting) |
| `bot-runner.ts` | Bot strategies and batch simulation |
| `rng.ts` | Seeded random number generator |
| `cli.ts` | Interactive CLI interface |
| `engine.test.ts` | Unit and integration tests |

## Development Guidelines

### Testing

- **Always edit tests according to changes** - When modifying types, game logic, or behavior, update corresponding tests in `engine.test.ts`
- Run `pnpm run test` before considering any change complete
- Ensure all existing tests pass after modifications

### Bot Functionality

- **Always check bot functions and add, modify or remove bot functionality according to new or changed features**
- Bots should be able to utilize all game features
- When adding new mechanics, ensure existing bot strategies can handle them
- **Always make suggestions if changes warrant a new playstyle bot** - New features may enable interesting new strategies worth automating

### Type Safety

- Use Zod schemas in `types.ts` for all data structures
- Export both the schema and inferred TypeScript type
- Keep schemas and runtime types in sync

### Game Balance

- Use `bot-runner.ts` to validate balance changes
- Run batch simulations across all leaders and strategies
- Target ~50-70% win rate for smart strategies on balanced leaders

### Code Style

- Use immutable patterns (spread operators) for state updates
- Keep functions pure where possible
- Use descriptive emoji in log messages for readability
- Document complex game mechanics with comments

### Content Changes

- New leaders need a corresponding `tacticsPoolId` and tactic pool
- Member templates use `primaryStats` array (supports multiple primary stats)
- Permanent boosts give full value for primary stats, half for secondary
- Segment generation is seeded per-run for variety

## Common Tasks

### Adding a New Leader

1. Add leader definition in `config.ts` with unique `tacticsPoolId`
2. Create corresponding tactic pool with 3-4 themed tactics
3. Run bot simulations to verify balance

### Adding a New Member Type

1. Add template to `memberTemplates` in `config.ts`
2. Set appropriate `primaryStats`, `rank`, `baseValue`, and `scaling`
3. Consider if new bot strategies could leverage the member

### Adding a New Mechanic

1. Update types in `types.ts`
2. Implement logic in `engine.ts`
3. Add content in `config.ts`
4. Update tests in `engine.test.ts`
5. Update bot strategies in `bot-runner.ts` if applicable
6. Suggest new bot strategy if mechanic enables new playstyle

