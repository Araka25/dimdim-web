'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

const nav = [
  { href: '/app/dashboard', label: 'Painel', icon: '▦' },
  { href: '/app/transactions', label: 'Transações', icon: '⇄' },
  { href: '/app/accounts', label: 'Contas', icon: '🏦' },
  { href: '/app/categories', label: 'Categorias', icon: '🏷' },
  { href: '/app/reports/month', label: 'Rel. Mês', icon: '📅' },
  { href: '/app/reports/year', label: 'Rel. Ano', icon: '📈' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app/dashboard" className="font-semibold tracking-tight">
            Dimdim
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex md:items-center md:gap-2" aria-label="Navegação">
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'rounded px-3 py-1.5 text-sm font-medium transition inline-flex items-center gap-2 ' +
                    (active ? 'bg-[#D4AF37] text-black' : 'text-white/80 hover:bg-white/10')
                  }
                >
                  <span aria-hidden className="text-base leading-none">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button onClick={logout} className="rounded bg-[#D4AF37] px-3 py-1.5 text-sm font-medium text-black">
            Sair
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden border-t border-white/10">
          <nav aria-label="Navegação" className="mx-auto max-w-5xl px-2 py-2">
            <div className="flex gap-2 overflow-x-auto px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {nav.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      'shrink-0 rounded-full px-3 py-2 text-sm font-medium transition inline-flex items-center gap-2 ' +
                      (active
                        ? 'bg-[#D4AF37] text-black'
                        : 'border border-white/15 bg-white/5 text-white/85 hover:bg-white/10')
                    }
                    title={item.label}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {item.icon}
                    </span>
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}