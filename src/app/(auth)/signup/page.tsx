'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return setMsg(error.message);
    window.location.href = '/login';
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Criar conta — Dimdim</h1>
        <input className="w-full border rounded p-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border rounded p-3" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full rounded p-3 bg-black text-white">Criar conta</button>
        <a className="text-sm underline" href="/login">Já tenho conta</a>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </form>
    </main>
  );
}
