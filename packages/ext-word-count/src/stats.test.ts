import { describe, expect, it } from "vitest";
import { computeStats, WORDS_PER_MINUTE } from "./stats.js";

describe("computeStats", () => {
  it("counts words, chars, and reading time for a normal body", () => {
    const stats = computeStats("hello brave new world");
    expect(stats.words).toBe(4);
    expect(stats.chars).toBe(21);
    expect(stats.readingTimeMinutes).toBe(Math.round((4 / WORDS_PER_MINUTE) * 10) / 10);
  });

  it("returns zeros for an empty body", () => {
    expect(computeStats("")).toEqual({ words: 0, chars: 0, readingTimeMinutes: 0 });
  });

  it("ignores surrounding whitespace when counting words", () => {
    expect(computeStats("   \n\t  ").words).toBe(0);
    expect(computeStats("  one  two  ").words).toBe(2);
  });

  it("splits on any whitespace run, not just spaces", () => {
    expect(computeStats("one\ntwo\tthree\r\nfour").words).toBe(4);
  });

  it("counts characters including whitespace", () => {
    expect(computeStats("ab c").chars).toBe(4);
  });
});
