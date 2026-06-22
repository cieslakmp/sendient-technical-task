import { describe, expect, it } from "vitest";
import { classifyScore } from "@/lib/scoring";

describe("classifyScore", () => {
  it("treats 70 and above as high", () => {
    expect(classifyScore(70)).toBe("high");
    expect(classifyScore(99)).toBe("high");
  });

  it("treats 50-69 as mid", () => {
    expect(classifyScore(50)).toBe("mid");
    expect(classifyScore(69)).toBe("mid");
  });

  it("treats below 50 as low", () => {
    expect(classifyScore(0)).toBe("low");
    expect(classifyScore(49)).toBe("low");
  });

  it("throws for scores outside 0–100", () => {
  expect(() => classifyScore(-1)).toThrow(RangeError);
  expect(() => classifyScore(101)).toThrow(RangeError);
  expect(() => classifyScore(NaN)).toThrow(RangeError);
  expect(() => classifyScore(Infinity)).toThrow(RangeError);
});
});
