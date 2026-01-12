import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Webhook, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const AutomationLogs = () => {
  const [selectedAutomation, setSelectedAutomation] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

  // Fetch automations for filter
  const { data: automations } = useQuery({
    queryKey: ["automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch campaigns for filter
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch automation logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["automation-logs", selectedAutomation],
    queryFn: async () => {
      let query = supabase
        .from("automation_logs")
        .select(`
          id,
          status,
          error_message,
          created_at,
          automation_id,
          automations (name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (selectedAutomation !== "all") {
        query = query.eq("automation_id", selectedAutomation);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch webhook events
  const { data: webhookEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["webhook-events", selectedCampaign],
    queryFn: async () => {
      let query = supabase
        .from("webhook_events")
        .select(`
          id,
          event_type,
          email,
          processed,
          processed_at,
          created_at,
          campaign_id,
          campaigns (name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (selectedCampaign !== "all") {
        query = query.eq("campaign_id", selectedCampaign);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  const getEventTypeBadge = (eventType: string) => {
    const colors: Record<string, string> = {
      open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      click: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      bounce: "bg-red-500/10 text-red-500 border-red-500/20",
      delivered: "bg-green-500/10 text-green-500 border-green-500/20",
      unsubscribe: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    };

    return (
      <Badge className={colors[eventType] || "bg-secondary text-secondary-foreground"}>
        {eventType}
      </Badge>
    );
  };

  // Calculate stats
  const successCount = logs?.filter((l) => l.status === "success").length || 0;
  const failedCount = logs?.filter((l) => l.status === "failed").length || 0;
  const processedEvents = webhookEvents?.filter((e) => e.processed).length || 0;
  const pendingEvents = webhookEvents?.filter((e) => !e.processed).length || 0;

  return (
    <AppLayout 
      title="Automation Logs" 
      description="View automation execution logs and webhook event history"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{successCount}</p>
                  <p className="text-sm text-muted-foreground">Successful</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{failedCount}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Webhook className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{processedEvents}</p>
                  <p className="text-sm text-muted-foreground">Processed Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingEvents}</p>
                  <p className="text-sm text-muted-foreground">Pending Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Logs and Events */}
        <Tabs defaultValue="logs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="w-4 h-4" />
              Automation Logs
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Webhook className="w-4 h-4" />
              Webhook Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Execution Logs</CardTitle>
                <Select value={selectedAutomation} onValueChange={setSelectedAutomation}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by automation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Automations</SelectItem>
                    {automations?.map((automation) => (
                      <SelectItem key={automation.id} value={automation.id}>
                        {automation.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {logsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : logs && logs.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Automation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              {(log.automations as { name: string } | null)?.name || "Unknown"}
                            </TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-red-400">
                              {log.error_message || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <Activity className="w-8 h-8 mb-2 opacity-50" />
                      <p>No automation logs yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Webhook Events</CardTitle>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {campaigns?.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {eventsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : webhookEvents && webhookEvents.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Event Type</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {webhookEvents.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(event.created_at), "MMM d, yyyy HH:mm:ss")}
                            </TableCell>
                            <TableCell>{getEventTypeBadge(event.event_type)}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {event.email}
                            </TableCell>
                            <TableCell>
                              {(event.campaigns as { name: string } | null)?.name || "Unknown"}
                            </TableCell>
                            <TableCell>
                              {event.processed ? (
                                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                  Processed
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <Webhook className="w-8 h-8 mb-2 opacity-50" />
                      <p>No webhook events yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AutomationLogs;
