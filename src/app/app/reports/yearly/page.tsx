"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';

type Tx = {
  occurred_at: string;
  kind: 'income' | 'expense';
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

  async function load() {
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const [catsRes, txRes] = await Promise.all([
      supabase.from('categories').select('id,name'),
      supabase
        .from('transactions')
        .select('occurred_at,kind,amount_cents,category_id')
        .gte('occurred_at', startEnd.start.toISOString())
        .lt('occurred_at', startEnd.end.toISOString()),
    ]);

    if (catsRes.error) setError(catsRes.error.message);
    if (txRes.error) setError(txRes.error.message);

    setCategories((catsRes.data as Category[]) || []);
    setTxs((txRes.data as Tx[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startEnd.safeYear]);

  const monthly = useMemo(() => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0,
    }));

    for (const t of txs) {
      const d = new Date(t.occurred_at);
      const m = d.getMonth();
      const cents = t.amount_cents || 0;
      if (t.kind === 'income') rows[m].income += cents;
      else rows[m].expense += cents;
    }

    return rows.map((r) => ({
      month: String(r.month).padStart(2, '0'),
      income: r.income / 100,
      expense: r.expense / 100,
      balance: (r.income - r.expense) / 100,
    }));
  }, [txs]);

  const topCategories = useMemo(() => {
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const map = new Map<string, number>();

    for (const t of txs) {
      if (t.kind !== 'expense') continue;
      const key = t.category_id ? nameById.get(t.category_id) ?? 'Sem categoria' : 'Sem categoria';
      map.set(key, (map.get(key) || 0) + (t.amount_cents || 0));
    }

    return Array.from(map.entries())
      .map(([name, cents]) => ({ name, value: cents / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [txs, categories]);
  (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatório Anual</h1>
          <p className="text-sm text-white/60">Entradas/saídas por mês + top categorias</p>
        </div>

        <label className="text-sm text-white/70">
          Ano:{' '}
          <input
            type="number"
            value={year}
            min="2000"
            max="2100"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              setYear(v || String(currentYear));
            }}
            className="ml-2 w-28 rounded border border-white/15 bg-black/20 p-2"
          />
        </label>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm text-white/70">Entradas vs Saídas (por mês)</div>
          <div className="h-72 min-w-0">
            {loading ? (
              <div className="text-sm text-white/60">Carregando…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: any) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Entradas" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Saídas" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm text-white/70">Saldo mensal (por mês)</div>
          <div className="h-72 min-w-0 min-h-[288px]">
            {loading ? (
              <div className="text-sm text-white/60">Carregando…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: any) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                  <Line type="monotone" dataKey="balance" name="Saldo" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-4">
        <div className="mb-2 text-sm text-white/70">Top 5 categorias (Saídas no ano)</div>
        <div className="h-64 min-w-0 min-h-[256px]">
          {loading ? (
            <div className="text-sm text-white/60">Carregando…</div>
          ) : topCategories.length === 0 ? (
            <div className="text-sm text-white/60">Sem saídas no ano.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategories} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                <Tooltip
                  formatter={(v: any) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.15)' }}
                />
                <Bar dataKey="value" fill="#D4AF37" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

