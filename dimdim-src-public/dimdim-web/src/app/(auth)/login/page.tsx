'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);
    window.location.href = '/app/dashboard';
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Entrar — Dimdim</h1>
        <input className="w-full border rounded p-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border rounded p-3" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full rounded p-3 bg-blue-600 text-white">Entrar</button>
        <a className="text-sm underline" href="/signup">Criar conta</a>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </form>
    </main>
  );
}
