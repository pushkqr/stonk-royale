import { describe, it, expect } from "vitest";
import { money, signedMoney, pct, price, clock, toneOf } from "../lib/format";

describe("format.js", () => {
  it("formats standard money amounts", () => {
    expect(money(10000)).toBe("$10,000");
    expect(money(0)).toBe("$0");
  });

  it("formats signed money amounts with prefix", () => {
    expect(signedMoney(500)).toBe("+$500");
    expect(signedMoney(-500)).toBe("-$500");
    expect(signedMoney(0)).toBe("+$0");
  });

  it("formats percentages with 1 decimal place", () => {
    expect(pct(12.34)).toBe("+12.3%");
    expect(pct(-5.67)).toBe("-5.7%");
    expect(pct(0)).toBe("+0.0%");
  });

  it("formats prices based on value magnitude", () => {
    expect(price(100.5)).toBe("100.50");
    expect(price(1.5)).toBe("1.500");
    expect(price(0.5)).toBe("0.5000");
    expect(price(null)).toBe("—");
  });

  it("formats milliseconds into mm:ss countdown clock", () => {
    expect(clock(90000)).toBe("1:30");
    expect(clock(5000)).toBe("0:05");
    expect(clock(0)).toBe("0:00");
    expect(clock(-100)).toBe("0:00");
  });

  it("returns correct tone classes", () => {
    expect(toneOf(10)).toBe("pump");
    expect(toneOf(-10)).toBe("dump");
    expect(toneOf(0)).toBe("muted");
  });
});
