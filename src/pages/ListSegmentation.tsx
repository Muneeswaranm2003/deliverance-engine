import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Send,
  Users,
  Mail,
  CheckCircle2,
  Clock,
  Calendar,
  Search,
  ArrowRight,
  Loader2,
  BarChart3,
  Eye,
  MousePointer,
} from "lucide-react";
import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

const ListSegmentation = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns-segmentation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const { data: campaignStats } = useQuery({
    queryKey: ["campaigns-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("campaign_id, status, opened_at, clicked_at");
      if (error) throw error;
      
      const statsMap: Record<string, { sent: number; delivered: number; opened: number; clicked: number }> = {};
      
      data?.forEach((log) => {
        if (!log.campaign_id) return;
        if (!statsMap[log.campaign_id]) {
          statsMap[log.campaign_id] = { sent: 0, delivered: 0, opened: 0, clicked: 0 };
        }
        if (log.status === "sent" || log.status === "delivered" || log.status === "opened" || log.status === "clicked") {
          statsMap[log.campaign_id].sent++;
        }
        if (log.status === "delivered" || log.status === "opened" || log.status === "clicked") {
          statsMap[log.campaign_id].delivered++;
        }
        if (log.opened_at) {
          statsMap[log.campaign_id].opened++;
        }
        if (log.clicked_at) {
          statsMap[log.campaign_id].clicked++;
        }
      });
      
      return statsMap;
    },
  });

  const filteredCampaigns = campaigns?.filter((campaign) => {
    const matchesSearch =
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: Campaign["status"]) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "scheduled":
        return <Calendar className="w-4 h-4 text-primary" />;
      case "sending":
        return <Send className="w-4 h-4 text-blue-400 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: Campaign["status"]) => {
    switch (status) {
      case "sent":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "scheduled":
        return "bg-primary/10 text-primary border-primary/20";
      case "sending":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "paused":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <AppLayout
      title="List Segmentation"
      description="View individual campaign data and recipient segments"
    >
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaign Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !filteredCampaigns || filteredCampaigns.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Create your first campaign to see segmentation data here"}
            </p>
            <Button variant="hero" onClick={() => navigate("/campaigns/new")}>
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCampaigns.map((campaign, index) => {
            const stats = campaignStats?.[campaign.id] || { sent: 0, delivered: 0, opened: 0, clicked: 0 };
            const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : "0";
            const clickRate = stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(1) : "0";

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="glass hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Send className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold line-clamp-1">{campaign.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {campaign.subject}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="secondary" className={`gap-1.5 ${getStatusColor(campaign.status)}`}>
                        {getStatusIcon(campaign.status)}
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(campaign.created_at), "MMM d, yyyy")}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <p className="font-display text-lg font-bold">{campaign.total_recipients || 0}</p>
                        <p className="text-xs text-muted-foreground">Recipients</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-violet-400 mb-1">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                        <p className="font-display text-lg font-bold">{openRate}%</p>
                        <p className="text-xs text-muted-foreground">Open Rate</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-primary mb-1">
                          <MousePointer className="w-3.5 h-3.5" />
                        </div>
                        <p className="font-display text-lg font-bold">{clickRate}%</p>
                        <p className="text-xs text-muted-foreground">Click Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default ListSegmentation;
