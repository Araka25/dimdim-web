'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

const nav = [
  { href: '/app/dashboard', label: 'Painel' },
  { href: '/app/transactions', label: 'Transações' },
  { href: '/app/accounts', label: 'Contas' },
  { href: '/app/categories', label: 'Categorias' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  // fecha o drawer ao trocar rota
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ESC fecha
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    if (mobileOpen) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app/dashboard" className="font-semibold tracking-tight">
            Dimdim
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex md:items-center md:gap-1" aria-label="Navegação">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'rounded px-3 py-1.5 text-sm transition ' +
                    (active ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10')
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Desktop logout */}
            <button
              onClick={logout}
              className="hidden md:inline-flex rounded bg-[#D4AF37] px-3 py-1.5 text-sm font-medium text-black"
            >
              Sair
            </button>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10 md:hidden"
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden">
            {/* overlay */}
            <button
              aria-label="Fechar menu"
              className="fixed inset-0 z-20 cursor-default bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            {/* panel */}
            <div className="fixed right-0 top-0 z-30 h-full w-[82%] max-w-xs border-l border-white/10 bg-neutral-950 p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/90">Menu</div>
                <button
                  type="button"
                  className="rounded border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                  aria-label="Fechar"
                  onClick={() => setMobileOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-1">
                {nav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={
                        'block rounded px-3 py-2 text-sm transition ' +
                        (active ? 'bg-white text-black' : 'text-white/85 hover:bg-white/10')
                      }
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <button
                  onClick={logout}
                  className="w-full rounded bg-[#D4AF37] px-3 py-2 text-sm font-medium text-black"
                >
                  Sair
                </button>
                <div className="mt-2 text-xs text-white/50">Dica: toque fora para fechar.</div>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}