"use client";

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

export type MonthlyChartsProps = {
  expenseByCategory: { name: string; value: number }[];
  dailyBalance: { day: number; saldo: number }[];
  budgetChart: { name: string; gasto: number; limite: number; pct: number }[];
};

function MonthlyCharts({ expenseByCategory, dailyBalance, budgetChart }: MonthlyChartsProps) {
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return
  (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm text-white/70">Gastos por categoria (Top 10)</div>
          {expenseByCategory.length === 0 ? (
            <div className="text-sm text-white/60">Sem gastos no mês.</div>
          ) : (
            <ResponsiveContainer width="100%" aspect={2.2}>
              <BarChart data={expenseByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                <Tooltip
                  formatter={(v: any) => brl(Number(v))}
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)" }}
                />
                <Bar dataKey="value" fill="#D4AF37" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm text-white/70">Saldo acumulado no mês</div>
          <ResponsiveContainer width="100%" aspect={2.2}>
            <LineChart data={dailyBalance}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
              <Tooltip
                formatter={(v: any) => brl(Number(v))}
                contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)" }}
              />
              <Line type="monotone" dataKey="saldo" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-4">
        <div className="mb-2 text-sm text-white/70">Orçamento vs Gasto (categorias com orçamento)</div>
        {budgetChart.length === 0 ? (
          <div className="text-sm text-white/60">Nenhum orçamento definido para este mês.</div>
        ) : (
          <ResponsiveContainer width="100%" aspect={2.6}>
            <BarChart data={budgetChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const gasto = Number(payload.find((p) => p.dataKey === "gasto")?.value ?? 0);
                  const limite = Number(payload.find((p) => p.dataKey === "limite")?.value ?? 0);
                  const pct = limite > 0 ? (gasto / limite) * 100 : 0;

                  return (
                    <div
                      style={{
                        background: "#111",
                        border: "1px solid rgba(255,255,255,0.15)",
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          color: "rgba(255,255,255,0.9)",
                          fontWeight: 600,
                          marginBottom: 6,
                        }}
                      >
                        {label}
                      </div>
                      <div style={{ color: "#ef4444" }}>Gasto: {brl(gasto)}</div>
                      <div style={{ color: "rgba(212,175,55,0.9)" }}>Limite: {brl(limite)}</div>
                      <div style={{ color: "rgba(255,255,255,0.75)" }}>% usado: {pct.toFixed(1)}%</div>
                    </div>
                  );
                }}
              />

              <Legend />
              <Bar dataKey="limite" name="Limite" fill="rgba(212,175,55,0.55)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="gasto" name="Gasto" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default MonthlyCharts;
