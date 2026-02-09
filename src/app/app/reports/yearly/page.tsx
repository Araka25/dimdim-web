'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Account = { id: string; name: string };

type Totals = { income_cents: number; expense_cents: number; net_cents: number };

type ByMonthRow = {
  month: number; // 1..12
  income_cents: number;
  expense_cents: number;
  net_cents: number;
};

type TopCatRow = { category_id: string; total_cents: number };
type Category = { id: string; name: string; kind: 'income' | 'expense' };

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function yearNowUTC() {
  return new Date().getUTCFullYear();
}

function yearRangeUTC(year: number) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)).toISOString();
  return { startIso: start, endIso: end };
}

function monthLabel(m: number) {
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return labels[m - 1] ?? String(m);
}

export default function YearlyReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [year, setYear] = useState<number>(() => yearNowUTC());
  const [accountId, setAccountId] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const [byMonth, setByMonth] = useState<ByMonthRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ income_cents: 0, expense_cents: 0, net_cents: 0 });
TypeScript


const [topExpense, setTopExpense] = useState<Array<{ name: string; total_cents: number }>>([]);
  const [topIncome, setTopIncome] = useState<Array<{ name: string; total_cents: number }>>([]);

  const maxBar = useMemo(() => {
    const max = Math.max(
      1,
      ...byMonth.map((r) => Math.max(r.income_cents, r.expense_cents))
    );
    return max;
  }, [byMonth]);

  async function getUserIdOrError(client: any) {
    const { data, error } = await client.auth.getUser();
    if (error) throw new Error(error.message);
    const uid = data.user?.id;
    if (!uid) throw new Error('Sessão expirada. Faça login novamente.');
    return uid;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const supabase = supabaseBrowser();
      const userId = await getUserIdOrError(supabase);

      // lookups (accounts + categories)
      const [a, c] = await Promise.all([
        supabase.from('accounts').select('id,name').order('created_at', { ascending: false }),
        supabase.from('categories').select('id,name,kind').order('created_at', { ascending: false }),
      ]);

      if (a.error) throw new Error(a.error.message);
      if (c.error) throw new Error(c.error.message);

      const accountsData = (a.data as Account[]) || [];
      const categoriesData = (c.data as Category[]) || [];
      setAccounts(accountsData);
      setCategories(categoriesData);

      const searchTrim = search.trim() || null;
      const { startIso, endIso } = yearRangeUTC(year);

      // 1) by month (RPC nova)
      const bm = await supabase.rpc('transactions_yearly_by_month', {
        p_user_id: userId,
        p_year: year,
        p_account_id: accountId || null,
        p_search: searchTrim,
      });
      if (bm.error) throw new Error(bm.error.message);

      const bmRows = ((bm.data as any[]) || []).map((r) => ({
        month: Number(r.month),
        income_cents: Number(r.income_cents ?? 0),
        expense_cents: Number(r.expense_cents ?? 0),
        net_cents: Number(r.net_cents ?? 0),
      })) as ByMonthRow[];

      setByMonth(bmRows);

      // totals do ano (somando os meses)
      const t = bmRows.reduce(
        (acc, r) => ({
          income_cents: acc.income_cents + r.income_cents,
          expense_cents: acc.expense_cents + r.expense_cents,
          net_cents: acc.net_cents + r.net_cents,
        }),
        { income_cents: 0, expense_cents: 0, net_cents: 0 }
      );
      setTotals(t);

      // 2) top categories do ano (reutiliza RPC existente)
      const catMap = new Map(categoriesData.map((x) => [x.id, x.name]));

      const [topExp, topInc] = await Promise.all([
        supabase.rpc('transactions_top_categories', {
          p_user_id: userId,
          p_start: startIso,
          p_end: endIso,
          p_account_id: accountId || null,
          p_kind: 'expense',
          p_search: searchTrim,
          p_limit: 8,
        }),
        supabase.rpc('transactions_top_categories', {
          p_user_id: userId,
          p_start: startIso,
          p_end: endIso,
          p_account_id: accountId || null,
          p_kind: 'income',
          p_search: searchTrim,
          p_limit: 8,
        }),
      ]);

      if (topExp.error) throw new Error(topExp.error.message);
      if (topInc.error) throw new Error(topInc.error.message);

      setTopExpense(
        (((topExp.data as TopCatRow[]) || [])).map((r) => ({
          name: catMap.get(r.category_id) || 'Sem categoria',
          total_cents: Number(r.total_cents ?? 0),
        }))
      );

      setTopIncome(
        (((topInc.data as TopCatRow[]) || [])).map((r) => ({
          name: catMap.get(r.category_id) || 'Sem categoria',
          total_cents: Number(r.total_cents ?? 0),
        }))
      );
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
      setByMonth([]);
      setTopExpense([]);
      setTopIncome([]);setTotals({ income_cents: 0, expense_cents: 0, net_cents: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, accountId, search]);return(
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios (Ano)</h1>
          <p className="text-sm text-white/60">Resumo mensal de entradas e saídas</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/60">Entradas</div>
            <div className="text-emerald-300 font-semibold">{fmtBRL(totals.income_cents)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/60">Saídas</div>
            <div className="text-red-300 font-semibold">{fmtBRL(totals.expense_cents)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/60">Líquido</div>
            <div className="text-white/90 font-semibold">{fmtBRL(totals.net_cents)}</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded border border-white/10 bg-white/5 p-4 md:grid-cols-12">
        <div className="md:col-span-2">
          <div className="text-xs text-white/60 mb-1">Ano</div>
          <input
            type="number"
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>

        <div className="md:col-span-4">
          <div className="text-xs text-white/60 mb-1">Conta</div>
          <select
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">(Todas)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6">
          <div className="text-xs text-white/60 mb-1">Buscar (descrição)</div>
          <input
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ex: mercado, uber, aluguel..."
          />
        </div>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {/* Gráfico */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Entradas x Saídas (por mês)</div>
          <div className="text-xs text-white/50">{year}</div>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-white/60">Carregando…</div>
        ) : byMonth.length === 0 ? (
          <div className="mt-4 text-sm text-white/60">Sem dados para este ano/filtro.</div>
        ) : (
          <div className="mt-4 grid grid-cols-12 gap-2 items-end">
            {byMonth.map((r) => (
              <div key={r.month} className="col-span-2 sm:col-span-1">
                <div className="h-24 rounded bg-white/5 flex items-end gap-1 px-1 py-1">
                  <div
                    className="w-1/2 rounded bg-emerald-400/70"
                    style={{ height: `${Math.max(2, Math.round((r.income_cents / maxBar) * 100))}%` }}
                    title={`Entradas: ${fmtBRL(r.income_cents)}`}
                  />
                  <div
                    className="w-1/2 rounded bg-red-400/70"
                    style={{ height: `${Math.max(2, Math.round((r.expense_cents / maxBar) * 100))}%` }}title={`Saídas: ${fmtBRL(r.expense_cents)}`}
                  />
                </div>
                <div className="mt-1 text-center text-[11px] text-white/60">{monthLabel(r.month)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-3 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded bg-emerald-400/70" />
            Entradas
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded bg-red-400/70" />
            Saídas
          </div>
        </div>
      </div>

      {/* Top categorias do ano */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Top categorias (Saídas)</div>
            <div className="text-xs text-white/50">{year}</div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/60">Carregando…</div>
          ) : topExpense.length === 0 ? (
            <div className="mt-3 text-sm text-white/60">Sem dados.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {topExpense.map((c, idx) => (
                <div key={idx} className="flex items-baseline justify-between gap-3">
                  <div className="text-sm text-white/80 truncate">{c.name}</div>
                  <div className="text-sm text-red-200">{fmtBRL(c.total_cents)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Top categorias (Entradas)</div>
            <div className="text-xs text-white/50">{year}</div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/60">Carregando…</div>
          ) : topIncome.length === 0 ? (
            <div className="mt-3 text-sm text-white/60">Sem dados.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {topIncome.map((c, idx) => (
                <div key={idx} className="flex items-baseline justify-between gap-3">
                  <div className="text-sm text-white/80 truncate">{c.name}</div>
                  <div className="text-sm text-emerald-200">{fmtBRL(c.total_cents)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}