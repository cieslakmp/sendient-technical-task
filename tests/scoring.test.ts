import { describe, expect, it } from "vitest";
import { classifyScore } from "@/lib/scoring";

describe("classifyScore", () => {
  it("treats 70 and above as high", () => {
    expect(classifyScore(70)).toBe("high");
    expect(classifyScore(99)).toBe("high");
    expect(classifyScore(100)).toBe("high"); // upper boundary
  });

  it("treats 50-69 as mid", () => {
    expect(classifyScore(50)).toBe("mid");
    expect(classifyScore(69)).toBe("mid");
  });

  it("treats below 50 as low", () => {
    expect(classifyScore(0)).toBe("low");
    expect(classifyScore(49)).toBe("low");
  });

  // Bug #10/#12 regression: old code had no guard — NaN silently returned "low",
  // scores >100 silently returned "high". These fail on old code, pass on fixed code.
  it("throws RangeError for scores outside 0–100", () => {
    expect(() => classifyScore(-1)).toThrow(RangeError);
    expect(() => classifyScore(101)).toThrow(RangeError);
    expect(() => classifyScore(NaN)).toThrow(RangeError);
    expect(() => classifyScore(Infinity)).toThrow(RangeError);
  });
});
