'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

const nav = [
  { href: '/app/dashboard', label: 'Painel' },
  { href: '/app/transactions', label: 'Transações' },
  { href: '/app/accounts', label: 'Contas' },
  { href: '/app/categories', label: 'Categorias' },
  { href: '/app/budgets', label: 'Orçamentos' },
  { href: '/app/reports/monthly', label: 'Relatórios (Mês)' },
  { href: '/app/reports/yearly', label: 'Relatórios (Ano)' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app/dashboard" className="font-semibold tracking-wide">
            Dimdim
          </Link>
          <nav className="flex flex-wrap gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'rounded px-3 py-1.5 text-sm ' +
                    (active ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10')
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button onClick={logout} className="rounded bg-[#D4AF37] px-3 py-1.5 text-sm text-black">
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
