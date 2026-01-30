'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Account = { id: string; name: string; created_at: string };

export default function AccountsPage() {
  const [rows, setRows] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.from('accounts').select('id,name,created_at').order('created_at', { ascending: false });
    if (error) setError(error.message);
    setRows((data as Account[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = name.trim();
    if (!value) return setError('Nome obrigatório');
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('accounts').insert({ name: value });
    if (error) return setError(error.message);
    setName('');
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Remover esta conta?')) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) return setError(error.message);
    await load();
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contas</h1>
        <p className="text-sm text-white/60">Ex: Banco, Carteira, Nubank, etc.</p>
      </div>

      <form onSubmit={add} className="flex gap-2 rounded border border-white/10 bg-white/5 p-4">
        <input className="flex-1 rounded border border-white/15 bg-black/20 p-3" placeholder="Nome da conta" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="rounded bg-white px-4 text-black">Adicionar</button>
      </form>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      <div className="rounded border border-white/10 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
          <div className="col-span-9">Conta</div>
          <div className="col-span-3 text-right">Ações</div>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-white/60">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-white/60">Nenhuma conta ainda.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5">
              <div className="col-span-9 text-sm">{r.name}</div>
              <div className="col-span-3 text-right">
                <button onClick={() => remove(r.id)} className="text-sm text-red-300 hover:underline">Remover</button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
