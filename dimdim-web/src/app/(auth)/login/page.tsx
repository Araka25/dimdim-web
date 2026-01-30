'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function LoginPage() {
  const next = '/app/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMsg(error.message);
      window.location.href = next;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Entrar — Dimdim</h1>
        <input className="w-full border border-white/20 bg-black/20 rounded p-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border border-white/20 bg-black/20 rounded p-3" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={loading} className="w-full rounded p-3 bg-blue-600 text-white disabled:opacity-60">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        <div className="text-sm text-white/70">
          Não tem conta? <Link className="underline" href="/signup">Criar conta</Link>
        </div>
        {msg && <p className="text-sm text-red-400">{msg}</p>}
      </form>
    </main>
  );
}
