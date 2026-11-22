"use client";

import { useActionState, useRef } from "react";
import { addAlert, type FormState } from "./actions";

const SAMPLES = [
  "Acct: 012****789\nAmt: NGN5,000.00 DR\nDesc: POS PURCHASE @ SHOPRITE LEKKI\nAvail Bal: NGN45,210.50\nDate: 2026-11-20 14:32",
  "Txn: Credit\nAc:20XXXXXX12\nAmt:NGN 150,000.00\nDes:SALARY NOV 2026\nDate:20-Nov-2026 10:15\nBal:NGN 155,500.00",
  "Debit\nAmt:NGN2,500.00\nAcc:123**789\nDesc:AIRTIME/MTN/08012345678\nTime:20/11/2026 10:15\nAvail Bal:NGN12,000.00",
];

export function AlertForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addAlert, {});
  const textRef = useRef<HTMLTextAreaElement>(null);
  const sampleIndex = useRef(0);

  function fillSample() {
    if (!textRef.current) return;
    textRef.current.value = SAMPLES[sampleIndex.current % SAMPLES.length];
    sampleIndex.current += 1;
    textRef.current.focus();
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="alert" className="text-sm font-medium">
        Paste a bank alert (SMS, email or app notification)
      </label>
      <textarea
        id="alert"
        ref={textRef}
        name="alert"
        rows={5}
        maxLength={2000}
        required
        defaultValue={state.value}
        placeholder={"Acct: 012****789\nAmt: NGN5,000.00 DR\nDesc: POS PURCHASE ..."}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {state.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{state.message}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending}
          className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? "Reading…" : "Add transaction"}
        </button>
        <button
          type="button"
          onClick={fillSample}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Try a sample
        </button>
      </div>
    </form>
  );
}
