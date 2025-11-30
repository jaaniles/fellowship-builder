import * as readline from "readline";
import { getDefaultConfig } from "./config.js";
import {
  createRun,
  simulateSegment,
  getDraftOptions,
  applyDraftChoice,
  isRunOver,
  scoreRun,
  getRunSummary,
  computeStats,
} from "./engine.js";
import { createRNG } from "./rng.js";
import type { RunState, RunConfig, DraftOption, MemberTemplate, Tactic } from "./types.js";

// ============================================================================
// CLI HELPERS
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function print(text: string): void {
  console.log(text);
}

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function clear(): void {
  console.clear();
}

/**
 * Wait for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Typewriter effect - prints text character by character
 * @param text The text to type out
 * @param charDelay Delay between characters in ms (default: 8ms for fast typing)
 */
async function typewrite(text: string, charDelay: number = 8): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(charDelay);
  }
  process.stdout.write("\n");
}

/**
 * Typewriter effect for multiple lines
 */
async function typewriteLines(lines: string[], charDelay: number = 8, lineDelay: number = 50): Promise<void> {
  for (const line of lines) {
    await typewrite(line, charDelay);
    await sleep(lineDelay);
  }
}

/**
 * Parse segment log into individual events
 * Each event starts with "🎲 Event"
 */
function parseEventsFromLog(segmentLog: string[]): { header: string[]; events: string[][]; footer: string[] } {
  const header: string[] = [];
  const events: string[][] = [];
  const footer: string[] = [];
  
  let currentEvent: string[] = [];
  let inEvents = false;
  let pastEvents = false;
  
  for (const line of segmentLog) {
    if (line.includes("🎲 Event")) {
      inEvents = true;
      if (currentEvent.length > 0) {
        events.push(currentEvent);
      }
      currentEvent = [line];
    } else if (line.includes("──────") && inEvents) {
      // This is the segment summary separator
      if (currentEvent.length > 0) {
        events.push(currentEvent);
        currentEvent = [];
      }
      inEvents = false;
      pastEvents = true;
      footer.push(line);
    } else if (inEvents) {
      currentEvent.push(line);
    } else if (pastEvents) {
      footer.push(line);
    } else {
      header.push(line);
    }
  }
  
  // Push last event if any
  if (currentEvent.length > 0) {
    events.push(currentEvent);
  }
  
  return { header, events, footer };
}

// ============================================================================
// TITLE SCREEN
// ============================================================================

function showTitle(): void {
  clear();
  print(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    ███████╗███████╗██╗     ██╗      ██████╗ ██╗    ██╗        ║
║    ██╔════╝██╔════╝██║     ██║     ██╔═══██╗██║    ██║        ║
║    █████╗  █████╗  ██║     ██║     ██║   ██║██║ █╗ ██║        ║
║    ██╔══╝  ██╔══╝  ██║     ██║     ██║   ██║██║███╗██║        ║
║    ██║     ███████╗███████╗███████╗╚██████╔╝╚███╔███╔╝        ║
║    ╚═╝     ╚══════╝╚══════╝╚══════╝ ╚═════╝  ╚══╝╚══╝         ║
║                                                               ║
║              ██████╗ ██╗   ██╗██╗██╗     ██████╗ ███████╗██████╗ 
║              ██╔══██╗██║   ██║██║██║     ██╔══██╗██╔════╝██╔══██╗
║              ██████╔╝██║   ██║██║██║     ██║  ██║█████╗  ██████╔╝
║              ██╔══██╗██║   ██║██║██║     ██║  ██║██╔══╝  ██╔══██╗
║              ██████╔╝╚██████╔╝██║███████╗██████╔╝███████╗██║  ██║
║              ╚═════╝  ╚═════╝ ╚═╝╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝
║                                                               ║
║                   ~ A Roguelike Journey ~                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

// ============================================================================
// LEADER SELECTION
// ============================================================================

async function selectLeader(config: RunConfig): Promise<string> {
  print("\n╔═══════════════════════════════════════════════════════════════╗");
  print("║                     CHOOSE YOUR LEADER                        ║");
  print("╚═══════════════════════════════════════════════════════════════╝\n");

  for (let i = 0; i < config.leaders.length; i++) {
    const leader = config.leaders[i];
    print(`  [${i + 1}] ${leader.name}`);
    print(`      ${leader.description}`);
    print(`      Stats: Combat +${leader.baseStats.combat || 0} | Survival +${leader.baseStats.survival || 0} | Social +${leader.baseStats.social || 0} | Chaos +${leader.baseStats.chaos || 0}`);
    print(`      HP Bonus: +${leader.bonusHp} | Member Slots: ${leader.baseMemberSlots}`);
    print("");
  }

  while (true) {
    const answer = await question("\n  Enter leader number (1-5): ");
    const choice = parseInt(answer, 10);
    
    if (choice >= 1 && choice <= config.leaders.length) {
      return config.leaders[choice - 1].id;
    }
    
    print("  ⚠️  Invalid choice. Please try again.");
  }
}

// ============================================================================
// DRAFT PHASE
// ============================================================================

async function runDraftPhase(
  runState: RunState,
  config: RunConfig,
  rng: ReturnType<typeof createRNG>
): Promise<RunState> {
  const options = getDraftOptions(runState, config, rng);

  print("\n╔═══════════════════════════════════════════════════════════════╗");
  print("║                      DRAFT PHASE                              ║");
  print("╚═══════════════════════════════════════════════════════════════╝\n");

  // Show current team stats
  print("  ┌─────────────────────────────────────────────────────────────┐");
  print(`  │ ❤️  HP: ${runState.hp}/${runState.maxHp}  │  👥 Members: ${runState.members.length}/${runState.memberSlots}`);
  print(`  │ 💪 Stats: ⚔️ ${runState.stats.combat} | 🏕️ ${runState.stats.survival} | 💬 ${runState.stats.social} | 🎲 ${runState.stats.chaos}`);
  if (runState.members.length > 0) {
    const memberList = runState.members
      .map(m => `${m.name} Lv${m.level}`)
      .join(", ");
    print(`  │ 🧑 Team: ${memberList}`);
  }
  print("  └─────────────────────────────────────────────────────────────┘\n");

  // Show hint about the next segment
  const nextSegment = runState.segments.find(s => s.index === runState.segmentIndex);
  if (nextSegment) {
    const segmentStats = nextSegment.type.toLowerCase().split("/");
    const statIcons: Record<string, string> = {
      combat: "⚔️",
      survival: "🏕️",
      social: "💬",
      chaos: "🎲",
    };
    const statsDisplay = segmentStats
      .map(s => `${statIcons[s] || ""} ${s.toUpperCase()}`)
      .join(" & ");
    
    print(`  🔮 NEXT: Segment ${nextSegment.index} — ${statsDisplay}`);
    print(`     Prepare your fellowship for ${nextSegment.type.toLowerCase()} challenges!`);
    print("");
  }

  print("  Choose your reward:\n");

  const slotsAreFull = runState.members.length >= runState.memberSlots;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const typeIcon = opt.type === "member" ? "🧑" : opt.type === "gear" ? "📦" : "⚡";
    
    // Show upgrade hint for member option if slots are full
    if (opt.type === "member" && slotsAreFull) {
      const template = opt.payload as MemberTemplate;
      // Find eligible members (those with matching primary stats)
      const eligibleMembers = runState.members.filter(m =>
        m.primaryStats.some(ps => template.primaryStats.includes(ps))
      );
      
      print(`  [${i + 1}] ${typeIcon} ${opt.type.toUpperCase()}: ${opt.description}`);
      print(`      ⬆️  UPGRADE MODE - Slots full (${runState.members.length}/${runState.memberSlots})`);
      
      if (eligibleMembers.length === 1) {
        print(`      🎯 Target: ${eligibleMembers[0].name} (matching ${template.primaryStats.join("/")} stat)`);
      } else if (eligibleMembers.length > 1) {
        const names = eligibleMembers.map(m => m.name).join(", ");
        print(`      🎯 Eligible: ${names} (random pick)`);
      } else {
        print(`      🎯 No primary match - random member will level up`);
      }
    } else if (opt.type === "tactic") {
      const tactic = opt.payload as Tactic;
      print(`  [${i + 1}] ${typeIcon} ${opt.type.toUpperCase()}: ${opt.description}`);
      
      // Show targeting info for permanent_boost tactics
      if (tactic.type === "permanent_boost" && tactic.statType && runState.members.length > 0) {
        const eligibleMembers = runState.members.filter(m =>
          m.primaryStats.includes(tactic.statType!)
        );
        
        if (eligibleMembers.length === 1) {
          print(`      🎯 Target: ${eligibleMembers[0].name} (+${tactic.value} ${tactic.statType})`);
        } else if (eligibleMembers.length > 1) {
          const names = eligibleMembers.map(m => m.name).join(", ");
          print(`      🎯 Eligible: ${names} (+${tactic.value} ${tactic.statType}, random pick)`);
        } else {
          print(`      ⚠️  No ${tactic.statType} specialists - random member gets half effect (+${Math.floor(tactic.value / 2)})`);
        }
      } else if (tactic.type === "permanent_boost" && tactic.statType && runState.members.length === 0) {
        print(`      👑 No members - Leader gains +${tactic.value} ${tactic.statType}!`);
      }
    } else {
      print(`  [${i + 1}] ${typeIcon} ${opt.type.toUpperCase()}: ${opt.description}`);
    }
    print("");
  }

  print("  [0] Skip (no reward)");

  while (true) {
    const answer = await question("\n  Your choice (0-3): ");
    const choice = parseInt(answer, 10);

    if (choice >= 0 && choice <= 3) {
      if (choice === 0) {
        print("\n  ⏭️  Skipped draft phase.");
        return runState;
      }
      return applyDraftChoice(runState, choice, options, rng);
    }

    print("  ⚠️  Invalid choice. Please enter 0-3.");
  }
}

// ============================================================================
// END OF RUN
// ============================================================================

function showEndOfRun(runState: RunState, config: RunConfig): void {
  const score = scoreRun(runState, config);
  const victory = runState.hp > 0 && runState.segmentIndex > 10;

  print("\n");
  print("═".repeat(60));
  
  if (victory) {
    print(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║     🏆  V I C T O R Y  🏆                             ║
    ║                                                       ║
    ║     The Fellowship has completed its journey!         ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
`);
  } else {
    print(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║     💀  D E F E A T  💀                               ║
    ║                                                       ║
    ║     The Fellowship has fallen...                      ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
`);
  }

  print("═".repeat(60));
  print("\n  📊 FINAL STATISTICS");
  print("  " + "─".repeat(40));
  print(`  👑 Leader: ${runState.leader.name}`);
  print(`  📍 Segments Completed: ${Math.min(runState.segmentIndex - 1, 10)}/10`);
  print(`  ❤️  Final HP: ${runState.hp}/${runState.maxHp}`);
  print(`\n  💪 Final Stats:`);
  print(`     Combat: ${runState.stats.combat}`);
  print(`     Survival: ${runState.stats.survival}`);
  print(`     Social: ${runState.stats.social}`);
  print(`     Chaos: ${runState.stats.chaos}`);
  print(`\n  👥 Final Fellowship:`);
  
  for (const member of runState.members) {
    print(`     ${member.name} - Level ${member.level} (${member.primaryStats.join("/")})`);
  }

  print(`\n  🏅 FINAL SCORE: ${score}`);
  print("\n" + "═".repeat(60));
}

// ============================================================================
// MAIN GAME LOOP
// ============================================================================

async function runGame(): Promise<boolean> {
  const config = getDefaultConfig();
  
  // Generate a random seed for this run
  const seed = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const rng = createRNG(seed);

  // Leader selection
  const leaderId = await selectLeader(config);
  
  // Create run
  let runState = createRun(config, leaderId, seed);
  
  print(getRunSummary(runState));
  
  // Initial draft phase - player shapes their opening strategy with 3 picks
  print("\n╔═══════════════════════════════════════════════════════════════╗");
  print("║                  PREPARE YOUR FELLOWSHIP                      ║");
  print("╚═══════════════════════════════════════════════════════════════╝");
  print("\n  Before your journey begins, make 3 strategic choices to");
  print("  shape your fellowship for the challenges ahead.");
  await question("  Press ENTER to see your options...");
  
  for (let i = 1; i <= 3; i++) {
    clear();
    print(`\n  🎯 Initial Draft ${i}/3\n`);
    runState = await runDraftPhase(runState, config, rng);
    runState.stats = computeStats(runState, config);
  }
  
  clear();
  print(getRunSummary(runState));
  await question("\n  Press ENTER to begin your journey...");

  // Main game loop
  while (!isRunOver(runState)) {
    // Pre-segment display
    clear();
    print(getRunSummary(runState));
    
    const currentSegment = runState.segments.find(s => s.index === runState.segmentIndex);
    if (!currentSegment) break;

    print(`\n  ⚔️  Approaching Segment ${currentSegment.index}: ${currentSegment.type}`);
    await question("  Press ENTER to proceed...");

    // Simulate segment (get all results)
    const result = simulateSegment(runState, config, rng);
    runState = result.runState;

    // Parse the log into header, events, and footer
    const { header, events, footer } = parseEventsFromLog(result.segmentLog);
    
    // Show segment header (stats display)
    for (const line of header) {
      print(line);
    }
    
    // Show events one by one with typewriter effect
    let playerDied = false;
    for (let i = 0; i < events.length; i++) {
      const eventLines = events[i];
      
      await question("\n  Press ENTER for next event...");
      print("");
      
      // Typewrite each line of the event
      for (const line of eventLines) {
        await typewrite(line, 6); // Fast typing speed
        
        // Check if this line indicates death
        if (line.includes("💀 THE FELLOWSHIP HAS FALLEN")) {
          playerDied = true;
        }
      }
      
      // If player died, stop processing events
      if (playerDied) {
        await question("\n  Press ENTER to see your fate...");
        break;
      }
    }

    // Check for death - skip to end screen
    if (runState.hp <= 0) {
      break;
    }

    // Show segment summary footer (no typewriter - instant display)
    if (footer.length > 0) {
      print("");
      for (const line of footer) {
        print(line);
      }
    }

    await question("\n  Press ENTER to continue...");

    // Draft phase (if not at end)
    if (runState.segmentIndex <= 10) {
      clear();
      runState = await runDraftPhase(runState, config, rng);
      
      // Recompute stats after draft
      runState.stats = computeStats(runState, config);
    }
  }

  // End of run
  clear();
  showEndOfRun(runState, config);

  // Play again?
  const playAgain = await question("\n  Play again? (y/n): ");
  return playAgain.toLowerCase() === "y";
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  let continueGame = true;

  while (continueGame) {
    showTitle();
    await question("\n  Press ENTER to start...");
    continueGame = await runGame();
  }

  print("\n  Thanks for playing Fellowship Builder!");
  print("  May your next journey be legendary.\n");
  rl.close();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

