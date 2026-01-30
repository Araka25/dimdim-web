export default function MonthlyReportsPage() {
  return (
    <section>
      <h1>Relatório Mensal</h1>
      <p>Em construção…</p>
    </section>
  );
}
'use client';

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
} from 'recharts';

type Tx = {
  occurred_at: string;
  kind: 'income' | 'expense';
  amount_cents: number;
  category_id: string | null;
};

type Category = { id: string; name: string };

export default function MonthlyReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [txs, setTxs] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const startEnd = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0);
    return { start, end };
  }, [month]);

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
  }, [month]);

  const income = useMemo(
    () => txs.filter((t) => t.kind === 'income').reduce((a, t) => a + (t.amount_cents || 0), 0),
    [txs]
  );
  const expense = useMemo(
    () => txs.filter((t) => t.kind === 'expense').reduce((a, t) => a + (t.amount_cents || 0), 0),
    [txs]
  );
  const balance = income - expense;

  const savingsRate = useMemo(() => {
    if (income <= 0) return null;
    return (balance / income) * 100;
  }, [income, balance]);

  const expenseByCategory = useMemo(() => {
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const map = new Map<string, number>();

    for (const t of txs) {
      if (t.kind !== 'expense') continue;
      const key = t.category_id ? nameById.get(t.category_id) ?? 'Sem categoria' : 'Sem categoria';
      map.set(key, (map.get(key) || 0) + t.amount_cents);
    }

    return Array.from(map.entries())
      .map(([name, cents]) => ({ name, value: cents / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [txs, categories]);

  const dailyBalance = useMemo(() => {
    const daysInMonth = new Date(startEnd.end.getTime() - 1).getDate();
    const byDay = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      delta: 0,
    }));

    for (const t of txs) {
      const d = new Date(t.occurred_at);
      const day = d.getDate();
      const sign = t.kind === 'income' ? 1 : -1;
      if (day >= 1 && day <= daysInMonth) byDay[day - 1].delta += sign * (t.amount_cents || 0);
    }

    let acc = 0;
    return byDay.map((x) => {
      acc += x.delta;
      return { day: x.day, saldo: acc / 100 };
    });
  }, [txs, startEnd]);
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatório Mensal</h1>
          <p className="text-sm text-white/60">Resumo + gráficos do mês selecionado</p>
        </div>

        <label className="text-sm text-white/70">
          Mês:{' '}
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

      <div className="grid gap-3 md:grid-cols-4">
        <Card title="Entradas">{fmtBRL(income)}</Card>
        <Card title="Saídas">{fmtBRL(expense)}</Card>
        <Card title="Saldo">{fmtBRL(balance)}</Card>
        <Card title="Taxa de poupança">{savingsRate == null ? '—' : `${savingsRate.toFixed(1)}%`}</Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm text-white/70">Gastos por categoria (Top 10)</div>
          <div className="h-72">
            {loading ? (
              <div className="text-sm text-white/60">Carregando…</div>
            ) : expenseByCategory.length === 0 ? (
              <div className="text-sm text-white/60">Sem gastos no mês.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: any) =>
                      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    }
                    contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                  <Bar dataKey="value" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm text-white/70">Saldo acumulado no mês</div>
          <div className="h-72">
            {loading ? (
              <div className="text-sm text-white/60">Carregando…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyBalance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: any) =>
                      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    }
                    contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.15)' }}
                  />
                  <Line type="monotone" dataKey="saldo" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
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
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

