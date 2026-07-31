import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Send, Users, BarChart3, ArrowUpRight, Zap, Mail } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { EmailActivityChart } from "@/components/dashboard/EmailActivityChart";
import { RecentCampaigns } from "@/components/dashboard/RecentCampaigns";
import { DateRangeFilter, makePresetRange, type AnalyticsRange } from "@/components/dashboard/DateRangeFilter";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { ScheduledExportsDialog } from "@/components/dashboard/ScheduledExportsDialog";

type Campaign = Tables<"campaigns">;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>(() => makePresetRange(7, "7 days"));
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", fromIso, toIso],
    retry: 1,
    queryFn: async () => {
      const inRange = <T,>(q: T) =>
        (q as unknown as { gte: (c: string, v: string) => { lte: (c: string, v: string) => T } })
          .gte("created_at", fromIso)
          .lte("created_at", toIso);

      const [campaignsRes, contactsRes, emailsSentRes, automationsRes, openedRes] = await Promise.all([
        inRange(supabase.from("campaigns").select("id", { count: "exact", head: true })),
        inRange(supabase.from("contacts").select("id", { count: "exact", head: true })),
        inRange(supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("status", "sent")),
        inRange(supabase.from("automations").select("id", { count: "exact", head: true }).eq("enabled", true)),
        inRange(supabase.from("email_logs").select("id", { count: "exact", head: true }).not("opened_at", "is", null)),
      ]);

      const sent = emailsSentRes.count || 0;
      const opened = openedRes.count || 0;
      const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;

      return {
        campaigns: campaignsRes.count || 0,
        contacts: contactsRes.count || 0,
        emailsSent: sent,
        automations: automationsRes.count || 0,
        openRate,
      };
    },
  });

  const { data: recentCampaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["recent-campaigns", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Campaign[];
    },
  });

  const statsDisplay = [
    {
      label: "Campaigns",
      value: stats?.campaigns || 0,
      icon: Send,
      color: "text-primary",
      bgColor: "bg-primary/10",
      trend: 12,
    },
    {
      label: "New Contacts",
      value: stats?.contacts || 0,
      icon: Users,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      trend: 8,
    },
    {
      label: "Emails Sent",
      value: stats?.emailsSent || 0,
      icon: Mail,
      color: "text-violet-400",
      bgColor: "bg-violet-400/10",
    },
    {
      label: "Open Rate",
      value: stats?.openRate || 0,
      icon: BarChart3,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
      suffix: "%",
    },
  ];

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <AppLayout
      title="Dashboard"
      description={`${greeting()}, ${user?.email?.split("@")[0] || "User"}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <ExportCsvButton
            range={range}
            stats={stats}
            campaigns={recentCampaigns}
            disabled={statsLoading || campaignsLoading}
          />
          <ScheduledExportsDialog range={range} />
          <Button variant="hero" onClick={() => navigate("/campaigns/new")} className="gap-2">
            Create Campaign
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        </div>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsDisplay.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            bgColor={stat.bgColor}
            index={index}
            isLoading={statsLoading}
            trend={stat.trend}
            suffix={stat.suffix}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <QuickActions />
      </div>

      {/* Chart + Recent Campaigns */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <EmailActivityChart range={range} />
        </div>
        <div className="lg:col-span-2">
          <RecentCampaigns campaigns={recentCampaigns} isLoading={campaignsLoading} />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
