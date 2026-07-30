import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2, BarChart3, AlertTriangle, RefreshCw } from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import type { AnalyticsRange } from "./DateRangeFilter";

interface EmailActivityChartProps {
  range?: AnalyticsRange;
}

export const EmailActivityChart = ({ range }: EmailActivityChartProps) => {
  const isMobile = useIsMobile();
  const from = range ? range.from : startOfDay(subDays(new Date(), 6));
  const to = range ? range.to : endOfDay(new Date());
  const days = range?.days ?? 7;

  const { data: chartData, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["email-activity-chart", from.toISOString(), to.toISOString()],
    retry: 1,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from("email_logs")
        .select("created_at, status, opened_at, clicked_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: true });

      if (qErr) throw qErr;

      const labelFmt = days > 7 ? "MMM d" : "EEE";
      const buckets = new Map<string, { date: string; sent: number; opened: number; clicked: number }>();
      eachDayOfInterval({ start: from, end: to }).forEach((day) => {
        buckets.set(format(day, "yyyy-MM-dd"), { date: format(day, labelFmt), sent: 0, opened: 0, clicked: 0 });
      });

      (data ?? []).forEach((row) => {
        const key = format(new Date(row.created_at as string), "yyyy-MM-dd");
        const bucket = buckets.get(key);
        if (!bucket) return;
        if (row.status === "sent" || row.opened_at || row.clicked_at) bucket.sent += 1;
        if (row.opened_at) bucket.opened += 1;
        if (row.clicked_at) bucket.clicked += 1;
      });

      return Array.from(buckets.values());
    },
  });

  const hasData = chartData && chartData.some(d => d.sent > 0 || d.opened > 0 || d.clicked > 0);
  const chartHeight = isMobile ? 180 : 220;
  const tickFontSize = isMobile ? 10 : 12;
  const tickInterval = chartData && chartData.length > 14 ? Math.ceil(chartData.length / (isMobile ? 4 : 8)) - 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="glass rounded-xl p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="font-display text-base sm:text-lg font-semibold">Email Activity</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {range ? `${range.label} performance` : "Last 7 days performance"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] sm:text-xs">
          {[
            { label: "Sent", cls: "bg-primary" },
            { label: "Opened", cls: "bg-emerald-400" },
            { label: "Clicked", cls: "bg-violet-400" },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${l.cls}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height: chartHeight }}>
          <AlertTriangle className="w-9 h-9 mb-3 text-destructive/70" />
          <p className="text-xs sm:text-sm">Couldn't load email activity</p>
          <p className="text-[11px] sm:text-xs mt-1 text-center px-4 max-w-xs truncate">
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height: chartHeight }}>
          <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-xs sm:text-sm">No email activity yet</p>
          <p className="text-[11px] sm:text-xs mt-1 text-center px-4">Send your first campaign to see data here</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} barGap={isMobile ? 1 : 2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
              tickFormatter={(v: string) => (isMobile && days <= 7 ? v.slice(0, 1) : v)}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: tickFontSize }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: tickFontSize }}
              width={isMobile ? 24 : 34}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`)}
              allowDecimals={false}
            />
            <Tooltip
              wrapperStyle={{ zIndex: 20, maxWidth: isMobile ? 160 : 240 }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                fontSize: isMobile ? "11px" : "12px",
                padding: isMobile ? "6px 8px" : "8px 12px",
              }}
              labelStyle={{ marginBottom: 2, fontWeight: 600 }}
              itemStyle={{ padding: 0 }}
              cursor={{ fill: "hsl(var(--primary) / 0.05)" }}
            />
            <Bar dataKey="sent" name="Sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={isMobile ? 14 : 32} />
            <Bar dataKey="opened" name="Opened" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} maxBarSize={isMobile ? 14 : 32} />
            <Bar dataKey="clicked" name="Clicked" fill="hsl(263 70% 50%)" radius={[4, 4, 0, 0]} maxBarSize={isMobile ? 14 : 32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
};
