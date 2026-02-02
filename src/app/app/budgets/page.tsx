'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Category = { id: string; name: string; kind: 'income' | 'expense' };

type BudgetRow = {
  id: string;
  month_date: string;      // 'YYYY-MM-01'
  category_id: string;
  limit_cents: number;
};

function monthStart(month: string) {
  // month: 'YYYY-MM'
  return `${month}-01`;
}

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BudgetsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [limit, setLimit] = useState(''); // ex: 500,00

  const month_date = useMemo(() => monthStart(month), [month]);

  async function load() {
    setLoading(true);
    setError(null);
    const supabase = supabaseBrowser();

    const [catsRes, budRes] = await Promise.all([
      supabase.from('categories').select('id,name,kind').order('name', { ascending: true }),
      supabase.from('budgets').select('id,month_date,category_id,limit_cents').eq('month_date', month_date),
    ]);

    if (catsRes.error) setError(catsRes.error.message);
    if (budRes.error) setError(budRes.error.message);

    // orçamento só para categorias de saída (mais comum)
    const cats = ((catsRes.data as Category[]) || []).filter((c) => c.kind === 'expense');

    setCategories(cats);
    setBudgets((budRes.data as BudgetRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month_date]);

  async function upsertBudget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedCategoryId) return setError('Selecione uma categoria');

    const cents = Math.round(Number(limit.replace(/\./g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents < 0) return setError('Limite inválido');

    const supabase = supabaseBrowser();
    const { error } = await supabase.from('budgets').upsert({
      month_date,
      category_id: selectedCategoryId,
      limit_cents: cents,
    });

    if (error) return setError(error.message);

    setSelectedCategoryId('');
    setLimit('');
    await load();
  }

  async function removeBudget(id: string) {
    if (!confirm('Remover este orçamento?')) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) return setError(error.message);
    await load();
  }
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Orçamentos</h1>
          <p className="text-sm text-white/60">Defina limite mensal por categoria (saídas)</p>
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

      <form onSubmit={upsertBudget} className="grid gap-3 rounded border border-white/10 bg-white/5 p-4 md:grid-cols-6">
        <select
          className="rounded border border-white/15 bg-black/20 p-3 md:col-span-3"
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
        >
          <option value="">(Categoria de saída)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          className="rounded border border-white/15 bg-black/20 p-3 md:col-span-2"
          placeholder="Limite (ex: 500,00)"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />

        <button className="rounded bg-white px-4 text-black">Salvar</button>
      </form>

      <div className="rounded border border-white/10 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
          <div className="col-span-7">Categoria</div>
          <div className="col-span-3 text-right">Limite</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-white/60">Carregando…</div>
        ) : budgets.length === 0 ? (
          <div className="p-4 text-sm text-white/60">Nenhum orçamento definido para este mês.</div>
        ) : (
          budgets.map((b) => {
            const cat = categories.find((c) => c.id === b.category_id);
            return (
              <div key={b.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5">
                <div className="col-span-7 text-sm">{cat?.name ?? 'Categoria'}</div>
                <div className="col-span-3 text-right text-sm font-medium">{fmtBRL(b.limit_cents)}</div>
                <div className="col-span-2 text-right">
                  <button onClick={() => removeBudget(b.id)} className="text-sm text-red-300 hover:underline">
                    Remover
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
