"use client"

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Tx = {
  occurred_at: string;
  kind: "income" | "expense";
  amount_cents: number;
  category_id: string | null;
};

type Budget = {
  category_id: string;
  limit_cents: number;
  month_date: string;
};

export default function MonthlyReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [txs, setTxs] = useState<Tx[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const monthDate = useMemo(() => `${month}-01`, [month]);

  const startEnd = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0);
    return { start, end };
  }, [month]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const supabase = supabaseBrowser();

      const [txRes, budRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("occurred_at,kind,amount_cents,category_id")
          .gte("occurred_at", startEnd.start.toISOString())
          .lt("occurred_at", startEnd.end.toISOString()),
        supabase.from("budgets").select("category_id,limit_cents,month_date").eq("month_date", monthDate),
      ]);

      if (txRes.error) setError(txRes.error.message);
      if (budRes.error) setError(budRes.error.message);

      setTxs((txRes.data as Tx[]) || []);
      setBudgets((budRes.data as Budget[]) || []);
      setLoading(false);
    })();
  }, [month, monthDate, startEnd.start, startEnd.end]);

  const income = useMemo(
    () => txs.filter((t) => t.kind === "income").reduce((a, t) => a + (t.amount_cents || 0), 0),
    [txs]
  );
  const expense = useMemo(
    () => txs.filter((t) => t.kind === "expense").reduce((a, t) => a + (t.amount_cents || 0), 0),
    [txs]
  );
  const balance = income - expense;
  return (
    <section className="space-y-4">
      <div className="rounded bg-yellow-500 text-black p-3 font-semibold">
        DEBUG OK: Relatório Mensal está renderizando
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatório Mensal</h1>
          <p className="text-sm text-white/60">Versão debug (sem gráficos)</p>
        </div>

        <label className="text-sm text-white/70">
          Mês:{" "}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ml-2 rounded border border-white/15 bg-black/20 p-2"
          />
        </label>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="text-sm text-white/70">
        loading={String(loading)} txs={txs.length} budgets={budgets.length} monthDate={monthDate}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-white/10 bg-white/5 p-4">Entradas: {(income / 100).toFixed(2)}</div>
        <div className="rounded border border-white/10 bg-white/5 p-4">Saídas: {(expense / 100).toFixed(2)}</div>
        <div className="rounded border border-white/10 bg-white/5 p-4">Saldo: {(balance / 100).toFixed(2)}</div>
      </div>
    </section>
  );
}
