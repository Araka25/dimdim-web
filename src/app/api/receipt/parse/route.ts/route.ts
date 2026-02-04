import { NextResponse } from "next/server";
import Tesseract from "tesseract.js";

export const runtime = "nodejs"; // importante: não rodar no edge

type ParseResult = {
  merchant: string | null;
  amount: string | null;   // "123,45"
  dateStr: string | null;  // "YYYY-MM-DD"
  rawText: string;
};

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function extractAmount(text: string): string | null {
  // tenta achar algo como 1.234,56 ou 123,45 ou 123.45
  const candidates = text.match(/(\d{1,3}(\.\d{3})*,\d{2})|(\d+[\.,]\d{2})/g);
  if (!candidates || candidates.length === 0) return null;

  // pega o MAIOR valor como heurística (geralmente é o total)
  const toNumber = (v: string) => {
    const x = v.replace(/\./g, "").replace(",", ".");
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };

  const best = candidates
    .map((v) => ({ v, n: toNumber(v) }))
    .sort((a, b) => b.n - a.n)[0];

  if (!best || best.n <= 0) return null;

  // retorna no formato pt-BR "123,45"
  return best.n.toFixed(2).replace(".", ",");
}

function extractDate(text: string): string | null {
  // dd/mm/aaaa ou dd-mm-aaaa
  const m = text.match(/(\b\d{2})[\/\-](\d{2})[\/\-](\d{4}\b)/);
  if (!m) return null;
  const dd = m[1];
  const mm = m[2];
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function extractMerchant(text: string): string | null {
  // heurística simples: primeira linha "forte"
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  if (lines.length === 0) return null;

  // evita linhas comuns
  const blacklist = ["CNPJ", "CPF", "DATA", "HORA", "TOTAL", "VALOR", "R$", "RS"];
  for (const l of lines.slice(0, 6)) {
    const up = l.toUpperCase();
    if (blacklist.some((b) => up.includes(b))) continue;
    return normalizeText(l);
  }

  return normalizeText(lines[0]);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageUrl = body?.imageUrl as string | undefined;

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl obrigatório" }, { status: 400 });
    }

    const { data } = await Tesseract.recognize(imageUrl, "por", {
      // logger: (m) => console.log(m), // se quiser debug
    });

    const rawText = data?.text ?? "";
    const text = rawText || "";
    const amount = extractAmount(text);
    const dateStr = extractDate(text);
    const merchant = extractMerchant(text);

    const result: ParseResult = {
      merchant,
      amount,
      dateStr,
      rawText: rawText.slice(0, 5000),
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ? String(e.message) : String(e) },
      { status: 500 }
    );
  }
}
