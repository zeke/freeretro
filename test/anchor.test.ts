import { describe, expect, it } from "vitest";
import { clamp, offsetWithinRect, pointFromRect } from "../src/client/agent/anchor";

const rect = { left: 100, top: 50, width: 200, height: 80 };

describe("anchor math", () => {
  it("clamps to a range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("offsetWithinRect maps a point to 0..1 within the rect", () => {
    expect(offsetWithinRect(rect, 200, 90)).toEqual({ ox: 0.5, oy: 0.5 });
    expect(offsetWithinRect(rect, 100, 50)).toEqual({ ox: 0, oy: 0 });
    expect(offsetWithinRect(rect, 300, 130)).toEqual({ ox: 1, oy: 1 });
  });

  it("offsetWithinRect clamps wild near-misses to a small margin", () => {
    const far = offsetWithinRect(rect, 100 + 200 * 5, 50);
    expect(far.ox).toBe(1.5);
  });

  it("offsetWithinRect is safe on a zero-size rect", () => {
    expect(offsetWithinRect({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({
      ox: 0.5,
      oy: 0.5,
    });
  });

  it("pointFromRect inverts offsetWithinRect for in-bounds points", () => {
    const point = { x: 240, y: 70 };
    const offset = offsetWithinRect(rect, point.x, point.y);
    expect(pointFromRect(rect, offset.ox, offset.oy)).toEqual(point);
  });

  it("a point on one card resolves to the same spot on a differently sized card", () => {
    const senderRect = { left: 0, top: 0, width: 300, height: 150 };
    const observerRect = { left: 500, top: 200, width: 240, height: 120 };
    // Sender points at 25% / 75% within their card.
    const offset = offsetWithinRect(senderRect, 75, 112.5);
    expect(offset).toEqual({ ox: 0.25, oy: 0.75 });
    // Observer reconstructs the same fractional spot on their card.
    expect(pointFromRect(observerRect, offset.ox, offset.oy)).toEqual({ x: 560, y: 290 });
  });
});
