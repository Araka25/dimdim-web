'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: 'income' | 'expense' };
type KindFilter = '' | 'income' | 'expense';

type Totals = { income_cents: number; expense_cents: number; net_cents: number };
type TopCatRow = { category_id: string; total_cents: number };
type TopCatUi = { id: string; name: string; total_cents: number };

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function currentYYYYMM() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function monthRangeUTC(yyyyMM: string) {
  const [yStr, mStr] = yyyyMM.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

const COLORS_EXPENSE = ['#f87171', '#fb7185', '#fda4af', '#fecdd3', '#ef4444', '#f97316', '#f59e0b', '#eab308'];
const COLORS_INCOME = ['#34d399', '#10b981', '#6ee7b7', '#a7f3d0', '#22c55e', '#14b8a6', '#2dd4bf', '#5eead4'];

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-neutral-950/95 p-3 text-sm shadow-xl">
      <div className="text-xs text-white/60 mb-1">Categoria</div>
      <div className="text-sm text-white/90 font-medium">{p.name}</div>
      <div className="mt-2 flex items-center justify-between gap-6">
        <span className="text-white/70">Total</span>
        <span className="text-white/90 font-semibold">{fmtBRL(Number(p.total_cents || 0))}</span>
      </div>
    </div>
  );
}

export default function MonthlyReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [month, setMonth] = useState<string>(() => currentYYYYMM());
  const [accountId, setAccountId] = useState<string>('');
  const [kind, setKind] = useState<KindFilter>('');
  const [search, setSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(''); // filtro por categoria (clicável)

  const [totals, setTotals] = useState<Totals>({ income_cents: 0, expense_cents: 0, net_cents: 0 });
  const [topExpenseCats, setTopExpenseCats] = useState<TopCatUi[]>([]);
  const [topIncomeCats, setTopIncomeCats] = useState<TopCatUi[]>([]);

  const maxTopExpense = useMemo(() => Math.max(1, ...topExpenseCats.map((x) => x.total_cents)), [topExpenseCats]);
  const maxTopIncome = useMemo(() => Math.max(1, ...topIncomeCats.map((x) => x.total_cents)), [topIncomeCats]);

  const expensePieData = useMemo(() => {
    return topExpenseCats.map((c) => ({ ...c, value: c.total_cents }));
  }, [topExpenseCats]);

  const incomePieData = useMemo(() => {
    return topIncomeCats.map((c) => ({ ...c, value: c.total_cents }));
  }, [topIncomeCats]);

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

      // lookups
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

      const { startIso, endIso } = monthRangeUTC(month);
      const searchTrim = search.trim() || null;

      // totals via RPC (respeitando categoria)
      const totalsRes = await supabase.rpc('transactions_totals', {
        p_user_id: userId,
        p_start: startIso,
        p_end: endIso,
        p_account_id: accountId || null,
        p_category_id: categoryId || null,
        p_kind: kind || null,
        p_search: searchTrim,
      });

      if (totalsRes.error) throw new Error(totalsRes.error.message);

      const trow = Array.isArray(totalsRes.data) ? totalsRes.data[0] : totalsRes.data;
      setTotals({
        income_cents: Number(trow?.income_cents ?? 0),
        expense_cents: Number(trow?.expense_cents ?? 0),
        net_cents: Number(trow?.net_cents ?? 0),
      });

      // top categories (não depende do filtro de categoria — serve pra clicar e trocar)
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

      setTopExpenseCats(
        (((topExp.data as TopCatRow[]) || [])).map((r) => ({
          id: r.category_id,
          name: catMap.get(r.category_id) || 'Sem categoria',
          total_cents: Number(r.total_cents ?? 0),
        }))
      );

      setTopIncomeCats(
        (((topInc.data as TopCatRow[]) || [])).map((r) => ({
          id: r.category_id,
          name: catMap.get(r.category_id) || 'Sem categoria',
          total_cents: Number(r.total_cents ?? 0),
        }))
      );
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
      setTotals({ income_cents: 0, expense_cents: 0, net_cents: 0 });
      setTopExpenseCats([]);
      setTopIncomeCats([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, accountId, kind, search, categoryId]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios (Mês)</h1>
          <p className="text-sm text-white/60">Resumo do mês filtrado</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Entradas</div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">{fmtBRL(totals.income_cents)}</div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Saídas</div>
            <div className="mt-1 text-lg font-semibold text-red-300">{fmtBRL(totals.expense_cents)}</div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Líquido</div>
            <div className="mt-1 text-lg font-semibold text-white/90">{fmtBRL(totals.net_cents)}</div>
          </div>
        </div>
      </div>

      {/* filtros */}
      <div className="grid grid-cols-1 gap-3 rounded border border-white/10 bg-white/5 p-4 md:grid-cols-12">
        <div className="md:col-span-3">
          <div className="text-xs text-white/60 mb-1">Mês</div>
          <input
            type="month"
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <div className="md:col-span-3">
          <div className="text-xs text-white/60 mb-1">Tipo</div>
          <select
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
          >
            <option value="">(Todos)</option>
            <option value="income">Entrada</option>
            <option value="expense">Saída</option>
          </select>
        </div>

        <div className="md:col-span-3">
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

        <div className="md:col-span-3">
          <div className="text-xs text-white/60 mb-1">Buscar (descrição)</div>
          <input
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ex: mercado, uber, aluguel..."
          />
        </div>

        <div className="md:col-span-6">
          <div className="text-xs text-white/60 mb-1">Categoria (filtro)</div>
          <select
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">(Todas)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6 flex items-end">
          <button
            type="button"
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm text-white/80 hover:bg-white/10"
            onClick={() => setCategoryId('')}
          >
            Limpar categoria
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {/* Donuts */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Saídas por categoria</div>
            <div className="text-xs text-white/50">toque para filtrar</div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/60">Carregando…</div>
          ) : expensePieData.length === 0 ? (
            <div className="mt-3 text-sm text-white/60">Sem dados.</div>
          ) : (
            <div className="mt-3 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<DonutTooltip />} />
                  <Pie
                    data={expensePieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="85%"
                    paddingAngle={2}
                    onClick={(d: any) => d?.id && setCategoryId(String(d.id))}
                  >
                    {expensePieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS_EXPENSE[idx % COLORS_EXPENSE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-2 text-xs text-white/50">
            {categoryId ? <>Filtro ativo: <span className="text-white/80">{categories.find(c => c.id === categoryId)?.name ?? 'categoria'}</span></> : 'Sem filtro de categoria.'}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Entradas por categoria</div>
            <div className="text-xs text-white/50">toque para filtrar</div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/60">Carregando…</div>
          ) : incomePieData.length === 0 ? (
            <div className="mt-3 text-sm text-white/60">Sem dados.</div>
          ) : (
            <div className="mt-3 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<DonutTooltip />} />
                  <Pie
                    data={incomePieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="85%"
                    paddingAngle={2}
                    onClick={(d: any) => d?.id && setCategoryId(String(d.id))}
                  >
                    {incomePieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS_INCOME[idx % COLORS_INCOME.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-2 text-xs text-white/50">
            {categoryId ? <>Filtro ativo: <span className="text-white/80">{categories.find(c => c.id === categoryId)?.name ?? 'categoria'}</span></> : 'Sem filtro de categoria.'}
          </div>
        </div>
      </div>

      {/* Listas com barras (mantém, é útil) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Top categorias (Saídas)</div>
            <div className="text-xs text-white/50">toque para filtrar</div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/60">Carregando…</div>
          ) : topExpenseCats.length === 0 ? (
            <div className="mt-3 text-sm text-white/60">Sem dados.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {topExpenseCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={
                    'w-full text-left space-y-1 rounded-lg p-2 -m-2 transition hover:bg-white/5 ' +
                    (categoryId === c.id ? 'ring-1 ring-[#D4AF37]/60 bg-white/5' : '')
                  }
                  title="Filtrar por esta categoria"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm text-white/80 truncate">{c.name}</div>
                    <div className="text-sm text-red-200">{fmtBRL(c.total_cents)}</div>
                  </div>
                  <div className="h-2 rounded bg-white/10 overflow-hidden">
                    <div
                      className="h-2 rounded bg-red-400/60"
                      style={{ width: `${Math.max(4, Math.round((c.total_cents / maxTopExpense) * 100))}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Top categorias (Entradas)</div>
            <div className="text-xs text-white/50">toque para filtrar</div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/60">Carregando…</div>
          ) : topIncomeCats.length === 0 ? (
            <div className="mt-3 text-sm text-white/60">Sem dados.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {topIncomeCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={
                    'w-full text-left space-y-1 rounded-lg p-2 -m-2 transition hover:bg-white/5 ' +
                    (categoryId === c.id ? 'ring-1 ring-[#D4AF37]/60 bg-white/5' : '')
                  }
                  title="Filtrar por esta categoria"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm text-white/80 truncate">{c.name}</div>
                    <div className="text-sm text-emerald-200">{fmtBRL(c.total_cents)}</div>
                  </div>
                  <div className="h-2 rounded bg-white/10 overflow-hidden">
                    <div
                      className="h-2 rounded bg-emerald-400/60"
                      style={{ width: `${Math.max(4, Math.round((c.total_cents / maxTopIncome) * 100))}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}