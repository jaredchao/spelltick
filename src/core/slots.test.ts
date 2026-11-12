import { describe, expect, it } from "vitest";
import { buildSlots, slotDisplay } from "./slots";

describe("buildSlots", () => {
  it("makes one slot per answer word sized by its letters", () => {
    const slots = buildSlots("Good morning", "", 0);
    expect(slots.map((s) => [s.expected, s.width, s.active])).toEqual([
      ["Good", 4, true],
      ["morning", 7, false],
    ]);
  });

  it("puts typed words into their slots and moves on after a space", () => {
    const slots = buildSlots("Good morning", "Good mor", 0);
    expect(slots.map((s) => s.typed)).toEqual(["Good", "mor"]);
    expect(slots[1].active).toBe(true);
    const afterSpace = buildSlots("Good morning", "Good ", 0);
    expect(afterSpace[1]).toMatchObject({ typed: "", active: true });
  });

  it("adds slots for extra words and widens long ones", () => {
    const slots = buildSlots("deploy", "deployyy now", 0);
    expect(slots).toHaveLength(2);
    expect(slots[0].width).toBe(8);
    expect(slots[1]).toMatchObject({ expected: "", typed: "now", active: true });
  });

  it("ignores leading spaces and collapses repeated spaces", () => {
    expect(buildSlots("a b", "  a   b", 0).map((s) => s.typed)).toEqual(["a", "b"]);
  });

  it("spreads hinted letters across slots", () => {
    const slots = buildSlots("Good morning", "", 6);
    expect(slots.map((s) => s.hint)).toEqual(["Good", "m"]);
  });
});

describe("slotDisplay", () => {
  it("shows typed letters then untyped hint letters", () => {
    const [slot] = buildSlots("deploy", "d", 3);
    expect(slotDisplay(slot)).toEqual([
      { char: "d", hinted: false },
      { char: "e", hinted: true },
      { char: "p", hinted: true },
    ]);
  });
});
