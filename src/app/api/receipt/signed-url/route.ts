import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { path } = (await req.json()) as { path?: string };
    if (!path) return NextResponse.json({ error: 'path obrigatório' }, { status: 400 });

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRole) {
      return NextResponse.json(
        { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas' },
        { status: 500 }
      );
    }

    const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 60 * 5); // 5 min

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}