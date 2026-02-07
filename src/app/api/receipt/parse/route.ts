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

export async function GET() {
  return NextResponse.json({ ok: true, note: 'use POST com { imageUrl }' }, { status: 405 });
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const imageUrl = body?.imageUrl as string | undefined;

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl obrigatório' }, { status: 400 });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Falha ao baixar imagem' }, { status: 400 });
    }

    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = toDataUrl(mimeType, base64);

    const client = new OpenAI({ apiKey });

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

    const raw = JSON.parse(text) as Result;

const json: Result = {
  merchant: normalizeMerchant(raw.merchant),
  amount: normalizeAmount(raw.amount),
  dateStr: normalizeDateStr(raw.dateStr),
};

return NextResponse.json(json);
  } catch (e: any) {
    console.error('receipt/parse error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}function normalizeAmount(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();

  // pega o último número com 2 casas decimais (geralmente o total)
  const matches = s.match(/(\d{1,3}(\.\d{3})*,\d{2})|(\d+[\.,]\d{2})/g);
  if (!matches?.length) return null;

  const raw = matches[matches.length - 1];
  const n = Number(raw.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;

  return n.toFixed(2).replace('.', ',');
}

function normalizeDateStr(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();

  // já está em YYYY-MM-DD?
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const yyyy = Number(iso[1]), mm = Number(iso[2]), dd = Number(iso[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return s;
  }

  // DD/MM/YYYY ou DD-MM-YYYY
  const br = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) {
    const dd = Number(br[1]), mm = Number(br[2]), yyyy = Number(br[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const mmStr = String(mm).padStart(2, '0');
    const ddStr = String(dd).padStart(2, '0');
    return `${yyyy}-${mmStr}-${ddStr}`;
  }

  return null;
}

function normalizeMerchant(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  // limita tamanho (evita devolver texto enorme)
  return s.slice(0, 80);
}
