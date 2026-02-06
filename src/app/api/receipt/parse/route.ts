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

    const json = JSON.parse(text) as Result;
    return NextResponse.json(json);
  } catch (e: any) {
    console.error('receipt/parse error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
