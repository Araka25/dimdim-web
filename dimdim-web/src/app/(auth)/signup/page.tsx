'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return setMsg(error.message);
      setOk(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Criar conta — Dimdim</h1>
        <input className="w-full border border-white/20 bg-black/20 rounded p-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border border-white/20 bg-black/20 rounded p-3" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={loading} className="w-full rounded p-3 bg-white text-black disabled:opacity-60">
          {loading ? 'Criando…' : 'Criar conta'}
        </button>
        <div className="text-sm text-white/70">
          Já tem conta? <Link className="underline" href="/login">Entrar</Link>
        </div>
        {ok && <p className="text-sm text-emerald-400">Conta criada. Se o Supabase exigir confirmação, confirme no e-mail e depois faça login.</p>}
        {msg && <p className="text-sm text-red-400">{msg}</p>}
      </form>
    </main>
  );
}
