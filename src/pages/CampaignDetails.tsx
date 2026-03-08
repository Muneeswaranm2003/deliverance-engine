import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Pencil,
  Send,
  Users,
  Calendar,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  Pause,
  Loader2,
  MousePointerClick,
  Eye,
  AlertTriangle,
  BarChart3,
  User,
  Globe,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

const statusConfig: Record<
  Campaign["status"],
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline"; color: string }
> = {
  draft: { label: "Draft", icon: Clock, variant: "secondary", color: "text-muted-foreground" },
  scheduled: { label: "Scheduled", icon: Calendar, variant: "outline", color: "text-primary" },
  sending: { label: "Sending", icon: Loader2, variant: "default", color: "text-primary" },
  sent: { label: "Sent", icon: CheckCircle2, variant: "default", color: "text-emerald-400" },
  paused: { label: "Paused", icon: Pause, variant: "secondary", color: "text-yellow-400" },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "destructive", color: "text-destructive" },
};

const CampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    enabled: !!id,
  });

  const { data: recipients } = useQuery({
    queryKey: ["campaign-recipients", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_recipients")
        .select("*")
        .eq("campaign_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: emailLogs } = useQuery({
    queryKey: ["campaign-email-logs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .eq("campaign_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (campaignLoading) {
    return (
      <AppLayout title="Campaign Details">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout title="Campaign Not Found">
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
          <p className="text-muted-foreground mb-6">This campaign may have been deleted.</p>
          <Button variant="outline" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
        </div>
      </AppLayout>
    );
  }

  const status = statusConfig[campaign.status];
  const StatusIcon = status.icon;

  // Compute stats from email logs
  const totalSent = emailLogs?.filter((l) => l.status !== "pending" && l.status !== "failed").length || 0;
  const delivered = emailLogs?.filter((l) => ["delivered", "opened", "clicked"].includes(l.status)).length || 0;
  const opened = emailLogs?.filter((l) => ["opened", "clicked"].includes(l.status)).length || 0;
  const clicked = emailLogs?.filter((l) => l.status === "clicked").length || 0;
  const bounced = emailLogs?.filter((l) => l.status === "bounced").length || 0;
  const failed = emailLogs?.filter((l) => l.status === "failed").length || 0;

  const deliverRate = totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(1) : "0";
  const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : "0";
  const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(1) : "0";
  const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(1) : "0";

  const stats = [
    { label: "Delivered", value: delivered, rate: `${deliverRate}%`, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Opened", value: opened, rate: `${openRate}%`, icon: Eye, color: "text-primary" },
    { label: "Clicked", value: clicked, rate: `${clickRate}%`, icon: MousePointerClick, color: "text-violet-400" },
    { label: "Bounced", value: bounced, rate: `${bounceRate}%`, icon: AlertTriangle, color: "text-yellow-400" },
  ];

  const fade = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <AppLayout
      title=""
      action={
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <Button variant="outline" onClick={() => navigate(`/campaigns/${id}/edit`)} className="gap-2">
              <Pencil className="w-4 h-4" />
              Edit Campaign
            </Button>
          )}
        </div>
      }
    >
      {/* Back + Header */}
      <motion.div {...fade} className="mb-8">
        <button
          onClick={() => navigate("/campaigns")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl font-bold tracking-tight truncate">
                {campaign.name}
              </h1>
              <Badge variant={status.variant} className="gap-1 shrink-0">
                <StatusIcon className={`w-3 h-3 ${campaign.status === "sending" ? "animate-spin" : ""}`} />
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground truncate">{campaign.subject}</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div {...fade} transition={{ delay: 0.05 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="glass border-border/50">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold font-display">{stat.value}</span>
                  <span className={`text-sm font-medium ${stat.color} mb-0.5`}>{stat.rate}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column — Campaign info */}
        <motion.div {...fade} transition={{ delay: 0.1 }} className="lg:col-span-1 space-y-6">
          <Card className="glass border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Campaign Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={User} label="Sender" value={`${campaign.sender_name} <${campaign.sender_email}>`} />
              <Separator className="bg-border/50" />
              <InfoRow icon={Users} label="Recipients" value={`${campaign.total_recipients || recipients?.length || 0}`} />
              <Separator className="bg-border/50" />
              <InfoRow icon={Send} label="Sent" value={`${campaign.sent_count || 0}`} />
              <Separator className="bg-border/50" />
              <InfoRow icon={Calendar} label="Created" value={format(new Date(campaign.created_at), "MMM d, yyyy 'at' h:mm a")} />
              {campaign.scheduled_at && (
                <>
                  <Separator className="bg-border/50" />
                  <InfoRow icon={Clock} label="Scheduled" value={format(new Date(campaign.scheduled_at), "MMM d, yyyy 'at' h:mm a")} />
                </>
              )}
              {campaign.timezone && (
                <>
                  <Separator className="bg-border/50" />
                  <InfoRow icon={Globe} label="Timezone" value={campaign.timezone} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Send Progress */}
          {(campaign.status === "sending" || campaign.status === "sent") && (
            <Card className="glass border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Send Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {campaign.sent_count || 0} of {campaign.total_recipients || 0}
                  </span>
                  <span className="font-medium">
                    {campaign.total_recipients
                      ? Math.round(((campaign.sent_count || 0) / campaign.total_recipients) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    campaign.total_recipients
                      ? ((campaign.sent_count || 0) / campaign.total_recipients) * 100
                      : 0
                  }
                  className="h-2"
                />
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Right column — Recipients & Activity */}
        <motion.div {...fade} transition={{ delay: 0.15 }} className="lg:col-span-2 space-y-6">
          {/* Recipients */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Recipients
                <Badge variant="secondary" className="ml-auto">{recipients?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!recipients || recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No recipients added yet.</p>
              ) : (
                <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                  {recipients.slice(0, 50).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary uppercase">
                          {(r.first_name?.[0] || r.email[0])}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.first_name || r.last_name
                            ? `${r.first_name || ""} ${r.last_name || ""}`.trim()
                            : r.email}
                        </p>
                        {(r.first_name || r.last_name) && (
                          <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                        )}
                      </div>
                      {r.company && (
                        <span className="text-xs text-muted-foreground hidden sm:block">{r.company}</span>
                      )}
                    </div>
                  ))}
                  {recipients.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{recipients.length - 50} more recipients
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Activity */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Email Activity
                <Badge variant="secondary" className="ml-auto">{emailLogs?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!emailLogs || emailLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No email activity yet.</p>
              ) : (
                <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
                  {emailLogs.slice(0, 100).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-secondary/40 transition-colors"
                    >
                      <LogStatusDot status={log.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{log.email}</p>
                        {log.error_message && (
                          <p className="text-xs text-destructive truncate">{log.error_message}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={logStatusVariant(log.status)} className="text-[10px] px-1.5 py-0.5">
                          {log.status}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(log.created_at), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function LogStatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    sent: "bg-primary",
    delivered: "bg-emerald-400",
    opened: "bg-primary",
    clicked: "bg-violet-400",
    bounced: "bg-yellow-400",
    failed: "bg-destructive",
    pending: "bg-muted-foreground",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colorMap[status] || "bg-muted-foreground"}`} />;
}

function logStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["delivered", "opened", "clicked"].includes(status)) return "default";
  if (["bounced", "failed"].includes(status)) return "destructive";
  return "secondary";
}

export default CampaignDetails;
