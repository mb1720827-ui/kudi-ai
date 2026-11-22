export interface SummaryRow {
  type: "credit" | "debit";
  amount_kobo: number;
  category: string;
}

const WAT_OFFSET_MS = 60 * 60 * 1000; // Nigeria is UTC+1 all year

/** Start of the current month in West Africa Time, as an ISO string for database filters. */
export function monthStartWAT(now = new Date()): string {
  const wat = new Date(now.getTime() + WAT_OFFSET_MS);
  return new Date(Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), 1) - WAT_OFFSET_MS).toISOString();
}

export function summarize(rows: SummaryRow[]) {
  let inKobo = 0;
  let outKobo = 0;
  const spending = new Map<string, number>();
  for (const r of rows) {
    if (r.type === "credit") {
      inKobo += r.amount_kobo;
    } else {
      outKobo += r.amount_kobo;
      spending.set(r.category, (spending.get(r.category) ?? 0) + r.amount_kobo);
    }
  }
  return {
    inKobo,
    outKobo,
    spending: [...spending].sort((a, b) => b[1] - a[1]).map(([category, kobo]) => ({ category, kobo })),
  };
}

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}
