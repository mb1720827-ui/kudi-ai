import { categorize, type Category } from "./categories";

export type TxnType = "credit" | "debit";

export interface ParsedAlert {
  type: TxnType;
  amountKobo: number;
  balanceKobo: number | null;
  narration: string;
  /** ISO 8601 in West Africa Time, or null when the alert has no readable date. */
  occurredAt: string | null;
  category: Category;
}

const NUM = String.raw`\d[\d,]*(?:\.\d{1,2})?`;
const CURRENCY = String.raw`(?:NGN|₦|\bN(?=\d))`;

const AMOUNT_LABELED = new RegExp(
  String.raw`(?:\b(DR|CR)[ \t]*)?\b(?:Amount|Amt)[ \t]*[:=]?[ \t]*${CURRENCY}?[ \t]*(${NUM})(?:[ \t]*(DR|CR)\b)?`,
  "i",
);
const CURRENCY_AMOUNT = new RegExp(String.raw`${CURRENCY}[ \t]?(${NUM})`, "i");
const BALANCE = new RegExp(
  String.raw`\b(?:Avail(?:able)?[ \t]*)?(?:Balance|Bal)[ \t]*[:=]?[ \t]*${CURRENCY}?[ \t]*(-?${NUM})(?:[ \t]*(?:CR|DR)\b)?`,
  "i",
);
const NARRATION = /\b(?:Description|Narration|Narr|Remarks?|Details|Desc|Des)[ \t]*[:=][ \t]*(.+)/i;
const DATE_LABELED = /\b(?:Txn Date|Date|DT|Time)[ \t]*[:=][ \t]*([^\n]+)/i;
const FIELD_LINE = /^(?:acct?|acc|ac|amt|amount|avail|bal|balance|date|dt|time|txn|total)\b/i;

const DEBIT_WORDS = /\b(?:debit(?:ed)?|DR|withdrawal|sent|paid|purchase|transfer to)\b/i;
const CREDIT_WORDS = /\b(?:credit(?:ed)?|CR|received|deposit(?:ed)?|transfer from)\b/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Reads a Nigerian bank alert (SMS, email or app notification) with plain rules.
 * Returns null when the amount or direction can't be found, so the caller can fall back to the AI.
 */
export function parseAlert(raw: string): ParsedAlert | null {
  const text = raw.trim();

  const bal = BALANCE.exec(text);
  const balanceKobo = bal ? toKobo(bal[1]) : null;
  // Drop the balance so its number and its CR/DR suffix can't be mistaken for the transaction.
  const rest = bal ? `${text.slice(0, bal.index)} ${text.slice(bal.index + bal[0].length)}` : text;

  let amountKobo: number | null = null;
  let type: TxnType | null = null;
  const labeled = AMOUNT_LABELED.exec(rest);
  if (labeled) {
    amountKobo = toKobo(labeled[2]);
    type = directionOf(labeled[1] ?? labeled[3]);
  } else {
    const plain = CURRENCY_AMOUNT.exec(rest);
    if (plain) amountKobo = toKobo(plain[1]);
  }
  type ??= typeFromWords(rest);
  if (!amountKobo || amountKobo <= 0 || !type) return null;

  const narration = (NARRATION.exec(text)?.[1] ?? firstFreeTextLine(text)).trim().slice(0, 200);
  const dateText = DATE_LABELED.exec(text)?.[1] ?? text;

  return {
    type,
    amountKobo,
    balanceKobo,
    narration,
    occurredAt: parseDate(dateText),
    category: categorize(narration || text, type),
  };
}

function toKobo(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function directionOf(token: string | undefined): TxnType | null {
  if (!token) return null;
  return token.toUpperCase() === "DR" ? "debit" : "credit";
}

function typeFromWords(text: string): TxnType | null {
  const debit = DEBIT_WORDS.exec(text)?.index ?? -1;
  const credit = CREDIT_WORDS.exec(text)?.index ?? -1;
  if (debit < 0 && credit < 0) return null;
  if (credit < 0) return "debit";
  if (debit < 0) return "credit";
  return debit < credit ? "debit" : "credit";
}

function firstFreeTextLine(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => !FIELD_LINE.test(l) && /[a-z]/i.test(l)) ?? "";
}

export function parseDate(s: string): string | null {
  let m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) return toIso(+m[1], +m[2], +m[3], m[4], m[5], m[6]);

  m = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ :]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i.exec(s);
  if (m) return toIso(+m[3], +m[2], +m[1], m[4], m[5], m[6], m[7]);

  m = /(\d{1,2})[ -](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[ ,-]*(\d{4})(?:[ :]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i.exec(s);
  if (m) return toIso(+m[3], MONTHS[m[2].toLowerCase()], +m[1], m[4], m[5], m[6], m[7]);

  return null;
}

function toIso(
  y: number, mo: number, d: number,
  hh = "0", mi = "0", ss = "0", ampm?: string,
): string | null {
  let h = Number(hh);
  if (ampm) h = (h % 12) + (ampm.toUpperCase() === "PM" ? 12 : 0);
  const min = Number(mi);
  const sec = Number(ss);
  if (mo < 1 || mo > 12 || h > 23 || min > 59 || sec > 59) return null;
  // Rejects dates like 31/02 that Date would silently roll over.
  if (new Date(Date.UTC(y, mo - 1, d)).getUTCDate() !== d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(min)}:${p(sec)}+01:00`;
}
