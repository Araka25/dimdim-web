'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: 'income' | 'expense' };
type KindFilter = '' | 'income' | 'expense';

type ParsedReceipt = {
  merchant: string | null;
  amount: string | null; // "123,45"
  dateStr: string | null; // "YYYY-MM-DD"
  rawText?: string;
};

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

  receipt_parsed?: ParsedReceipt | null;
  receipt_parsed_at?: string | null;

  account?: Account | null;
  category?: Category | null;
};

type Totals = {
  income_cents: number;
  expense_cents: number;
  net_cents: number;
};

type TopCatRow = { category_id: string; total_cents: number };
type TopCatUi = { id: string; name: string; total_cents: number };

const PAGE_SIZE = 50;

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function currentYYYYMM() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function isoToYYYYMMDD(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthRangeUTC(yyyyMM: string) {
  const [yStr, mStr] = yyyyMM.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function addMonthsYYYYMM(yyyyMM: string, deltaMonths: number) {
  const [yStr, mStr] = yyyyMM.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function getExt(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase();
  if (byName && byName.length <= 5) return byName;
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function randomId() {
  // @ts-ignore
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fmtBRL(cents: number) {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtBRDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Aceita: "1000,00" | "1.000,00" | "1 000,00" | "R$ 1.000,00"
function brlToCents(input: string) {
  const s = String(input || '')
    .trim()
    .replace(/\s/g, '')
    .replace(/^R\$\s?/i, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [cursorOccurredAt, setCursorOccurredAt] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // FILTERS (server-side)
  const [filterMonth, setFilterMonth] = useState<string>(() => currentYYYYMM()); // "YYYY-MM"
  const [filterAccountId, setFilterAccountId] = useState<string>(''); // '' = todos
  const [filterCategoryId, setFilterCategoryId] = useState<string>(''); // '' = todos
  const [filterKind, setFilterKind] = useState<KindFilter>(''); // '' = todos
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Totals do período (server-side via RPC)
  const [totals, setTotals] = useState<Totals>({ income_cents: 0, expense_cents: 0, net_cents: 0 });

  // Option 5: Top categorias (RPC)
  const [topExpenseCats, setTopExpenseCats] = useState<TopCatUi[]>([]);
  const [topIncomeCats, setTopIncomeCats] = useState<TopCatUi[]>([]);

  // ADD form
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(() => todayYYYYMMDD());
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  // ADD receipt (temp)
  const [addReceiptPath, setAddReceiptPath] = useState<string | null>(null);

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

  const lastLoadKeyRef = useRef<string>('');

  async function getUserIdOrError(client: any) {
    const { data, error } = await client.auth.getUser();
    if (error) throw new Error(error.message);
    const uid = data.user?.id;
    if (!uid) throw new Error('Sessão expirada. Faça login novamente.');
    return uid;
  }

  async function receiptSignedUrl(path: string) {
    const res = await fetch('/api/receipt/signed-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Falha ao gerar signed URL');
    return String(json.signedUrl);
  }

  async function ocrFromPath(path: string): Promise<ParsedReceipt> {
    const res = await fetch('/api/receipt/parse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {}

    if (!res.ok) {
      const msg = json?.error ? String(json.error) : null;
      if (res.status === 413) throw new Error(msg || 'Imagem grande demais. Envie uma foto menor.');
      if (res.status === 504) throw new Error(msg || 'Timeout ao ler o comprovante. Tente novamente.');
      if (res.status === 429) throw new Error(msg || 'Muitas leituras. Tente em alguns minutos.');
      if (res.status === 400) throw new Error(msg || 'Comprovante inválido.');
      if (res.status === 500) throw new Error(msg || 'Erro ao processar OCR. Tente novamente.');
      throw new Error(msg || `Falha ao ler comprovante (HTTP ${res.status})`);
    }

    return json as ParsedReceipt;
  }

  function makeLoadKey() {
    return `${filterMonth}|${filterAccountId || '-'}|${filterCategoryId || '-'}|${filterKind || '-'}|${filterSearch.trim() || '-'}`;
  }

  async function loadLookups() {
    const supabase = supabaseBrowser();
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

    return { accountsData, categoriesData };
  }

  async function loadTotalsAndTopCats(categoriesData: Category[]) {
    const supabase = supabaseBrowser();
    const userId = await getUserIdOrError(supabase);
    const { startIso, endIso } = monthRangeUTC(filterMonth);
    const search = filterSearch.trim() || null;

    // Totais (RPC)
    const totalsRes = await supabase.rpc('transactions_totals', {
      p_user_id: userId,
      p_start: startIso,
      p_end: endIso,
      p_account_id: filterAccountId || null,
      p_category_id: filterCategoryId || null,
      p_kind: filterKind || null,
      p_search: search,
    });
    if (totalsRes.error) throw new Error(totalsRes.error.message);

    const trow = Array.isArray(totalsRes.data) ? totalsRes.data[0] : totalsRes.data;
    setTotals({
      income_cents: Number(trow?.income_cents ?? 0),
      expense_cents: Number(trow?.expense_cents ?? 0),
      net_cents: Number(trow?.net_cents ?? 0),
    });

    // Top categorias (RPC)
    const [topExp, topInc] = await Promise.all([
      supabase.rpc('transactions_top_categories', {
        p_user_id: userId,
        p_start: startIso,
        p_end: endIso,
        p_account_id: filterAccountId || null,
        p_kind: 'expense',
        p_search: search,
        p_limit: 5,
      }),
      supabase.rpc('transactions_top_categories', {
        p_user_id: userId,
        p_start: startIso,
        p_end: endIso,
        p_account_id: filterAccountId || null,
        p_kind: 'income',
        p_search: search,
        p_limit: 5,
      }),
    ]);

    if (topExp.error) throw new Error(topExp.error.message);
    if (topInc.error) throw new Error(topInc.error.message);

    const catMap = new Map(categoriesData.map((c) => [c.id, c.name]));

    const expRows: TopCatUi[] = ((topExp.data as TopCatRow[]) || []).map((r) => ({
      id: r.category_id,
      name: catMap.get(r.category_id) || 'Sem categoria',
      total_cents: Number(r.total_cents ?? 0),
    }));

    const incRows: TopCatUi[] = ((topInc.data as TopCatRow[]) || []).map((r) => ({
      id: r.category_id,
      name: catMap.get(r.category_id) || 'Sem categoria',
      total_cents: Number(r.total_cents ?? 0),
    }));

    setTopExpenseCats(expRows);
    setTopIncomeCats(incRows);
  }

  function decorateRows(rows: Tx[], accountsData: Account[], categoriesData: Category[]) {
    const accountsMap = new Map(accountsData.map((a) => [a.id, a]));
    const categoriesMap = new Map(categoriesData.map((c) => [c.id, c]));
    return rows.map((row) => ({
      ...row,
      account: row.account_id ? accountsMap.get(row.account_id) ?? null : null,
      category: row.category_id ? categoriesMap.get(row.category_id) ?? null : null,
    }));
  }

  async function loadFirstPage() {
    setLoading(true);
    setError(null);

    const thisKey = makeLoadKey();
    lastLoadKeyRef.current = thisKey;

    try {
      const { accountsData, categoriesData } = await loadLookups();
      await loadTotalsAndTopCats(categoriesData);

      const supabase = supabaseBrowser();
      const { startIso, endIso } = monthRangeUTC(filterMonth);

      let q = supabase
        .from('transactions')
        .select(
          'id,occurred_at,description,amount_cents,kind,account_id,category_id,user_id,receipt_path,receipt_parsed,receipt_parsed_at'
        )
        .gte('occurred_at', startIso)
        .lt('occurred_at', endIso)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);

      if (filterAccountId) q = q.eq('account_id', filterAccountId);
      if (filterCategoryId) q = q.eq('category_id', filterCategoryId);
      if (filterKind) q = q.eq('kind', filterKind);
      if (filterSearch.trim()) q = q.ilike('description', `%${filterSearch.trim()}%`);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      if (lastLoadKeyRef.current !== thisKey) return;

      const raw = (data as Tx[]) || [];
      const rows = decorateRows(raw, accountsData, categoriesData);

      setTxs(rows);

      const more = rows.length === PAGE_SIZE;
      setHasMore(more);

      const last = rows[rows.length - 1];
      setCursorOccurredAt(last ? last.occurred_at : null);
      setCursorId(last ? last.id : null);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
      setTxs([]);
      setHasMore(false);
      setCursorOccurredAt(null);
      setCursorId(null);
      setTopExpenseCats([]);
      setTopIncomeCats([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore || loading) return;
    if (!hasMore) return;
    if (!cursorOccurredAt || !cursorId) return;

    setLoadingMore(true);
    setError(null);

    const thisKey = makeLoadKey();

    try {
      const supabase = supabaseBrowser();
      const { startIso, endIso } = monthRangeUTC(filterMonth);

      let q = supabase
        .from('transactions')
        .select(
          'id,occurred_at,description,amount_cents,kind,account_id,category_id,user_id,receipt_path,receipt_parsed,receipt_parsed_at'
        )
        .gte('occurred_at', startIso)
        .lt('occurred_at', endIso)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        // cursor: (occurred_at < cursorOccurredAt) OR (occurred_at = cursorOccurredAt AND id < cursorId)
        .or(`occurred_at.lt.${cursorOccurredAt},and(occurred_at.eq.${cursorOccurredAt},id.lt.${cursorId})`)
        .limit(PAGE_SIZE);

      if (filterAccountId) q = q.eq('account_id', filterAccountId);
      if (filterCategoryId) q = q.eq('category_id', filterCategoryId);
      if (filterKind) q = q.eq('kind', filterKind);
      if (filterSearch.trim()) q = q.ilike('description', `%${filterSearch.trim()}%`);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      if (makeLoadKey() !== thisKey) return;

      const raw = (data as Tx[]) || [];
      const rows = decorateRows(raw, accounts, categories);

      setTxs((prev) => [...prev, ...rows]);

      const more = rows.length === PAGE_SIZE;
      setHasMore(more);

      const last = rows[rows.length - 1];
      if (last) {
        setCursorOccurredAt(last.occurred_at);
        setCursorId(last.id);
      }
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterAccountId, filterCategoryId, filterKind, filterSearch]);

  function startEdit(tx: Tx) {
    setError(null);
    setEditingId(tx.id);
    setEditKind(tx.kind);
    setEditAccountId(tx.account_id ?? '');
    setEditCategoryId(tx.category_id ?? '');
    setEditDateStr(isoToYYYYMMDD(tx.occurred_at));
    setEditDescription(tx.description ?? '');
    setEditAmount(((tx.amount_cents || 0) / 100).toFixed(2).replace('.', ','));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  // OCR AUTOMÁTICO no cadastro ao anexar
  async function uploadTempReceiptForAdd(file: File) {
    setError(null);
    setBusyId('ADD');

    try {
      const supabase = supabaseBrowser();
      const userId = await getUserIdOrError(supabase);

      const ext = getExt(file);
      const tmpPath = `tmp/${userId}/${randomId()}.${ext}`;

      const { error: upErr } = await supabase.storage.from('receipts').upload(tmpPath, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw new Error(upErr.message);

      setAddReceiptPath(tmpPath);

      try {
        const parsed = await ocrFromPath(tmpPath);
        if (parsed.dateStr) setDateStr(String(parsed.dateStr));
        if (parsed.amount) setAmount(String(parsed.amount));
        if (parsed.merchant) setDescription(String(parsed.merchant));
      } catch (e: any) {
        setError(e?.message ? String(e.message) : String(e));
      }
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
      const parsed = await ocrFromPath(addReceiptPath);
      if (parsed.dateStr) setDateStr(String(parsed.dateStr));
      if (parsed.amount) setAmount(String(parsed.amount));
      if (parsed.merchant) setDescription(String(parsed.merchant));
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function addTx(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cents = brlToCents(amount);
    if (!dateStr) return setError('Data obrigatória');
    if (!description.trim()) return setError('Descrição obrigatória');
    if (!Number.isFinite(cents) || cents <= 0) return setError('Valor inválido');

    const occurredAt = new Date(`${dateStr}T12:00:00.000Z`).toISOString();

    try {
      const supabase = supabaseBrowser();
      const userId = await getUserIdOrError(supabase);

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

      if (addReceiptPath) {
        const ext = addReceiptPath.split('.').pop() || 'jpg';
        const finalPath = `${txId}.${ext}`;

        const { error: mvErr } = await supabase.storage.from('receipts').move(addReceiptPath, finalPath);
        if (mvErr) throw new Error(mvErr.message);

        const { error: upErr } = await supabase.from('transactions').update({ receipt_path: finalPath }).eq('id', txId);
        if (upErr) throw new Error(upErr.message);

        setAddReceiptPath(null);
      }

      setDescription('');
      setAmount('');

      await loadFirstPage();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    }
  }

  async function saveEdit(id: string) {
    setError(null);

    const cents = brlToCents(editAmount);
    if (!editDateStr) return setError('Data obrigatória');
    if (!editDescription.trim()) return setError('Descrição obrigatória');
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
    await loadFirstPage();
  }

  async function removeTx(id: string) {
    if (!confirm('Remover esta transação?')) return;

    const supabase = supabaseBrowser();
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) return setError(error.message);

    if (editingId === id) setEditingId(null);

    await loadFirstPage();
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

      const { error: dbErr } = await supabase
        .from('transactions')
        .update({ receipt_path: path, receipt_parsed: null, receipt_parsed_at: null })
        .eq('id', txId);

      if (dbErr) throw new Error(dbErr.message);

      await loadFirstPage();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function parseReceiptForEdit(tx: Tx, force = false) {
    if (!tx.receipt_path) return setError('Sem comprovante anexado');

    setError(null);
    setBusyId(tx.id);

    try {
      const cached = tx.receipt_parsed ?? null;

      if (!force && cached && (cached.dateStr || cached.amount || cached.merchant)) {
        if (editingId !== tx.id) startEdit(tx);

        if (cached.dateStr) setEditDateStr(String(cached.dateStr));
        if (cached.amount) setEditAmount(String(cached.amount));
        if (cached.merchant) setEditDescription(String(cached.merchant));
        return;
      }

      const parsed = await ocrFromPath(tx.receipt_path);

      const supabase = supabaseBrowser();
      const { error: cacheErr } = await supabase
        .from('transactions')
        .update({
          receipt_parsed: parsed,
          receipt_parsed_at: new Date().toISOString(),
        })
        .eq('id', tx.id);

      if (cacheErr) throw new Error(cacheErr.message);

      if (editingId !== tx.id) startEdit(tx);

      if (parsed.dateStr) setEditDateStr(String(parsed.dateStr));
      if (parsed.amount) setEditAmount(String(parsed.amount));
      if (parsed.merchant) setEditDescription(String(parsed.merchant));

      await loadFirstPage();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const maxTopExpense = Math.max(1, ...topExpenseCats.map((x) => x.total_cents));
  const maxTopIncome = Math.max(1, ...topIncomeCats.map((x) => x.total_cents));

  return (
    <section className="space-y-6">
      {/* Painel (opção 5) - mais profissional / mobile alinhado */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Transações</h1>
            <p className="text-sm text-white/60">Lançamentos de entrada/saída</p>
          </div>
        </div>

        {/* Cards: 2 colunas no mobile, líquido full */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-4">
            <div className="text-xs text-white/60">Entradas (filtro)</div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">{fmtBRL(totals.income_cents)}</div>
          </div>

          <div className="rounded-lg border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-4">
            <div className="text-xs text-white/60">Saídas (filtro)</div>
            <div className="mt-1 text-lg font-semibold text-red-300">{fmtBRL(totals.expense_cents)}</div>
          </div>

          <div className="col-span-2 rounded-lg border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-4">
            <div className="text-xs text-white/60">Líquido (filtro)</div>
            <div className="mt-1 text-xl font-semibold text-white/90">{fmtBRL(totals.net_cents)}</div>
          </div>
        </div>

        {/* Top categorias */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Top categorias (Saídas)</div>
              <div className="text-xs text-white/50">mês filtrado</div>
            </div>

            {topExpenseCats.length === 0 ? (
              <div className="mt-3 text-sm text-white/60">Sem dados.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {topExpenseCats.map((c) => (
  <button
    key={c.id}
    type="button"
    onClick={() => setFilterCategoryId(c.id)}
    className="w-full text-left space-y-1 rounded-lg p-2 -m-2 hover:bg-white/5 transition"
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
              <div className="text-xs text-white/50">mês filtrado</div>
            </div>

            {topIncomeCats.length === 0 ? (
              <div className="mt-3 text-sm text-white/60">Sem dados.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {topIncomeCats.map((c) => (
  <button
    key={c.id}
    type="button"
    onClick={() => setFilterCategoryId(c.id)}
    className="w-full text-left space-y-1 rounded-lg p-2 -m-2 hover:bg-white/5 transition"
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
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded border border-white/10 bg-white/5 p-4 md:grid-cols-12">
        <div className="md:col-span-3">
          <div className="text-xs text-white/60 mb-1">Mês</div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
              onClick={() => setFilterMonth((m) => addMonthsYYYYMM(m, -1))}
              title="Mês anterior"
            >
              ←
            </button>

            <input
              type="month"
              className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />

            <button
              type="button"
              className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
              onClick={() => setFilterMonth((m) => addMonthsYYYYMM(m, 1))}
              title="Próximo mês"
            >
              →
            </button>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="text-xs text-white/60 mb-1">Tipo</div>
          <select
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as KindFilter)}
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
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
          >
            <option value="">(Todas)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-white/60 mb-1">Categoria</div>
          <select
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
          >
            <option value="">(Todas)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1 flex items-end">
          <button
            type="button"
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm text-white/80 hover:bg-white/10"
            onClick={() => {
              setFilterMonth(currentYYYYMM());
              setFilterAccountId('');
              setFilterCategoryId('');
              setFilterKind('');
              setFilterSearch('');
            }}
          >
            Limpar
          </button>
        </div>

        <div className="md:col-span-12">
          <div className="text-xs text-white/60 mb-1">Buscar (descrição)</div>
          <input
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="ex: mercado, uber, aluguel..."
          />
        </div>
      </div>

      {/* ADD */}
      <form onSubmit={addTx} className="grid grid-cols-1 gap-3 rounded border border-white/10 bg-white/5 p-4 md:grid-cols-8">
        <select className="rounded border border-white/15 bg-black/20 p-3" value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="expense">Saída</option>
          <option value="income">Entrada</option>
        </select>

        <select className="rounded border border-white/15 bg-black/20 p-3" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">(Conta)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select className="rounded border border-white/15 bg-black/20 p-3" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">(Categoria)</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
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
            placeholder="Valor (ex: 1.000,00)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="rounded bg-white px-4 text-black" disabled={busyId === 'ADD'}>
            Adicionar
          </button>
        </div>

        <div className="md:col-span-8 flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/60">Comprovante (cadastro):</span>

          <label className="cursor-pointer rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10">
            {busyId === 'ADD' ? 'Enviando…' : 'Anexar'}
            <input
              type="file"
              accept="image/*"
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
          >
            {busyId === 'ADD' ? 'Lendo…' : 'Ler'}
          </button>

          {addReceiptPath && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const url = await receiptSignedUrl(addReceiptPath);
                  window.open(url, '_blank', 'noreferrer');
                } catch (e: any) {
                  setError(e?.message ? String(e.message) : String(e));
                }
              }}
              className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              disabled={busyId === 'ADD'}
            >
              Ver
            </button>
          )}
        </div>
      </form>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {/* MOBILE: cards */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded border border-white/10 bg-white/5 p-4 text-sm text-white/60">Carregando…</div>
        ) : txs.length === 0 ? (
          <div className="rounded border border-white/10 bg-white/5 p-4 text-sm text-white/60">Sem transações para esse filtro.</div>
        ) : (
          txs.map((r) => {
            const editing = editingId === r.id;
            const busy = busyId === r.id;

            if (!editing) {
              return (
                <div key={r.id} className="rounded border border-white/10 bg-white/5 p-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm text-white/70">{new Date(r.occurred_at).toLocaleDateString('pt-BR')}</div>
                    <div className={'text-sm font-medium ' + (r.kind === 'income' ? 'text-emerald-300' : 'text-red-300')}>
                      {r.kind === 'income' ? '+ ' : '- '}
                      {fmtBRL(r.amount_cents)}
                    </div>
                  </div>

                  <div className="text-base font-medium">{r.description}</div>

                  <div className="text-xs text-white/60">
                    <div>
                      Conta: <span className="text-white/80">{r.account?.name ?? '-'}</span>
                    </div>
                    <div>
                      Categoria: <span className="text-white/80">{r.category?.name ?? '-'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button onClick={() => startEdit(r)} className="rounded border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
                      Editar
                    </button>
                    <button onClick={() => removeTx(r.id)} className="rounded border border-red-500/40 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10">
                      Remover
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={r.id} className="rounded border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-xs text-white/60">Editando</div>

                <input
                  type="date"
                  className="w-full rounded border border-white/15 bg-black/20 p-3 pr-10 text-sm text-white font-medium tracking-wide"
                  value={editDateStr}
                  onChange={(e) => setEditDateStr(e.target.value)}
                />

                <input
                  className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descrição"
                />

                <div className="flex gap-2">
                  <select
                    className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
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
                    className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="Valor (ex: 1.000,00)"
                  />
                </div>

                <select className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm" value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)}>
                  <option value="">(Conta)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>

                <select className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                  <option value="">(Categoria)</option>
                  {filteredEditCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="rounded border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-2 text-[11px] text-[#D4AF37] space-y-1">
                  <div>COMPROVANTE: Anexar → Ler (OCR) → Salvar</div>
                  <div className="text-white/70">
                    {!r.receipt_path
                      ? 'Status: sem comprovante'
                      : r.receipt_parsed_at
                        ? `Status: OCR feito em ${fmtBRDateTime(r.receipt_parsed_at)}`
                        : 'Status: comprovante anexado (não lido)'}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded border border-white/15 bg-black/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10">
                    {busy ? 'Enviando…' : 'Anexar'}
                    <input
                      type="file"
                      accept="image/*"
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
                    onClick={() => void parseReceiptForEdit(r, !!r.receipt_parsed_at)}
                    className="rounded border border-white/15 bg-black/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                    disabled={busy || !r.receipt_path}
                  >
                    {busy ? 'Lendo…' : r.receipt_parsed_at ? 'Reler' : 'Ler'}
                  </button>

                  {r.receipt_path && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const url = await receiptSignedUrl(r.receipt_path!);
                          window.open(url, '_blank', 'noreferrer');
                        } catch (e: any) {
                          setError(e?.message ? String(e.message) : String(e));
                        }
                      }}
                      className="rounded border border-white/15 bg-black/20 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                      disabled={busy}
                    >
                      Ver
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={() => void saveEdit(r.id)} className="rounded bg-white px-4 py-3 text-xs font-medium text-black" type="button" disabled={busy}>
                    Salvar
                  </button>
                  <button onClick={cancelEdit} className="rounded border border-white/15 px-4 py-3 text-xs text-white/80 hover:bg-white/10" type="button" disabled={busy}>
                    Cancelar
                  </button>
                  <button onClick={() => void removeTx(r.id)} className="rounded border border-red-500/40 px-4 py-3 text-xs text-red-200 hover:bg-red-500/10" type="button" disabled={busy}>
                    Remover
                  </button>
                </div>
              </div>
            );
          })
        )}

        {!loading && hasMore && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais'}
          </button>
        )}
      </div>

      {/* DESKTOP: tabela */}
      <div className="hidden md:block rounded border border-white/10">
        <div className="overflow-x-auto">
          <div className="min-w-[900px] overflow-hidden">
            <div className="grid grid-cols-13 gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
              <div className="col-span-2">Data</div>
              <div className="col-span-4">Descrição</div>
              <div className="col-span-2">Conta</div>
              <div className="col-span-2">Categoria</div>
              <div className="col-span-2 text-right">Valor</div>
              <div className="col-span-1 text-right">Ações</div>
            </div>

            {loading ? (
              <div className="p-4 text-sm text-white/60">Carregando…</div>
            ) : txs.length === 0 ? (
              <div className="p-4 text-sm text-white/60">Sem transações para esse filtro.</div>
            ) : (
              txs.map((r) => {
                const editing = editingId === r.id;
                const busy = busyId === r.id;

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
                        <button onClick={() => startEdit(r)} className="rounded border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10">
                          Editar
                        </button>
                        <button onClick={() => removeTx(r.id)} className="text-white/50 hover:text-white/90" title="Remover">
                          ×
                        </button>
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
                      <div className="rounded border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-1 text-[11px] text-[#D4AF37] space-y-1">
                        <div>COMPROVANTE (edição): Anexar → Ler (OCR) → Salvar</div>
                        <div className="text-white/70">
                          {!r.receipt_path
                            ? 'Status: sem comprovante'
                            : r.receipt_parsed_at
                              ? `Status: OCR feito em ${fmtBRDateTime(r.receipt_parsed_at)}`
                              : 'Status: comprovante anexado (não lido)'}
                        </div>
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
                          placeholder="Valor (ex: 1.000,00)"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <label className="cursor-pointer rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10">
                          {busy ? 'Enviando…' : 'Anexar'}
                          <input
                            type="file"
                            accept="image/*"
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
                          onClick={() => void parseReceiptForEdit(r, !!r.receipt_parsed_at)}
                          className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                          disabled={busy || !r.receipt_path}
                        >
                          {busy ? 'Lendo…' : r.receipt_parsed_at ? 'Reler' : 'Ler'}
                        </button>

                        {r.receipt_path && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const url = await receiptSignedUrl(r.receipt_path!);
                                window.open(url, '_blank', 'noreferrer');
                              } catch (e: any) {
                                setError(e?.message ? String(e.message) : String(e));
                              }
                            }}
                            className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                            disabled={busy}
                          >
                            Ver
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <select className="w-full rounded border border-white/15 bg-black/20 p-2 text-sm" value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)}>
                        <option value="">(Conta)</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <select className="w-full rounded border border-white/15 bg-black/20 p-2 text-sm" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                        <option value="">(Categoria)</option>
                        {filteredEditCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <button onClick={() => void saveEdit(r.id)} className="rounded bg-white px-3 py-2 text-xs font-medium text-black" type="button" disabled={busy}>
                        Salvar
                      </button>
                      <button onClick={cancelEdit} className="rounded border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/10" type="button" disabled={busy}>
                        Cancelar
                      </button>
                      <button onClick={() => removeTx(r.id)} className="rounded border border-red-500/40 px-3 py-2 text-xs text-red-200 hover:bg-red-500/10" type="button" disabled={busy}>
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {!loading && hasMore && (
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="w-full rounded border border-white/15 bg-black/20 p-3 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingMore ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}