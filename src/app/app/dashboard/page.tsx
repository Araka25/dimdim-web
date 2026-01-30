import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('amount_cents, kind, occurred_at')
    .gte('occurred_at', start.toISOString())
    .lt('occurred_at', end.toISOString());

  const rows = txs ?? [];
  const income = rows
    .filter((t: any) => t.kind === 'income')
    .reduce((acc: number, t: any) => acc + (t.amount_cents ?? 0), 0);

  const expense = rows
    .filter((t: any) => t.kind === 'expense')
    .reduce((acc: number, t: any) => acc + (t.amount_cents ?? 0), 0);

  const balance = income - expense;

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Painel</h1>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error.message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Entradas (mês)">{fmtBRL(income)}</Card>
        <Card title="Saídas (mês)">{fmtBRL(expense)}</Card>
        <Card title="Saldo (mês)">{fmtBRL(balance)}</Card>
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70">Usuário</div>
        <div className="font-mono text-sm">{user?.email}</div>
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70">Atalhos</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-white/80 space-y-1">
          <li>
            <Link className="underline" href="/app/accounts">Contas</Link>
          </li>
          <li>
            <Link className="underline" href="/app/categories">Categorias</Link>
          </li>
          <li>
            <Link className="underline" href="/app/transactions">Transações</Link>
          </li>
        </ul>
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
