import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

function isTmpPathForUser(path: string, userId: string) {
  return path.startsWith(`tmp/${userId}/`);
}

export async function POST(req: Request) {
  try {
    const { path } = (await req.json()) as { path?: string };
    if (!path) return NextResponse.json({ error: 'path obrigatório' }, { status: 400 });

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anon) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas' },
        { status: 500 }
      );
    }
    if (!serviceRole) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' }, { status: 500 });
    }

    // Auth via cookies do Next
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    });

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });

    const userId = userData.user?.id;
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    // Autorização do path
    let allowed = false;

    // 1) tmp/<userId>/... (fluxo de "Adicionar" antes de criar transação)
    if (isTmpPathForUser(path, userId)) {
      allowed = true;
    } else {
      // 2) receipt_path em uma transação do próprio usuário
      const { data: tx, error: txErr } = await supabaseAuth
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('receipt_path', path)
        .maybeSingle();

      if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
      allowed = !!tx;
    }

    if (!allowed) return NextResponse.json({ error: 'Sem permissão para acessar este comprovante' }, { status: 403 });

    // Service role: assinar URL do bucket privado
    const supabaseService = createClient(url, serviceRole, { auth: { persistSession: false } });

    const { data, error } = await supabaseService.storage.from('receipts').createSignedUrl(path, 60 * 5);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
