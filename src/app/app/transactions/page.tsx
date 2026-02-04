'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: 'income' | 'expense' };

type Tx = {
  id: string;
  occurred_at: string;
  description: string;
  amount_cents: number;
  kind: 'income' | 'expense';
  account_id: string | null;
  category_id: string | null;
  account?: Account | null;
  category?: Category | null;
};

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const total = useMemo(() => {
    return txs.reduce((acc, r) => acc + (r.kind === 'income' ? r.amount_cents : -r.amount_cents), 0);
  }, [txs]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const supabase = supabaseBrowser();

      const [a, c, t] = await Promise.all([
        supabase.from('accounts').select('id,name').order('created_at', { ascending: false }),
        supabase.from('categories').select('id,name,kind').order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('id,occurred_at,description,amount_cents,kind,account_id,category_id')
          .order('occurred_at', { ascending: false })
          .limit(100),
      ]);

      if (a.error) throw new Error(a.error.message);
      if (c.error) throw new Error(c.error.message);
      if (t.error) throw new Error(t.error.message);

    setAccounts((a.data as Account[]) || []);
    setCategories((c.data as Category[]) || []);
    setTxs(((t.data as Tx[]) || []).map((row) => ({
      ...row,
      account: row.account_id ? (a.data as Account[])?.find((x) => x.id === row.account_id) ?? null : null,
      category: row.category_id ? (c.data as Category[])?.find((x) => x.id === row.category_id) ?? null : null,
    })));

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function addTx(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!description.trim()) return setError('Descrição obrigatória');
    if (!Number.isFinite(cents) || cents <= 0) return setError('Valor inválido');

    const supabase = supabaseBrowser();
    const { error } = await supabase.from('transactions').insert({
      description: description.trim(),
      amount_cents: cents,
      kind,
      occurred_at: new Date().toISOString(),
      account_id: accountId || null,
      category_id: categoryId || null,
    });

      if (error) throw new Error(error.message);

      setDescription('');
      setAmount('');
      await loadAll();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    }
  }

  async function removeTx(id: string) {
    if (!confirm('Remover esta transação?')) return;

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw new Error(error.message);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    }
  }
  return
  (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transações</h1>
          <p className="text-sm text-white/60">Lançamentos de entrada/saída</p>
          <div className="mt-1 text-xs text-white/40">
            debug: loading={String(loading)} txs={txs.length} accounts={accounts.length} categories={categories.length}
          </div>
        </div>

        <div className="text-sm text-white/60">Saldo (lista): {fmtBRL(total)}</div>
      </div>

      <form onSubmit={addTx} className="grid gap-3 rounded border border-white/10 bg-white/5 p-4 md:grid-cols-7">
        <select
          className="rounded border border-white/15 bg-black/20 p-3"
          value={kind}
          onChange={(e) => setKind(e.target.value as any)}
        >
          <option value="expense">Saída</option>
          <option value="income">Entrada</option>
        </select>

        <select
          className="rounded border border-white/15 bg-black/20 p-3"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">(Conta)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          className="rounded border border-white/15 bg-black/20 p-3"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">(Categoria)</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="rounded border border-white/15 bg-black/20 p-3"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
        />

        <input
          className="rounded border border-white/15 bg-black/20 p-3 md:col-span-2"
          placeholder="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex gap-2">
          <input
            className="w-full rounded border border-white/15 bg-black/20 p-3"
            placeholder="Valor (ex: 19,90)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="rounded bg-white px-4 text-black">Adicionar</button>
        </div>
      </form>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      <div className="overflow-hidden rounded border border-white/10">
        <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
          <div className="col-span-2">Data</div>
          <div className="col-span-4">Descrição</div>
          <div className="col-span-2">Conta</div>
          <div className="col-span-2">Categoria</div>
          <div className="col-span-2 text-right">Valor</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-white/60">Carregando…</div>
        ) : txs.length === 0 ? (
          <div className="p-4 text-sm text-white/60">Sem transações ainda.</div>
        ) : (
          txs.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5">
              <div className="col-span-2 text-sm text-white/70">{new Date(r.occurred_at).toLocaleDateString('pt-BR')}</div>
              <div className="col-span-4 text-sm">{r.description}</div>
              <div className="col-span-2 text-sm text-white/70">{r.account?.name ?? '-'}</div>
              <div className="col-span-2 text-sm text-white/70">{r.category?.name ?? '-'}</div>
              <div className={"col-span-2 text-right text-sm font-medium " + (r.kind === 'income' ? 'text-emerald-300' : 'text-red-300')}>
                <span className="mr-2">{r.kind === 'income' ? '+' : '-'} {fmtBRL(r.amount_cents)}</span>
                <button onClick={() => removeTx(r.id)} className="text-white/50 hover:text-white/90">×</button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function fmtBRL(cents: number) {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
