import { describe, expect, it } from "vitest";
import { formatNaira, monthStartWAT, summarize } from "./summary";

describe("monthStartWAT", () => {
  it("uses the Nigerian month, not the UTC month", () => {
    // 23:30 UTC on 30 Nov is already 00:30 on 1 Dec in Lagos.
    expect(monthStartWAT(new Date("2026-11-30T23:30:00Z"))).toBe("2026-11-30T23:00:00.000Z");
    expect(monthStartWAT(new Date("2026-11-20T12:00:00Z"))).toBe("2026-10-31T23:00:00.000Z");
  });
});

describe("summarize", () => {
  it("totals money in and out and ranks spending by category", () => {
    const s = summarize([
      { type: "credit", amount_kobo: 10_000_00, category: "Salary" },
      { type: "debit", amount_kobo: 2_000_00, category: "Transport" },
      { type: "debit", amount_kobo: 5_000_00, category: "Food & groceries" },
      { type: "debit", amount_kobo: 1_000_00, category: "Transport" },
    ]);
    expect(s.inKobo).toBe(10_000_00);
    expect(s.outKobo).toBe(8_000_00);
    expect(s.spending).toEqual([
      { category: "Food & groceries", kobo: 5_000_00 },
      { category: "Transport", kobo: 3_000_00 },
    ]);
  });
});

describe("formatNaira", () => {
  it("formats kobo as naira", () => {
    expect(formatNaira(4521050)).toContain("45,210.50");
  });
});
