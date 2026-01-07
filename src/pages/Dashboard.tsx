import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Send,
  Users,
  BarChart3,
  Loader2,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [campaignsRes, contactsRes, emailLogsRes] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("status", "sent"),
      ]);

      return {
        campaigns: campaignsRes.count || 0,
        contacts: contactsRes.count || 0,
        emailsSent: emailLogsRes.count || 0,
      };
    },
  });

  const { data: recentCampaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["recent-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as Campaign[];
    },
  });

  const statsDisplay = [
    {
      label: "Total Campaigns",
      value: statsLoading ? "—" : stats?.campaigns.toString() || "0",
      icon: Send,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Total Contacts",
      value: statsLoading ? "—" : stats?.contacts.toString() || "0",
      icon: Users,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: "Emails Sent",
      value: statsLoading ? "—" : stats?.emailsSent.toString() || "0",
      icon: BarChart3,
      color: "text-violet-400",
      bgColor: "bg-violet-400/10",
    },
  ];

  const getStatusIcon = (status: Campaign["status"]) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "scheduled":
        return <Calendar className="w-3.5 h-3.5 text-primary" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <AppLayout
      title="Dashboard"
      description={`Welcome back, ${user?.email?.split("@")[0] || "User"}`}
      action={
        <Button variant="hero" onClick={() => navigate("/campaigns/new")} className="gap-2">
          Create Campaign
          <ArrowUpRight className="w-4 h-4" />
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {statsDisplay.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass rounded-xl p-6 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground text-sm">{stat.label}</span>
              {statsLoading ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : (
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              )}
            </div>
            <p className="font-display text-4xl font-bold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Campaigns */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-xl"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Recent Campaigns</h2>
            <p className="text-muted-foreground text-sm">Your latest email campaigns</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/campaigns")} className="gap-2">
            View All
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        </div>

        {campaignsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !recentCampaigns || recentCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Send className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first email campaign to start reaching your audience.
            </p>
            <Button variant="hero" onClick={() => navigate("/campaigns/new")}>
              Create Your First Campaign
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentCampaigns.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="p-4 hover:bg-secondary/30 transition-colors cursor-pointer flex items-center justify-between"
                onClick={() =>
                  campaign.status === "draft"
                    ? navigate(`/campaigns/${campaign.id}/edit`)
                    : navigate(`/campaigns/${campaign.id}`)
                }
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Send className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="gap-1.5">
                    {getStatusIcon(campaign.status)}
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </Badge>
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    {format(new Date(campaign.created_at), "MMM d")}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;
