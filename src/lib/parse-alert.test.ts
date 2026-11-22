import { describe, expect, it } from "vitest";
import { parseAlert, parseDate } from "./parse-alert";

// Sample alerts follow common Nigerian bank layouts. Account numbers and names are made up.
describe("parseAlert", () => {
  it("reads a labeled debit with DR after the amount", () => {
    const alert = [
      "Acct: 012****789",
      "Amt: NGN5,000.00 DR",
      "Desc: POS PURCHASE @ SHOPRITE LEKKI",
      "Avail Bal: NGN45,210.50",
      "Date: 2026-11-20 14:32",
    ].join("\n");
    expect(parseAlert(alert)).toEqual({
      type: "debit",
      amountKobo: 500000,
      balanceKobo: 4521050,
      narration: "POS PURCHASE @ SHOPRITE LEKKI",
      occurredAt: "2026-11-20T14:32:00+01:00",
      category: "Food & groceries",
    });
  });

  it("reads Debit on its own line and ignores the Total line", () => {
    const alert = [
      "Debit",
      "Amt:NGN2,500.00",
      "Acc:123**789",
      "Desc:AIRTIME/MTN/08012345678",
      "Time:20/11/2026 10:15",
      "Avail Bal:NGN12,000.00",
      "Total:NGN12,000.00",
    ].join("\n");
    const r = parseAlert(alert);
    expect(r).toMatchObject({ type: "debit", amountKobo: 250000, balanceKobo: 1200000, category: "Airtime & data" });
    expect(r?.occurredAt).toBe("2026-11-20T10:15:00+01:00");
  });

  it("reads DR before the amount label and a 12-hour time", () => {
    const alert = ["Acct:401**10", "DT:20/11/2026:10:15:22PM", "NIP/OPAY/JOHN DOE", "DR Amt:10,000.00", "Bal:150,000.00"].join("\n");
    expect(parseAlert(alert)).toEqual({
      type: "debit",
      amountKobo: 1000000,
      balanceKobo: 15000000,
      narration: "NIP/OPAY/JOHN DOE",
      occurredAt: "2026-11-20T22:15:22+01:00",
      category: "Transfers",
    });
  });

  it("reads a credit with a month-name date", () => {
    const alert = ["Txn: Credit", "Ac:20XXXXXX12", "Amt:NGN 150,000.00", "Des:SALARY NOV 2026", "Date:20-Nov-2026 10:15", "Bal:NGN 155,500.00"].join("\n");
    expect(parseAlert(alert)).toMatchObject({
      type: "credit",
      amountKobo: 15000000,
      narration: "SALARY NOV 2026",
      occurredAt: "2026-11-20T10:15:00+01:00",
      category: "Salary",
    });
  });

  it("does not let the balance's CR suffix make a debit look like a credit", () => {
    const alert = "Debit: 3XXXXXX123 NGN 2,000.00 POS @SHOPRITE 20-NOV-2026 10:15 Bal: NGN 50,000.00CR";
    expect(parseAlert(alert)).toMatchObject({
      type: "debit",
      amountKobo: 200000,
      balanceKobo: 5000000,
      occurredAt: "2026-11-20T10:15:00+01:00",
      category: "Food & groceries",
    });
  });

  it("reads app-style sentences with the naira sign", () => {
    expect(parseAlert("You have received NGN 5,000.00 from JOHN DOE.")).toMatchObject({
      type: "credit",
      amountKobo: 500000,
      balanceKobo: null,
      occurredAt: null,
      category: "Income",
    });
    expect(parseAlert("Your transfer of ₦3,250.50 to JANE was sent successfully")).toMatchObject({
      type: "debit",
      amountKobo: 325050,
      category: "Transfers",
    });
  });

  it("returns null when it cannot find an amount or a direction", () => {
    expect(parseAlert("hello, how are you?")).toBeNull();
    expect(parseAlert("I paid 5000 for lunch")).toBeNull(); // no currency marker
    expect(parseAlert("Amt: NGN5,000.00")).toBeNull(); // no direction
  });
});

describe("parseDate", () => {
  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull();
  });

  it("does not mistake a currency code for a month", () => {
    expect(parseDate("123 NGN 2000.00 on 05-Dec-2026")).toBe("2026-12-05T00:00:00+01:00");
  });
});
