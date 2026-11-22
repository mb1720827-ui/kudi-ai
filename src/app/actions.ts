"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { extractWithClaude } from "@/lib/llm-extract";
import { parseAlert } from "@/lib/parse-alert";
import { formatNaira } from "@/lib/summary";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  message?: string;
  /** What the user typed, so a failed submit doesn't wipe the field (React resets forms after actions). */
  value?: string;
}

const MAX_ALERT_CHARS = 2000;
// Caps AI calls per user per 24 hours so a public demo can't run up the API bill.
const AI_DAILY_LIMIT = 30;

export async function authenticate(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) {
    return { error: "Enter your email and a password of at least 8 characters.", value: email };
  }

  const supabase = await createClient();
  if (formData.get("intent") === "signup") {
    const origin = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return { error: error.message, value: email };
    if (!data.session) return { message: "Check your email and click the link to confirm your account.", value: email };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message, value: email };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function addAlert(_prev: FormState, formData: FormData): Promise<FormState> {
  const text = String(formData.get("alert") ?? "").trim();
  const fail = (error: string): FormState => ({ error, value: text });
  if (!text) return fail("Paste a bank alert first.");
  if (text.length > MAX_ALERT_CHARS) return fail(`Alerts can be at most ${MAX_ALERT_CHARS} characters.`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your session ended. Please sign in again.");

  let parsed = parseAlert(text);
  let source: "parser" | "ai" = "parser";
  if (!parsed) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("source", "ai")
      .gte("created_at", since);
    if ((count ?? 0) >= AI_DAILY_LIMIT) return fail("You've reached today's limit for AI-read alerts. Try again tomorrow.");

    try {
      parsed = await extractWithClaude(text);
    } catch (err) {
      console.error("AI extraction failed", err);
      return fail("The AI couldn't read this alert right now. Check ANTHROPIC_API_KEY or try again.");
    }
    if (!parsed) return fail("That doesn't look like a bank transaction alert.");
    source = "ai";
  }

  const { error } = await supabase.from("transactions").insert({
    type: parsed.type,
    amount_kobo: parsed.amountKobo,
    balance_kobo: parsed.balanceKobo,
    narration: parsed.narration,
    category: parsed.category,
    occurred_at: parsed.occurredAt ?? new Date().toISOString(),
    source,
    raw_text: text,
  });
  if (error) {
    console.error("Insert failed", error);
    return fail("Couldn't save this transaction. Please try again.");
  }

  revalidatePath("/");
  const how = source === "ai" ? "read by AI" : "read by rules";
  return { message: `Saved: ${parsed.type} of ${formatNaira(parsed.amountKobo)} (${parsed.category}, ${how}).` };
}
