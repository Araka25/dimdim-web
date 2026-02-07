import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Buffer } from 'buffer';

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

export async function GET() {
  return NextResponse.json({ ok: true, note: 'use POST com { imageUrl }' }, { status: 405 });
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const imageUrl = body?.imageUrl as string | undefined;

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl obrigatório' }, { status: 400 });
    }
    const allowedPrefix =
  'https://eogmhdmrapptmmjvadhl.supabase.co/storage/v1/object/public/receipts/';

if (!imageUrl.startsWith(allowedPrefix)) {
  return NextResponse.json(
    { error: 'imageUrl inválida (somente receipts públicos do Supabase são aceitos)' },
    { status: 400 }
  );
}
    // ---- Baixar imagem com timeout + validações ----
    const MAX_BYTES = 4 * 1024 * 1024; // 4MB (ajuste se quiser)
    const FETCH_TIMEOUT_MS = 10_000;

    const t1 = withTimeout(FETCH_TIMEOUT_MS);
    let imgRes: Response;
    try {
      imgRes = await fetch(imageUrl, { signal: t1.controller.signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return NextResponse.json({ error: 'Timeout ao baixar imagem' }, { status: 504 });
      }
      throw e;
    } finally {
      t1.clear();
    }

    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Falha ao baixar imagem' }, { status: 400 });
    }

    const mimeType = imgRes.headers.get('content-type') || '';
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL não parece ser uma imagem' }, { status: 400 });
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

    // ---- OpenAI com timeout ----
    const client = new OpenAI({
      apiKey,
      timeout: 25_000, // 25s
    });

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        merchant: { type: ['string', 'null'] },
        amount: { type: ['string', 'null'], description: 'Formato 123,45' },
        dateStr: { type: ['string', 'null'], description: 'Formato YYYY-MM-DD' },
      },
      required: ['merchant', 'amount', 'dateStr'],
    } as const;const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'receipt_parse', schema },
      },
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
    // Erros comuns do OpenAI SDK já vêm com message útil
    const msg = e?.message ? String(e.message) : String(e);
    console.error('receipt/parse error', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}