import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Send,
  Users,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  MousePointer,
  Eye,
  AlertTriangle,
  Search,
  Download,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;
type CampaignRecipient = Tables<"campaign_recipients">;
type EmailLog = Tables<"email_logs">;

const CampaignDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const { data: recipients, isLoading: recipientsLoading } = useQuery({
    queryKey: ["campaign-recipients", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_recipients")
        .select("*")
        .eq("campaign_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CampaignRecipient[];
    },
    enabled: !!id,
  });

  const { data: emailLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["campaign-email-logs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .eq("campaign_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailLog[];
    },
    enabled: !!id,
  });

  const { data: senderDomains } = useQuery({
    queryKey: ["campaign-sender-domains", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_sender_domains")
        .select(`
          *,
          sender_domains (*)
        `)
        .eq("campaign_id", id!)
        .order("send_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const stats = {
    total: emailLogs?.length || 0,
    sent: emailLogs?.filter((l) => l.status === "sent").length || 0,
    delivered: emailLogs?.filter((l) => l.status === "delivered").length || 0,
    opened: emailLogs?.filter((l) => l.opened_at).length || 0,
    clicked: emailLogs?.filter((l) => l.clicked_at).length || 0,
    bounced: emailLogs?.filter((l) => l.status === "bounced").length || 0,
    failed: emailLogs?.filter((l) => l.status === "failed").length || 0,
  };

  const filteredLogs = emailLogs?.filter((log) => {
    const matchesSearch = log.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: EmailLog["status"]) => {
    const config = {
      pending: { icon: Clock, className: "bg-muted text-muted-foreground" },
      sent: { icon: Send, className: "bg-blue-500/10 text-blue-500" },
      delivered: { icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-500" },
      opened: { icon: Eye, className: "bg-violet-500/10 text-violet-500" },
      clicked: { icon: MousePointer, className: "bg-primary/10 text-primary" },
      bounced: { icon: AlertTriangle, className: "bg-amber-500/10 text-amber-500" },
      failed: { icon: XCircle, className: "bg-destructive/10 text-destructive" },
    };
    const { icon: Icon, className } = config[status];
    return (
      <Badge variant="secondary" className={`gap-1.5 ${className}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const exportToCSV = () => {
    if (!filteredLogs) return;
    
    const headers = ["Email", "Status", "Sent At", "Delivered At", "Opened At", "Clicked At"];
    const rows = filteredLogs.map((log) => [
      log.email,
      log.status,
      log.sent_at ? format(new Date(log.sent_at), "yyyy-MM-dd HH:mm:ss") : "",
      log.delivered_at ? format(new Date(log.delivered_at), "yyyy-MM-dd HH:mm:ss") : "",
      log.opened_at ? format(new Date(log.opened_at), "yyyy-MM-dd HH:mm:ss") : "",
      log.clicked_at ? format(new Date(log.clicked_at), "yyyy-MM-dd HH:mm:ss") : "",
    ]);
    
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-${campaign?.name || id}-logs.csv`;
    a.click();
  };

  if (campaignLoading) {
    return (
      <AppLayout title="Campaign Details" description="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout title="Campaign Not Found" description="The campaign you're looking for doesn't exist.">
        <Button variant="ghost" onClick={() => navigate("/campaigns")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Button>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={campaign.name}
      description={campaign.subject}
      action={
        <Button variant="ghost" onClick={() => navigate("/campaigns")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      }
    >
      {/* Campaign Info & Stats */}
      <div className="grid lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-1"
        >
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </Badge>
              <div className="mt-4 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Created: {format(new Date(campaign.created_at), "MMM d, yyyy")}
                </p>
                {campaign.scheduled_at && (
                  <p className="text-muted-foreground">
                    Scheduled: {format(new Date(campaign.scheduled_at), "MMM d, yyyy HH:mm")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3"
        >
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Email Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                  { label: "Total", value: stats.total, icon: Mail, color: "text-foreground" },
                  { label: "Sent", value: stats.sent, icon: Send, color: "text-blue-500" },
                  { label: "Delivered", value: stats.delivered, icon: CheckCircle2, color: "text-emerald-500" },
                  { label: "Opened", value: stats.opened, icon: Eye, color: "text-violet-500" },
                  { label: "Clicked", value: stats.clicked, icon: MousePointer, color: "text-primary" },
                  { label: "Bounced", value: stats.bounced, icon: AlertTriangle, color: "text-amber-500" },
                  { label: "Failed", value: stats.failed, icon: XCircle, color: "text-destructive" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                    <p className="font-display text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Sender Domains */}
      {senderDomains && senderDomains.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Sender Domains Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {senderDomains.map((sd: any, index: number) => (
                  <div
                    key={sd.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border"
                  >
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                      {sd.send_order}
                    </span>
                    <div className="text-sm">
                      <p className="font-medium">{sd.sender_domains?.from_name}</p>
                      <p className="text-muted-foreground">{sd.sender_domains?.from_email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs for Recipients & Logs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Tabs defaultValue="logs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logs" className="gap-2">
              <Mail className="w-4 h-4" />
              Email Logs ({emailLogs?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="recipients" className="gap-2">
              <Users className="w-4 h-4" />
              Recipients ({recipients?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <Card className="glass">
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="flex gap-2 flex-1">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="opened">Opened</SelectItem>
                        <SelectItem value="clicked">Clicked</SelectItem>
                        <SelectItem value="bounced">Bounced</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={exportToCSV} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !filteredLogs || filteredLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No email logs found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sent</TableHead>
                          <TableHead>Delivered</TableHead>
                          <TableHead>Opened</TableHead>
                          <TableHead>Clicked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.email}</TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.sent_at ? format(new Date(log.sent_at), "MMM d, HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.delivered_at ? format(new Date(log.delivered_at), "MMM d, HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.opened_at ? format(new Date(log.opened_at), "MMM d, HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.clicked_at ? format(new Date(log.clicked_at), "MMM d, HH:mm") : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipients">
            <Card className="glass">
              <CardContent className="pt-6">
                {recipientsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !recipients || recipients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No recipients added to this campaign
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>First Name</TableHead>
                          <TableHead>Last Name</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Added</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipients.map((recipient) => (
                          <TableRow key={recipient.id}>
                            <TableCell className="font-medium">{recipient.email}</TableCell>
                            <TableCell>{recipient.first_name || "—"}</TableCell>
                            <TableCell>{recipient.last_name || "—"}</TableCell>
                            <TableCell>{recipient.company || "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(recipient.created_at), "MMM d, yyyy")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
};

export default CampaignDetail;
