import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-3xl font-bold">Dimdim</h1>
        <p className="text-white/70">Controle financeiro (MVP)</p>
        <div className="flex gap-3">
          <Link className="px-4 py-2 rounded bg-blue-600 text-white" href="/login">Entrar</Link>
          <Link className="px-4 py-2 rounded bg-white text-black" href="/signup">Criar conta</Link>
        </div>
      </div>
    </main>
  );
}
