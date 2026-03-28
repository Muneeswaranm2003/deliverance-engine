import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Send,
  Loader2,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

interface RecentCampaignsProps {
  campaigns: Campaign[] | undefined;
  isLoading: boolean;
}

const getStatusConfig = (status: Campaign["status"]) => {
  switch (status) {
    case "sent":
      return { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Sent" };
    case "scheduled":
      return { icon: Calendar, color: "text-primary", bg: "bg-primary/10", label: "Scheduled" };
    case "sending":
      return { icon: Sparkles, color: "text-amber-400", bg: "bg-amber-400/10", label: "Sending" };
    default:
      return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/50", label: "Draft" };
  }
};

export const RecentCampaigns = ({ campaigns, isLoading }: RecentCampaignsProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <div className="p-12 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
          >
            <Send className="w-8 h-8 text-primary" />
          </motion.div>
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
          {campaigns.map((campaign, index) => {
            const status = getStatusConfig(campaign.status);
            const StatusIcon = status.icon;
            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + index * 0.05 }}
                whileHover={{ x: 4, backgroundColor: "hsl(var(--secondary) / 0.3)" }}
                className="p-4 transition-colors cursor-pointer flex items-center justify-between"
                onClick={() =>
                  campaign.status === "draft"
                    ? navigate(`/campaigns/${campaign.id}/edit`)
                    : navigate(`/campaigns/${campaign.id}`)
                }
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    whileHover={{ rotate: 6 }}
                    className={`w-10 h-10 rounded-lg ${status.bg} flex items-center justify-center`}
                  >
                    <StatusIcon className={`w-4 h-4 ${status.color}`} />
                  </motion.div>
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">{campaign.subject}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className={`gap-1.5 ${status.bg} ${status.color} border-0`}>
                    {status.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    {format(new Date(campaign.created_at), "MMM d")}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
