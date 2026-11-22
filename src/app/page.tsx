import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, monthStartWAT, summarize } from "@/lib/summary";
import { signOut } from "./actions";
import { AlertForm } from "./alert-form";
import { AuthForm } from "./auth-form";

const dateFormat = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});
const monthFormat = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "Africa/Lagos" });

const card = "rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950";

// The session lives in cookies, which are only known at request time, so the page streams in behind Suspense.
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center text-zinc-500">Loading…</main>}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { error } = await searchParams;
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kudi AI</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Paste your bank alerts. Kudi reads them, sorts your spending into categories and shows where your money
            went this month.
          </p>
        </div>
        {error === "confirm" && (
          <p role="alert" className="text-sm text-rose-600">
            That confirmation link didn&apos;t work. It may have expired, so try signing up again.
          </p>
        )}
        <AuthForm />
      </main>
    );
  }

  const [recent, month] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, type, amount_kobo, narration, category, occurred_at, source")
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase.from("transactions").select("type, amount_kobo, category").gte("occurred_at", monthStartWAT()),
  ]);
  const summary = summarize(month.data ?? []);
  const topSpend = summary.spending[0]?.kobo ?? 0;
  const loadError = recent.error ?? month.error;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Kudi AI</h1>
        <form action={signOut} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="hidden truncate sm:inline">{user.email}</span>
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Sign out
          </button>
        </form>
      </header>

      <section className={card}>
        <AlertForm />
      </section>

      {loadError && (
        <p role="alert" className="text-sm text-rose-600">
          Couldn&apos;t load your transactions. Check that the database table exists (see the README).
        </p>
      )}

      <section className={card}>
        <h2 className="font-semibold">{monthFormat.format(new Date())}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-zinc-500">Money in</dt>
            <dd className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">{formatNaira(summary.inKobo)}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Money out</dt>
            <dd className="text-xl font-semibold text-rose-600">{formatNaira(summary.outKobo)}</dd>
          </div>
        </dl>
        {summary.spending.length > 0 && (
          <ul className="mt-5 flex flex-col gap-2">
            {summary.spending.map((s) => (
              <li key={s.category} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_auto]">
                <span className="truncate">{s.category}</span>
                <span className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <span
                    className="block h-2 rounded-full bg-rose-500"
                    style={{ width: `${Math.max(4, (s.kobo / topSpend) * 100)}%` }}
                  />
                </span>
                <span className="tabular-nums">{formatNaira(s.kobo)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-semibold">Recent transactions</h2>
        {recent.data && recent.data.length > 0 ? (
          <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {recent.data.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.narration || t.category}</p>
                  <p className="text-sm text-zinc-500">
                    {t.category} · {dateFormat.format(new Date(t.occurred_at))}
                    {t.source === "ai" && " · read by AI"}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${t.type === "credit" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"}`}
                >
                  {t.type === "credit" ? "+" : "−"}
                  {formatNaira(t.amount_kobo)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No transactions yet. Paste an alert above, or press “Try a sample”.</p>
        )}
      </section>
    </main>
  );
}
