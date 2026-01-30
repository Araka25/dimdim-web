import { supabaseServer } from '@/lib/supabaseServer';

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="rounded border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-white/70">Usuário logado</div>
        <div className="font-mono text-sm">{data.user?.email}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Entradas (mês)">R$ 0,00</Card>
        <Card title="Saídas (mês)">R$ 0,00</Card>
        <Card title="Saldo (mês)">R$ 0,00</Card>
      </div>

      <p className="text-sm text-white/60">
        Próximo passo: criar tabelas no Supabase e ligar Transações/Contas/Categorias.
      </p>
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
