import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { Buffer } from 'buffer';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

type Result = {
  merchant: string | null;
  amount: string | null; // "123,45"
  dateStr: string | null; // "YYYY-MM-DD"
};

function toDataUrl(mime: string, base64: string) {
  return `data:${mime};base64,${base64}`;
}

function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(id) };
}

function isTmpPathForUser(path: string, userId: string) {
  return path.startsWith(`tmp/${userId}/`);
}

export async function GET() {
  return NextResponse.json({ ok: true, note: 'use POST com { path }' }, { status: 405 });
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 });

  const supaUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supaUrl || !anon) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas' },
      { status: 500 }
    );
  }
  if (!serviceRole) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const path = body?.path as string | undefined;
    if (!path) return NextResponse.json({ error: 'path obrigatório' }, { status: 400 });

    // Auth via cookies do Next
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supaUrl, anon, {
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

    if (isTmpPathForUser(path, userId)) {
      allowed = true;
    } else {
      const { data: tx, error: txErr } = await supabaseAuth
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('receipt_path', path)
        .maybeSingle();

      if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
      allowed = !!tx;
    }

    if (!allowed) return NextResponse.json({ error: 'Sem permissão para ler este comprovante' }, { status: 403 });

    // Service role: assinar URL do bucket privado
    const supabaseService = createClient(supaUrl, serviceRole, { auth: { persistSession: false } });

    const { data: signed, error: signErr } = await supabaseService.storage.from('receipts').createSignedUrl(path, 60 * 5);
    if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 });

    const signedUrl = signed.signedUrl;

    // baixar imagem com timeout + limite
    const MAX_BYTES = 4 * 1024 * 1024; // 4MB
    const FETCH_TIMEOUT_MS = 10_000;

    const t1 = withTimeout(FETCH_TIMEOUT_MS);
    let imgRes: Response;
    try {
      imgRes = await fetch(signedUrl, { signal: t1.controller.signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return NextResponse.json({ error: 'Timeout ao baixar imagem' }, { status: 504 });
      }
      throw e;
    } finally {
      t1.clear();
    }

    if (!imgRes.ok) return NextResponse.json({ error: 'Falha ao baixar imagem' }, { status: 400 });

    const mimeType = imgRes.headers.get('content-type') || '';
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Arquivo não parece ser uma imagem' }, { status: 400 });
    }

    const contentLength = imgRes.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return NextResponse.json({ error: `Imagem grande demais (> ${MAX_BYTES} bytes)` }, { status: 413 });
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: `Imagem grande demais (> ${MAX_BYTES} bytes)` }, { status: 413 });
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = toDataUrl(mimeType, base64);

    // OpenAI
    const client = new OpenAI({ apiKey, timeout: 25_000 });

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        merchant: { type: ['string', 'null'] },
        amount: { type: ['string', 'null'], description: 'Formato 123,45' },
        dateStr: { type: ['string', 'null'], description: 'Formato YYYY-MM-DD' },
      },
      required: ['merchant', 'amount', 'dateStr'],
    } as const;

    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: { name: 'receipt_parse', schema } },
      messages: [
        { role: 'system', content: 'Extraia dados do comprovante e responda SOMENTE com JSON válido.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extraia merchant, amount (123,45) e dateStr (YYYY-MM-DD).' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const text = resp.choices?.[0]?.message?.content;
    if (!text) throw new Error('Sem resposta do modelo');

    const json = JSON.parse(text) as Result;
    return NextResponse.json(json);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    console.error('receipt/parse error', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
