import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2, BarChart3 } from "lucide-react";
import { format, subDays } from "date-fns";

export const EmailActivityChart = () => {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["email-activity-chart"],
    queryFn: async () => {
      const days = 7;
      const results: { date: string; sent: number; opened: number; clicked: number }[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const day = subDays(new Date(), i);
        const dayStart = format(day, "yyyy-MM-dd") + "T00:00:00";
        const dayEnd = format(day, "yyyy-MM-dd") + "T23:59:59";

        const [sentRes, openedRes, clickedRes] = await Promise.all([
          supabase.from("email_logs").select("id", { count: "exact", head: true }).gte("created_at", dayStart).lte("created_at", dayEnd).eq("status", "sent"),
          supabase.from("email_logs").select("id", { count: "exact", head: true }).gte("created_at", dayStart).lte("created_at", dayEnd).not("opened_at", "is", null),
          supabase.from("email_logs").select("id", { count: "exact", head: true }).gte("created_at", dayStart).lte("created_at", dayEnd).not("clicked_at", "is", null),
        ]);

        results.push({
          date: format(day, "EEE"),
          sent: sentRes.count || 0,
          opened: openedRes.count || 0,
          clicked: clickedRes.count || 0,
        });
      }

      return results;
    },
  });

  const hasData = chartData && chartData.some(d => d.sent > 0 || d.opened > 0 || d.clicked > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="glass rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Email Activity</h2>
          <p className="text-muted-foreground text-sm">Last 7 days performance</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            Sent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Opened
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            Clicked
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[220px]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
          <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No email activity yet</p>
          <p className="text-xs mt-1">Send your first campaign to see data here</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                fontSize: "12px",
              }}
              cursor={{ fill: "hsl(var(--primary) / 0.05)" }}
            />
            <Bar dataKey="sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="opened" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="clicked" fill="hsl(263 70% 50%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};
