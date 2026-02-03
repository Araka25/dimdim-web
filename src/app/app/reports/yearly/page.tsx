"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const YearlyCharts = dynamic(() => import("@/components/YearlyCharts").then((m) => m.default), { ssr: false });

type Tx = {
  occurred_at: string;
  kind: "income" | "expense";
  amount_cents: number;
  category_id: string | null;
};

type Category = { id: string; name: string };

export default function YearlyReportsPage() {
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(() => String(currentYear));
  const [txs, setTxs] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const startEnd = useMemo(() => {
    const y = Number(year);
    const safeYear = Number.isFinite(y) ? y : currentYear;
    const start = new Date(safeYear, 0, 1, 0, 0, 0, 0);
    const end = new Date(safeYear + 1, 0, 1, 0, 0, 0, 0);
    return { start, end, safeYear };
  }, [year, currentYear]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const supabase = supabaseBrowser();
      const [catsRes, txRes] = await Promise.all([
        supabase.from("categories").select("id,name"),
        supabase
          .from("transactions")
          .select("occurred_at,kind,amount_cents,category_id")
          .gte("occurred_at", startEnd.start.toISOString())
          .lt("occurred_at", startEnd.end.toISOString()),
      ]);

      if (catsRes.error) setError(catsRes.error.message);
      if (txRes.error) setError(txRes.error.message);

      setCategories((catsRes.data as Category[]) || []);
      setTxs((txRes.data as Tx[]) || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startEnd.safeYear]);

  const monthly = useMemo(() => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));

    for (const t of txs) {
      const d = new Date(t.occurred_at);
      const m = d.getMonth();
      const cents = t.amount_cents || 0;
      if (t.kind === "income") rows[m].income += cents;
      else rows[m].expense += cents;
    }

    return rows.map((r) => ({
      month: String(r.month).padStart(2, "0"),
      income: r.income / 100,
      expense: r.expense / 100,
      balance: (r.income - r.expense) / 100,
    }));
  }, [txs]);

  const topCategories = useMemo(() => {
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const map = new Map<string, number>();

    for (const t of txs) {
      if (t.kind !== "expense") continue;
      const key = t.category_id ? nameById.get(t.category_id) ?? "Sem categoria" : "Sem categoria";
      map.set(key, (map.get(key) || 0) + (t.amount_cents || 0));
    }

    return Array.from(map.entries())
      .map(([name, cents]) => ({ name, value: cents / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [txs, categories]);
  const totals = useMemo(() => {
    const incomeCents = txs.filter((t) => t.kind === "income").reduce((a, t) => a + (t.amount_cents || 0), 0);
    const expenseCents = txs.filter((t) => t.kind === "expense").reduce((a, t) => a + (t.amount_cents || 0), 0);
    const balanceCents = incomeCents - expenseCents;
    const savingsRate = incomeCents > 0 ? (balanceCents / incomeCents) * 100 : null;
    return { incomeCents, expenseCents, balanceCents, savingsRate };
  }, [txs]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatório Anual</h1>
          <p className="text-sm text-white/60">Entradas/saídas por mês + top categorias</p>
        </div>

        <label className="text-sm text-white/70">
          Ano:{" "}
          <input
            type="number"
            value={year}
            min="2000"
            max="2100"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setYear(v || String(currentYear));
            }}
            className="ml-2 w-28 rounded border border-white/15 bg-black/20 p-2"
          />
        </label>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Card title="Entradas (ano)">{fmtBRL(totals.incomeCents)}</Card>
        <Card title="Saídas (ano)">{fmtBRL(totals.expenseCents)}</Card>
        <div className="rounded border border-white/10 bg-white/5 p-4">
  <div className="text-xs text-white/60">Saldo (ano)</div>
  <div className={"mt-2 text-xl font-semibold " + (totals.balanceCents >= 0 ? "text-green-400" : "text-red-400")}>
    {fmtBRL(totals.balanceCents)}
  </div>
</div>
        <Card title="Taxa de poupança">{fmtPercent(totals.savingsRate)}</Card>
      </div>

      <YearlyCharts loading={loading} monthly={monthly} topCategories={topCategories} />
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/60">{title}</div>
      <div className="mt-2 text-xl font-semibold">{children}</div>
    </div>
  );
}

function fmtBRL(cents: number) {
  const value = cents / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPercent(v: number | null) {
  if (v === null) return "—";
  return v.toFixed(1) + "%";
}
