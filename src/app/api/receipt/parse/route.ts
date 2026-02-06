set -euo pipefail

BASE="src/app/api/receipt/parse"
FILE="$BASE/route.ts"
BADDIR="$BASE/route.ts"

mkdir -p "$BASE"

# Se route.ts estiver como PASTA (errado), tentar mover o arquivo de dentro e remover a pasta
if [ -d "$BADDIR" ]; then
  if [ -f "$BADDIR/route.ts" ]; then
    mv "$BADDIR/route.ts" "$FILE"
  fi
  rmdir "$BADDIR" 2>/dev/null || true
fi

# Escrever o código completo do OCR (Tesseract) no arquivo correto
cat > "$FILE" <<'TS'
import { NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

export const runtime = 'nodejs';

type ParseResult = {
  merchant: string | null;
  amount: string | null; // "123,45"
  dateStr: string | null; // "YYYY-MM-DD"
  rawText: string;
};

function normalizeText(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function extractAmount(text: string): string | null {
  // pega valores tipo: 1.234,56 ou 123,45 ou 123.45
  const candidates = text.match(/(\d{1,3}(\.\d{3})*,\d{2})|(\d+[\.,]\d{2})/g);
  if (!candidates || candidates.length === 0) return null;

  const toNumber = (v: string) => {
    const x = v.replace(/\./g, '').replace(',', '.');
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };

  // escolhe o maior número (normalmente o total)
  const best = candidates
    .map((v) => ({ v, n: toNumber(v) }))
    .sort((a, b) => b.n - a.n)[0];

  if (!best || best.n <= 0) return null;
  return best.n.toFixed(2).replace('.', ',');
}

function extractDate(text: string): string | null {
  // DD/MM/YYYY ou DD-MM-YYYY
  const m = text.match(/(\b\d{2})[\/\-](\d{2})[\/\-](\d{4}\b)/);
  if (!m) return null;
  const dd = m[1];
  const mm = m[2];
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function extractMerchant(text: string): string | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  if (lines.length === 0) return null;

  // tenta pegar a primeira linha "boa" como nome
  const blacklist = ['CNPJ', 'CPF', 'DATA', 'HORA', 'TOTAL', 'VALOR', 'R$', 'RS'];
  for (const l of lines.slice(0, 10)) {
    const up = l.toUpperCase();
    if (blacklist.some((b) => up.includes(b))) continue;
    return normalizeText(l);
  }

  return normalizeText(lines[0]);
}

export async function POST(req: Request) {
  try {
    const { imageUrl } = (await req.json()) as { imageUrl?: string };

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl obrigatório' }, { status: 400 });
    }

    // OCR via URL pública
    const { data } = await Tesseract.recognize(imageUrl, 'por');
    const rawText = data?.text ?? '';

    const result: ParseResult = {
      merchant: extractMerchant(rawText),
      amount: extractAmount(rawText),
      dateStr: extractDate(rawText),
      rawText: rawText.slice(0, 5000),
    };

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Receipt parse error:', e);
    return NextResponse.json(
      { error: e?.message ? String(e.message) : String(e) },
      { status: 500 }
    );
  }
}
TS

# Instalar dependência
npm i tesseract.js

# Validar build
npm run build

echo "OK: OCR (Tesseract) pronto em $FILE e build passou."
echo "Agora faça: git add -A && git commit -m \"feat: receipt OCR api\" && git push"