/**
 * RNG Interface - allows for deterministic random number generation
 */
export interface RNG {
  nextFloat(): number; // Returns 0 <= x < 1
  nextInt(min: number, max: number): number; // Returns min <= x <= max
  shuffle<T>(array: T[]): T[];
  pick<T>(array: T[]): T;
}

/**
 * Seeded RNG implementation using a simple LCG (Linear Congruential Generator)
 * This provides deterministic random numbers given the same seed
 */
export class SeededRNG implements RNG {
  private state: number;

  constructor(seed: string | number) {
    // Convert string seed to number using simple hash
    if (typeof seed === "string") {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
      }
      this.state = Math.abs(hash) || 1;
    } else {
      this.state = Math.abs(seed) || 1;
    }
  }

  /**
   * LCG parameters (same as glibc)
   */
  private next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state;
  }

  nextFloat(): number {
    return this.next() / 0x7fffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return array[this.nextInt(0, array.length - 1)];
  }
}

/**
 * Create a new RNG instance with the given seed
 */
export function createRNG(seed: string | number): RNG {
  return new SeededRNG(seed);
}

