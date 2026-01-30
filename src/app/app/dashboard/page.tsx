import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Entradas (mês)">R$ 0,00</Card>
        <Card title="Saídas (mês)">R$ 0,00</Card>
        <Card title="Saldo (mês)">R$ 0,00</Card>
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70">Usuário</div>
        <div className="font-mono text-sm">{data.user?.email}</div>
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70">Comece por aqui</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-white/80 space-y-1">
          <li>
            Rode o SQL <code className="text-white">supabase_schema.sql</code> no Supabase
          </li>
          <li>
            Cadastre uma conta em <Link className="underline" href="/app/accounts">/app/accounts</Link>
          </li>
          <li>
            Cadastre categorias em <Link className="underline" href="/app/categories">/app/categories</Link>
          </li>
          <li>
            Lance transações em <Link className="underline" href="/app/transactions">/app/transactions</Link>
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
