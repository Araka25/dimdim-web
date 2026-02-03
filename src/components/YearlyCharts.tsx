"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

type Props = {
  loading: boolean;
  monthly: { month: string; income: number; expense: number; balance: number }[];
  topCategories: { name: string; value: number }[];
};

export default function YearlyCharts({ loading, monthly, topCategories }: Props): React.ReactElement {
  const brl = (v: any) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const balanceStats = React.useMemo(() => {
    if (!monthly || monthly.length === 0) return { pos: 0, neg: 0 };
    let pos = 0;
    let neg = 0;
    for (const m of monthly) {
      if (m.balance > 0) pos++;
      if (m.balance < 0) neg++;
    }
    return { pos, neg };
  }, [monthly]);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm text-white/70">Entradas vs Saídas (por mês)</div>
          {loading ? (
            <div className="text-sm text-white/60">Carregando…</div>
          ) : (
            <ResponsiveContainer width="100%" aspect={2.2}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                <Tooltip
                  formatter={brl}
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)" }}
                />
                <Legend />
                <Bar dataKey="income" name="Entradas" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Saídas" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm text-white/70">
            <span>Saldo mensal (por mês)</span>
            {!loading && (
              <span className="text-xs text-white/60">
                <span className="text-green-400">+{balanceStats.pos}</span>
                {" · "}
                <span className="text-red-400">-{balanceStats.neg}</span>
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-white/60">Carregando…</div>
          ) : (
            <ResponsiveContainer width="100%" aspect={2.2}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                <Tooltip
                  formatter={brl}
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)" }}
                />
                <Line type="monotone" dataKey="balance" name="Saldo" stroke="#60a5fa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-4">
        <div className="mb-2 text-sm text-white/70">Top 5 categorias (Saídas no ano)</div>
        {loading ? (
          <div className="text-sm text-white/60">Carregando…</div>
        ) : topCategories.length === 0 ? (
          <div className="text-sm text-white/60">Sem saídas no ano.</div>
        ) : (
          <ResponsiveContainer width="100%" aspect={2.6}>
            <BarChart data={topCategories} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const value = Number(payload[0]?.value ?? 0);

                  return (
                    <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)", padding: 12 }}>
                      <div style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600, marginBottom: 6 }}>
                        {label}
                      </div>
                      <div style={{ color: "rgba(212,175,55,0.9)" }}>Gasto: {brl(value)}</div>
                    </div>
                  );
                }}
              />

              <Bar dataKey="value" fill="#D4AF37" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
