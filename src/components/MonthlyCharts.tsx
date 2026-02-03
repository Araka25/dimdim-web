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

export function MonthlyCharts({
  expenseByCategory,
  dailyBalance,
  budgetChart,
}: {
  expenseByCategory: { name: string; value: number }[];
  dailyBalance: { day: number; saldo: number }[];
  budgetChart: { name: string; gasto: number; limite: number; pct: number }[];
}) 
return (
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
                  formatter={(v: any) =>
                    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  }
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
                formatter={(v: any) =>
                  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                }
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
                formatter={(v: any) =>
                  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                }
                contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)" }}
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