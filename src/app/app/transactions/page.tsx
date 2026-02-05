cat > src/app/app/transactions/page.tsx <<'TSX'
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
  user_id: string;
  receipt_path: string | null;

  account?: Account | null;
  category?: Category | null;
};

type ParsedReceipt = {
  merchant: string | null;
  amount: string | null;   // "123,45"
  dateStr: string | null;  // "YYYY-MM-DD"
  rawText?: string;
};

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isoToYYYYMMDD(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getExt(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase();
  if (byName && byName.length <= 5) return byName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}function randomId() {
  // browser safe
  // @ts-ignore
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ADD form
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(() => todayYYYYMMDD());
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  // receipt for ADD (temporary upload before creating tx)
  const [addReceiptPath, setAddReceiptPath] = useState<string | null>(null);
  const [addReceiptExt, setAddReceiptExt] = useState<string | null>(null);

  // EDIT inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<'income' | 'expense'>('expense');
  const [editAccountId, setEditAccountId] = useState<string>('');
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editDateStr, setEditDateStr] = useState<string>(() => todayYYYYMMDD());
  const [editDescription, setEditDescription] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');

  const filteredCategories = useMemo(() => categories.filter((c) => c.kind === kind), [categories, kind]);
  const filteredEditCategories = useMemo(() => categories.filter((c) => c.kind === editKind), [categories, editKind]);

  const total = useMemo(() => {
    return txs.reduce((acc, r) => acc + (r.kind === 'income' ? r.amount_cents : -r.amount_cents), 0);
  }, [txs]);

  async function getUserIdOrError() {
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);
    const uid = data.user?.id;
    if (!uid) throw new Error('Sessão expirada. Faça login novamente.');
    return uid;
  }

  function receiptPublicUrl(path: string) {
    const supabase = supabaseBrowser();
    const { data } = supabase.storage.from('receipts').getPublicUrl(path);
    return data.publicUrl;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const [a, c, t] = await Promise.all([
      supabase.from('accounts').select('id,name').order('created_at', { ascending: false }),
      supabase.from('categories').select('id,name,kind').order('created_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('id,occurred_at,description,amount_cents,kind,account_id,category_id,user_id,receipt_path')
        .order('occurred_at', { ascending: false })
        .limit(200),
    ]);

    if (a.error) setError(a.error.message);
    if (c.error) setError(c.error.message);
    if (t.error) setError(t.error.message);

    const accountsData = (a.data as Account[]) || [];
    const categoriesData = (c.data as Category[]) || [];
    const txData = (t.data as Tx[]) || [];

    setAccounts(accountsData);
    setCategories(categoriesData);
    setTxs(
      txData.map((row) => ({
        ...row,
        account: row.account_id ? accountsData.find((x) => x.id === row.account_id) ?? null : null,
        category: row.category_id ? categoriesData.find((x) => x.id === row.category_id) ?? null : null,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function startEdit(tx: Tx) {
    setError(null);
    setEditingId(tx.id);
    setEditKind(tx.kind);
    setEditAccountId(tx.account_id ?? '');setEditCategoryId(tx.category_id ?? '');
    setEditDateStr(isoToYYYYMMDD(tx.occurred_at));
    setEditDescription(tx.description ?? '');
    setEditAmount(((tx.amount_cents || 0) / 100).toFixed(2).replace('.', ','));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function ocrFromImageUrl(imageUrl: string): Promise<ParsedReceipt> {
    const res = await fetch('/api/receipt/parse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Falha ao ler comprovante');
    return json as ParsedReceipt;
  }

  async function uploadTempReceiptForAdd(file: File) {
    setError(null);
    setBusyId('ADD');

    try {
      const supabase = supabaseBrowser();
      const userId = await getUserIdOrError();

      const ext = getExt(file);
      const tmpPath = `tmp/${userId}/${randomId()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('receipts').upload(tmpPath, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw new Error(upErr.message);

      setAddReceiptPath(tmpPath);
      setAddReceiptExt(ext);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function readReceiptForAdd() {
    if (!addReceiptPath) return setError('Anexe um comprovante primeiro');
    setError(null);
    setBusyId('ADD');

    try {
      const imageUrl = receiptPublicUrl(addReceiptPath);
      const parsed = await ocrFromImageUrl(imageUrl);

      if (parsed.dateStr) setDateStr(String(parsed.dateStr));
      if (parsed.amount) setAmount(String(parsed.amount));
      if (parsed.merchant) setDescription(String(parsed.merchant));
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function addTx(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!dateStr) return setError('Data obrigatória');
    if (!description.trim()) return setError('Descrição obrigatória');
    if (!Number.isFinite(cents) || cents <= 0) return setError('Valor inválido');

    const occurredAt = new Date(`${dateStr}T12:00:00.000Z`).toISOString();

    try {
      const supabase = supabaseBrowser();
      const userId = await getUserIdOrError();

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          description: description.trim(),
          amount_cents: cents,
          kind,
          occurred_at: occurredAt,
          account_id: accountId || null,
          category_id: categoryId || null,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);
      const txId = data?.id as string;

      // If receipt was uploaded before creating, move it to txId.ext and attach to row
      if (addReceiptPath && addReceiptExt) {
        const finalPath = `${txId}.${addReceiptExt}`;

        // move temp -> final
        const { error: mvErr } = await supabase.storage.from('receipts').move(addReceiptPath, finalPath);
        if (mvErr) throw new Error(mvErr.message);

        const { error: upErr } = await supabase.from('transactions').update({ receipt_path: finalPath }).eq('id', txId);
        if (upErr) throw new Error(upErr.message);

        setAddReceiptPath(null);
        setAddReceiptExt(null);
      }

      setDescription('');
      setAmount('');
      await loadAll();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    }
  }

  async function saveEdit(id: string) {
    setError(null);

    const cents = Math.round(Number(editAmount.replace(',', '.')) * 100);
    if (!editDateStr) return setError('Data obrigatória');if (!editDescription.trim()) return setError('Descrição obrigatória');
    if (!Number.isFinite(cents) || cents <= 0) return setError('Valor inválido');

    const occurredAt = new Date(`${editDateStr}T12:00:00.000Z`).toISOString();

    const cat = editCategoryId ? categories.find((x) => x.id === editCategoryId) : null;
    const safeCategoryId = cat && cat.kind === editKind ? editCategoryId : '';

    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from('transactions')
      .update({
        description: editDescription.trim(),
        amount_cents: cents,
        kind: editKind,
        occurred_at: occurredAt,
        account_id: editAccountId || null,
        category_id: safeCategoryId || null,
      })
      .eq('id', id);

    if (error) return setError(error.message);

    setEditingId(null);
    await loadAll();
  }

  async function removeTx(id: string) {
    if (!confirm('Remover esta transação?')) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) return setError(error.message);
    if (editingId === id) setEditingId(null);
    await loadAll();
  }

  async function uploadReceiptForEdit(txId: string, file: File) {
    setError(null);
    setBusyId(txId);

    try {
      const supabase = supabaseBrowser();
      const ext = getExt(file);
      const path = `${txId}.${ext}`;

      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw new Error(upErr.message);

      const { error: dbErr } = await supabase.from('transactions').update({ receipt_path: path }).eq('id', txId);
      if (dbErr) throw new Error(dbErr.message);

      await loadAll();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function parseReceiptForEdit(tx: Tx) {
    if (!tx.receipt_path) return setError('Sem comprovante anexado');
    setError(null);
    setBusyId(tx.id);

    try {
      const imageUrl = receiptPublicUrl(tx.receipt_path);
      const parsed = await ocrFromImageUrl(imageUrl);

      if (editingId !== tx.id) startEdit(tx);

      if (parsed.dateStr) setEditDateStr(String(parsed.dateStr));
      if (parsed.amount) setEditAmount(String(parsed.amount));
      if (parsed.merchant) setEditDescription(String(parsed.merchant));
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusyId(null);
    }
  }return(
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transações</h1>
          <p className="text-sm text-white/60">Lançamentos de entrada/saída</p>
        </div>
        <div className="text-sm text-white/60">Saldo (lista): {fmtBRL(total)}</div>
      </div>

      {/* ADD FORM */}
      <form onSubmit={addTx} className="grid gap-3 rounded border border-white/10 bg-white/5 p-4 md:grid-cols-8">
        <select className="rounded border border-white/15 bg-black/20 p-3" value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="expense">Saída</option>
          <option value="income">Entrada</option>
        </select>

        <select className="rounded border border-white/15 bg-black/20 p-3" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">(Conta)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select className="rounded border border-white/15 bg-black/20 p-3" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">(Categoria)</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="date"
          className="min-w-[160px] rounded border border-white/15 bg-black/20 p-3 pr-10 text-white font-medium tracking-wide"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
        />

        <input
          className="rounded border border-white/15 bg-black/20 p-3 md:col-span-2"
          placeholder="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex gap-2 md:col-span-2">
          <input
            className="w-full min-w-[180px] rounded border border-white/15 bg-black/20 p-3"
            placeholder="Valor (ex: 19,90)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="rounded bg-white px-4 text-black" disabled={busyId === 'ADD'}>Adicionar</button>
        </div>

        <div className="md:col-span-8 flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/60">Comprovante (cadastro):</span>

          <label className="cursor-pointer rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10">
            {busyId === 'ADD' ? 'Enviando…' : 'Anexar'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={busyId === 'ADD'}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadTempReceiptForAdd(f);
                e.currentTarget.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => void readReceiptForAdd()}
            className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
            disabled={busyId === 'ADD' || !addReceiptPath}
            title={!addReceiptPath ? 'Anexe um comprovante primeiro' : 'Ler comprovante e preencher campos'}
          >
            {busyId === 'ADD' ? 'Lendo…' : 'Ler'}
          </button>

          {addReceiptPath && (
            <a
              href={receiptPublicUrl(addReceiptPath)}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
            >
              Ver
            </a>
          )}
        </div>
      </form>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {/* TABLE */}
      <div className="overflow-hidden rounded border border-white/10">
        <div className="grid grid-cols-13 gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
          <div className="col-span-2">Data</div>
          <div className="col-span-4">Descrição</div>
          <div className="col-span-2">Conta</div>
          <div className="col-span-2">Categoria</div>
          <div className="col-span-2 text-right">Valor</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>{loading ? (
          <div className="p-4 text-sm text-white/60">Carregando…</div>
        ) : txs.length === 0 ? (
          <div className="p-4 text-sm text-white/60">Sem transações ainda.</div>
        ) :(
          txs.map((r) => {
            const editing = editingId === r.id;
            const busy = busyId === r.id;
            const receiptUrl = r.receipt_path ? receiptPublicUrl(r.receipt_path) : null;

            if (!editing) {
              return (
                <div key={r.id} className="grid grid-cols-13 gap-2 border-b border-white/5 px-4 py-3">
                  <div className="col-span-2 text-sm text-white/70">{new Date(r.occurred_at).toLocaleDateString('pt-BR')}</div>
                  <div className="col-span-4 text-sm">{r.description}</div>
                  <div className="col-span-2 text-sm text-white/70">{r.account?.name ?? '-'}</div>
                  <div className="col-span-2 text-sm text-white/70">{r.category?.name ?? '-'}</div>

                  <div className={'col-span-2 text-right text-sm font-medium ' + (r.kind === 'income' ? 'text-emerald-300' : 'text-red-300')}>
                    {r.kind === 'income' ? '+ ' : '- '}
                    {fmtBRL(r.amount_cents)}
                  </div>

                  <div className="col-span-1 flex items-center justify-end gap-2">
                    <button onClick={() => startEdit(r)} className="rounded border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10">Editar</button>
                    <button onClick={() => removeTx(r.id)} className="text-white/50 hover:text-white/90" title="Remover">×</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={r.id} className="grid grid-cols-13 gap-2 border-b border-white/5 bg-white/5 px-4 py-3">
                <div className="col-span-2">
                  <input
                    type="date"
                    className="w-full min-w-[160px] rounded border border-white/15 bg-black/20 p-2 pr-10 text-sm text-white font-medium tracking-wide"
                    value={editDateStr}
                    onChange={(e) => setEditDateStr(e.target.value)}
                  />
                </div>

                <div className="col-span-4 space-y-2">
                  <div className="rounded border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-1 text-[11px] text-[#D4AF37]">
                    COMPROVANTE (edição): Anexar → Ler (OCR) → Salvar
                  </div>

                  <input
                    className="w-full rounded border border-white/15 bg-black/20 p-2 text-sm"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Descrição"
                  />

                  <div className="flex gap-2">
                    <select
                      className="w-full rounded border border-white/15 bg-black/20 p-2 text-sm"
                      value={editKind}
                      onChange={(e) => {
                        const nextKind = e.target.value as any;
                        setEditKind(nextKind);
                        const cat = editCategoryId ? categories.find((x) => x.id === editCategoryId) : null;
                        if (cat && cat.kind !== nextKind) setEditCategoryId('');
                      }}
                    >
                      <option value="expense">Saída</option>
                      <option value="income">Entrada</option>
                    </select>

                    <input
                      className="w-full rounded border border-white/15 bg-black/20 p-2 text-sm"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="Valor (ex: 19,90)"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <label className="cursor-pointer rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10">
                      {busy ? 'Enviando…' : 'Anexar'}
                      <inputtype="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadReceiptForEdit(r.id, f);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void parseReceiptForEdit(r)}
                      className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                      disabled={busy || !r.receipt_path}
                    >
                      {busy ? 'Lendo…' : 'Ler'}
                    </button>

                    {receiptUrl && (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        Ver
                      </a>
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <select className="w-full rounded border border-white/15 bg-black/20 p-2 text-sm" value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)}>
                    <option value="">(Conta)</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <select className="w-full rounded border border-white/15 bg-black/20 p-2 text-sm" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                    <option value="">(Categoria)</option>
                    {filteredEditCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3 flex items-center justify-end gap-2">
                  <button onClick={() => void saveEdit(r.id)} className="rounded bg-white px-3 py-2 text-xs font-medium text-black" type="button" disabled={busy}>Salvar</button>
                  <button onClick={cancelEdit} className="rounded border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/10" type="button" disabled={busy}>Cancelar</button>
                  <button onClick={() => void removeTx(r.id)} className="rounded border border-red-500/40 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10" type="button" disabled={busy}>Remover</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function fmtBRL(cents: number) {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
TSX
