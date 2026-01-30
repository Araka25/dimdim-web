import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-3xl font-bold">Dimdim</h1>
        <p className="text-gray-700">Controle de gastos (MVP)</p>
        <div className="flex gap-3">
          <Link className="px-4 py-2 rounded bg-blue-600 text-white" href="/login">Entrar</Link>
          <Link className="px-4 py-2 rounded bg-black text-white" href="/signup">Criar conta</Link>
        </div>
      </div>
    </main>
  );
}
