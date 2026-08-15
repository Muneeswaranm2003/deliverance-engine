import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useVerifiedSenderDomains } from "@/hooks/useVerifiedSenderDomains";
import { Loader2, Rocket, RefreshCw, Split } from "lucide-react";

interface Props {
  campaignId: string;
  defaultFromName: string;
}

const CampaignSendQueue = ({ campaignId, defaultFromName }: Props) => {
  const queryClient = useQueryClient();
  const { domains, isLoading: domainsLoading, refetch: refetchDomains, isFetching } = useVerifiedSenderDomains();

  const [fromName, setFromName] = useState(defaultFromName || "");
  const [mailbox, setMailbox] = useState("noreply");
  const [selected, setSelected] = useState<string[]>([]);
  const [queuing, setQueuing] = useState(false);

  const { data: jobs } = useQuery({
    queryKey: ["campaign-send-jobs", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_send_jobs")
        .select("status, from_email, last_error")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  const summary = useMemo(() => {
    const total = jobs?.length ?? 0;
    const by = (s: string) => (jobs ?? []).filter((j) => j.status === s).length;
    const perSender = new Map<string, { sent: number; total: number }>();
    for (const j of jobs ?? []) {
      const cur = perSender.get(j.from_email) ?? { sent: 0, total: 0 };
      cur.total++;
      if (j.status === "sent") cur.sent++;
      perSender.set(j.from_email, cur);
    }
    return {
      total,
      sent: by("sent"),
      queued: by("queued"),
      processing: by("processing"),
      failed: by("failed"),
      perSender: Array.from(perSender.entries()),
      lastError: (jobs ?? []).find((j) => j.status === "failed")?.last_error,
    };
  }, [jobs]);

  const toggle = (domain: string) =>
    setSelected((prev) => (prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]));

  const handleQueue = async () => {
    if (!fromName.trim()) {
      toast({ title: "From Name is required", variant: "destructive" });
      return;
    }
    if (selected.length === 0) {
      toast({ title: "Select at least one verified sender domain", variant: "destructive" });
      return;
    }
    setQueuing(true);
    try {
      const senderEmails = selected.map((d) => `${mailbox.trim() || "noreply"}@${d}`);
      const { data, error } = await supabase.functions.invoke("enqueue-campaign", {
        body: { campaign_id: campaignId, from_name: fromName.trim(), sender_emails: senderEmails },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: `Queued ${data.queued} emails`,
        description: `Split evenly across ${senderEmails.length} sender address${senderEmails.length > 1 ? "es" : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["campaign-send-jobs", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    } catch (err: any) {
      toast({ title: "Could not queue campaign", description: err.message, variant: "destructive" });
    } finally {
      setQueuing(false);
    }
  };

  const progress = summary.total > 0 ? Math.round((summary.sent / summary.total) * 100) : 0;

  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Split className="w-4 h-4 text-primary" />
          Split Sending Queue
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetchDomains()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Domains
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Acme Team" />
          </div>
          <div className="space-y-2">
            <Label>Mailbox</Label>
            <Input value={mailbox} onChange={(e) => setMailbox(e.target.value)} placeholder="noreply" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sender addresses (verified domains)</Label>
          {domainsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading verified domains…
            </div>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No verified domains yet. Add and verify one in Deliverability → Domains.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {domains.map((d) => (
                <label
                  key={d.domain}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 cursor-pointer hover:bg-secondary/40 transition-colors"
                >
                  <Checkbox checked={selected.includes(d.domain)} onCheckedChange={() => toggle(d.domain)} />
                  <span className="flex-1 min-w-0 truncate text-sm">
                    {(mailbox.trim() || "noreply")}@{d.domain}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{d.source}</Badge>
                </label>
              ))}
            </div>
          )}
        </div>

        <Button onClick={handleQueue} disabled={queuing} className="gap-2 w-full sm:w-auto">
          {queuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
          Split &amp; queue send
        </Button>

        {summary.total > 0 && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Delivery progress</span>
              <span className="font-medium">{summary.sent} / {summary.total}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Queued {summary.queued}</Badge>
              <Badge variant="outline">Sending {summary.processing}</Badge>
              <Badge variant="outline">Sent {summary.sent}</Badge>
              <Badge variant={summary.failed ? "destructive" : "outline"}>Failed {summary.failed}</Badge>
            </div>
            <div className="space-y-1">
              {summary.perSender.map(([sender, s]) => (
                <div key={sender} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{sender}</span>
                  <span>{s.sent}/{s.total}</span>
                </div>
              ))}
            </div>
            {summary.failed > 0 && summary.lastError && (
              <p className="text-xs text-destructive break-words">Last error: {summary.lastError}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignSendQueue;
