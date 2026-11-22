export const CATEGORIES = [
  "Food & groceries",
  "Transport",
  "Airtime & data",
  "Bills & utilities",
  "Shopping",
  "Transfers",
  "Cash",
  "Fees & charges",
  "Salary",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// First match wins, so specific rules come before broad ones ("POS PURCHASE @ SHOPRITE" is food, not shopping).
const RULES: [Category, RegExp][] = [
  ["Fees & charges", /\b(charges?|fees?|sms alert|stamp duty|vat|maintenance)\b/i],
  ["Salary", /\b(salary|payroll|wages)\b/i],
  ["Airtime & data", /\b(airtime|data|recharge|vtu|mtn|glo|airtel|9mobile)\b/i],
  ["Bills & utilities", /\b(dstv|gotv|startimes|electricity|prepaid|ikedc|ekedc|aedc|phed|bills?|spectranet|internet)\b/i],
  ["Transport", /\b(uber|bolt|taxify|indrive|fuel|petrol|filling station|transport|brt)\b/i],
  ["Food & groceries", /\b(shoprite|spar|supermarket|restaurant|eatery|food|kfc|chicken republic|dominos?|market)\b/i],
  ["Cash", /\b(atm|cash|withdrawal|wdl)\b/i],
  ["Transfers", /\b(transfer|trf|trsf|nip|nibss)\b/i],
  ["Shopping", /\b(pos|purchase|jumia|konga|store|mall)\b/i],
];

export function categorize(narration: string, type: "credit" | "debit"): Category {
  for (const [category, pattern] of RULES) {
    if (!pattern.test(narration)) continue;
    if (category === "Salary" && type !== "credit") continue;
    return category;
  }
  return type === "credit" ? "Income" : "Other";
}
