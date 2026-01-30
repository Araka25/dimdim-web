'use client';

import { supabaseBrowser } from '@/lib/supabaseClient';

export default function Dashboard() {
  async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button onClick={logout} className="px-4 py-2 rounded bg-[#D4AF37] text-black">Sair</button>
      </div>
      <p className="mt-4 text-gray-700">Base do Dimdim pronta. Próximo passo: contas, categorias e transações.</p>
    </main>
  );
}
