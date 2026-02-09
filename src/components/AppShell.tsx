'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type IconProps = { className?: string };

function IconDashboard({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 13.5a2.5 2.5 0 0 1 2.5-2.5h2A2.5 2.5 0 0 1 11 13.5v4A2.5 2.5 0 0 1 8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-4ZM13 6.5A2.5 2.5 0 0 1 15.5 4h2A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-2A2.5 2.5 0 0 1 13 17.5v-11ZM4 6.5A2.5 2.5 0 0 1 6.5 4h2A2.5 2.5 0 0 1 11 6.5v2A2.5 2.5 0 0 1 8.5 11h-2A2.5 2.5 0 0 1 4 8.5v-2ZM13 13.5A2.5 2.5 0 0 1 15.5 11h2A2.5 2.5 0 0 1 20 13.5v4A2.5 2.5 0 0 1 17.5 20h-2A2.5 2.5 0 0 1 13 17.5v-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrows({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 7h10m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 17H7m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBank({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 10V19m4-9V19m4-9V19m4-9V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4 4.5 8.5h15L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function IconTag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3.5 12.2V6.8A2.3 2.3 0 0 1 5.8 4.5h5.4a2.3 2.3 0 0 1 1.6.67l8.0 8.0a2.3 2.3 0 0 1 0 3.25l-4.3 4.3a2.3 2.3 0 0 1-3.25 0l-8.0-8.0a2.3 2.3 0 0 1-.67-1.57Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8.3h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M5.5 6.5h13A2 2 0 0 1 20.5 8.5v11A2 2 0 0 1 18.5 21.5h-13A2 2 0 0 1 3.5 19.5v-11A2 2 0 0 1 5.5 6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconChart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 20V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 16l3-4 3 2 5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const nav = [
  { href: '/app/dashboard', label: 'Painel', Icon: IconDashboard },
  { href: '/app/transactions', label: 'Transações', Icon: IconArrows },
  { href: '/app/accounts', label: 'Contas', Icon: IconBank },
  { href: '/app/categories', label: 'Categorias', Icon: IconTag },
  { href: '/app/reports/monthly', label: 'Rel. Mês', Icon: IconCalendar },
  { href: '/app/reports/yearly', label: 'Rel. Ano', Icon: IconChart },
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
  }

  return (
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
              const Icon = item.Icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'rounded px-3 py-1.5 text-sm font-medium transition inline-flex items-center gap-2 ' +
                    (active ? 'bg-[#D4AF37] text-black' : 'text-white/80 hover:bg-white/10')
                  }
                >
                  <Icon className="h-4 w-4" />
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
                const Icon = item.Icon;

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
                    <Icon className="h-4 w-4" />
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