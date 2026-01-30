'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Tx = {
  id: string;
  occurred_at: string;
  description: string;
  amount_cents: number;
  type: 'income' | 'expense';
};

export default function TransactionsPage() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');

  const total = useMemo(() => {
    return rows.reduce((acc, r) => acc + (r.type === 'income' ? r.amount_cents : -r.amount_cents), 0);
  }, [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase
      .from('transactions')
      .select('id, occurred_at, description, amount_cents, type')
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (error) setError(error.message);
    setRows((data as Tx[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
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
      type,
      occurred_at: new Date().toISOString(),
    });

    if (error) return setError(error.message);

    setDescription('');
    setAmount('');
    await load();
  }

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transações</h1>
          <p className="text-sm text-white/60">MVP: lista + adicionar (precisa das tabelas no Supabase)</p>
        </div>
        <div className="text-sm text-white/60">Saldo (lista): {fmtBRL(total)}</div>
      </div>

      <form onSubmit={addTx} className="grid gap-3 rounded border border-white/10 bg-white/5 p-4 md:grid-cols-4">
        <input
          className="w-full rounded border border-white/15 bg-black/20 p-3 md:col-span-2"
          placeholder="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="w-full rounded border border-white/15 bg-black/20 p-3"
          placeholder="Valor (ex: 19,90)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="w-full rounded border border-white/15 bg-black/20 p-3"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
          </select>
          <button className="rounded bg-white px-4 text-black">Adicionar</button>
        </div>
      </form>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      <div className="rounded border border-white/10 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
          <div className="col-span-3">Data</div>
          <div className="col-span-6">Descrição</div>
          <div className="col-span-3 text-right">Valor</div>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-white/60">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-white/60">Sem transações (ou tabela não existe / RLS bloqueando).</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5">
              <div className="col-span-3 text-sm text-white/70">{new Date(r.occurred_at).toLocaleDateString('pt-BR')}</div>
              <div className="col-span-6 text-sm">{r.description}</div>
              <div className={"col-span-3 text-right text-sm font-medium " + (r.type === 'income' ? 'text-emerald-300' : 'text-red-300')}>
                {r.type === 'income' ? '+' : '-'} {fmtBRL(r.amount_cents)}
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
