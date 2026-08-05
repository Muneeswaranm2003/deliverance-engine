import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVerifiedSenderDomains } from "@/hooks/useVerifiedSenderDomains";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FlaskConical,
  Trophy,
  Loader2,
  Network,
  Sparkles,
  CheckCircle2,
  Info,
} from "lucide-react";

export interface SenderVariant {
  email: string;
  domain: string;
  source: string;
  ipPoolId?: string | null;
  ipPoolName?: string | null;
}

export interface SenderPerformance {
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  score: number;
}

interface SenderABTestingProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  variants: SenderVariant[];
  onVariantsChange: (variants: SenderVariant[]) => void;
  /** Applies the recommended sender as the campaign's primary sender email */
  onApplyRecommended?: (email: string) => void;
}

const MAX_VARIANTS = 5;

/** Weighted score: opens and clicks reward, bounces penalise heavily. */
const scoreOf = (openRate: number, clickRate: number, bounceRate: number) =>
  Math.max(0, openRate * 0.5 + clickRate * 0.7 - bounceRate * 1.2);

export const SenderABTesting = ({
  enabled,
  onEnabledChange,
  variants,
  onVariantsChange,
  onApplyRecommended,
}: SenderABTestingProps) => {
  const { user } = useAuth();
  const { domains, isLoading } = useVerifiedSenderDomains();
  const [localPart, setLocalPart] = useState("noreply");

  const safeLocal = (localPart.trim() || "noreply").replace(/[^a-zA-Z0-9._+-]/g, "");

  // Optional dedicated IP pools to rotate alongside domains
  const { data: ipPools } = useQuery({
    queryKey: ["ab_ip_pools", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ip_pools")
        .select("id, pool_name, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Historical performance per sender address, from this user's past campaigns
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["sender_performance", user?.id],
    queryFn: async () => {
      const { data: campaigns, error: cErr } = await supabase
        .from("campaigns")
        .select("id, sender_email")
        .eq("user_id", user!.id);
      if (cErr) throw cErr;
      if (!campaigns?.length) return {} as Record<string, SenderPerformance>;

      const byCampaign = new Map(campaigns.map((c) => [c.id, c.sender_email?.toLowerCase() ?? ""]));
      const { data: logs, error: lErr } = await supabase
        .from("email_logs")
        .select("campaign_id, status, opened_at, clicked_at, bounced_at")
        .in("campaign_id", campaigns.map((c) => c.id))
        .limit(5000);
      if (lErr) throw lErr;

      const acc: Record<string, SenderPerformance> = {};
      for (const log of logs ?? []) {
        const sender = byCampaign.get(log.campaign_id as string);
        if (!sender) continue;
        const domain = sender.split("@")[1] ?? sender;
        const entry = (acc[domain] ??= {
          sent: 0, opened: 0, clicked: 0, bounced: 0,
          openRate: 0, clickRate: 0, bounceRate: 0, score: 0,
        });
        entry.sent += 1;
        if (log.opened_at) entry.opened += 1;
        if (log.clicked_at) entry.clicked += 1;
        if (log.bounced_at || log.status === "bounced") entry.bounced += 1;
      }
      for (const entry of Object.values(acc)) {
        entry.openRate = entry.sent ? (entry.opened / entry.sent) * 100 : 0;
        entry.clickRate = entry.sent ? (entry.clicked / entry.sent) * 100 : 0;
        entry.bounceRate = entry.sent ? (entry.bounced / entry.sent) * 100 : 0;
        entry.score = scoreOf(entry.openRate, entry.clickRate, entry.bounceRate);
      }
      return acc;
    },
    enabled: !!user?.id && enabled,
  });

  const statsFor = (domain: string): SenderPerformance | undefined =>
    history?.[domain.toLowerCase()];

  // Keep variant addresses in sync with the mailbox name
  useEffect(() => {
    if (!variants.length) return;
    const next = variants.map((v) => ({ ...v, email: `${safeLocal}@${v.domain}` }));
    if (next.some((v, i) => v.email !== variants[i].email)) onVariantsChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeLocal]);

  const toggleDomain = (domain: string, source: string) => {
    const exists = variants.some((v) => v.domain.toLowerCase() === domain.toLowerCase());
    if (exists) {
      onVariantsChange(variants.filter((v) => v.domain.toLowerCase() !== domain.toLowerCase()));
    } else {
      if (variants.length >= MAX_VARIANTS) return;
      onVariantsChange([
        ...variants,
        { email: `${safeLocal}@${domain}`, domain, source, ipPoolId: null, ipPoolName: null },
      ]);
    }
  };

  const setVariantPool = (domain: string, poolId: string) => {
    const pool = (ipPools ?? []).find((p) => p.id === poolId);
    onVariantsChange(
      variants.map((v) =>
        v.domain === domain
          ? {
              ...v,
              ipPoolId: poolId === "none" ? null : poolId,
              ipPoolName: poolId === "none" ? null : pool?.pool_name ?? null,
            }
          : v
      )
    );
  };

  const recommended = useMemo(() => {
    if (!variants.length) return null;
    const scored = variants
      .map((v) => ({ variant: v, stats: statsFor(v.domain) }))
      .filter((s) => s.stats && s.stats.sent >= 5) as {
      variant: SenderVariant;
      stats: SenderPerformance;
    }[];
    if (!scored.length) return null;
    return scored.sort((a, b) => b.stats.score - a.stats.score)[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, history]);

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FlaskConical className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <Label className="text-sm font-medium">A/B sender testing</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rotate sends across verified domains (and IP pools), then use past performance to
              pick the best <span className="font-mono">{safeLocal}@</span> sender.
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label="Enable A/B sender testing" />
      </div>

      {enabled && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
              placeholder="noreply"
              className="h-8 w-40 bg-background/60 text-sm"
              aria-label="Mailbox name"
            />
            <span className="text-sm text-muted-foreground">
              @ pick 2–{MAX_VARIANTS} domains to test
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading verified domains…
            </div>
          ) : domains.length === 0 ? (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              No verified domains yet. Add and verify domains in Deliverability → Domains to run a
              sender test.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {domains.map((d) => {
                const selected = variants.find(
                  (v) => v.domain.toLowerCase() === d.domain.toLowerCase()
                );
                const stats = statsFor(d.domain);
                const isWinner = recommended?.variant.domain === d.domain;
                const disabled = !selected && variants.length >= MAX_VARIANTS;
                return (
                  <div
                    key={d.domain}
                    className={`rounded-lg border p-3 transition-all ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : disabled
                          ? "border-border bg-muted/30 opacity-50"
                          : "border-border bg-background/40 hover:border-primary/50"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleDomain(d.domain, d.source)}
                      className="w-full text-left disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2">
                        {selected ? (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-muted-foreground/40 shrink-0" />
                        )}
                        <span className="truncate text-sm font-medium">
                          {safeLocal}@{d.domain}
                        </span>
                        {isWinner && (
                          <Badge className="gap-1 bg-amber-500/15 text-amber-400 border-amber-500/30">
                            <Trophy className="w-3 h-3" /> Best
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{d.source}</span>
                        {historyLoading ? (
                          <span>· loading history…</span>
                        ) : stats ? (
                          <span>
                            · {stats.sent} sent · {stats.openRate.toFixed(1)}% open ·{" "}
                            {stats.clickRate.toFixed(1)}% click · {stats.bounceRate.toFixed(1)}%
                            bounce
                          </span>
                        ) : (
                          <span>· no history yet</span>
                        )}
                      </div>
                      {stats && (
                        <Progress
                          value={Math.min(100, stats.score * 2)}
                          className="h-1 mt-2"
                        />
                      )}
                    </button>

                    {selected && (ipPools?.length ?? 0) > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <Network className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <Select
                          value={selected.ipPoolId ?? "none"}
                          onValueChange={(val) => setVariantPool(d.domain, val)}
                        >
                          <SelectTrigger className="h-7 text-xs bg-background/60">
                            <SelectValue placeholder="IP pool" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Default IP</SelectItem>
                            {(ipPools ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.pool_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {variants.length > 0 && (
            <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
              <p className="text-xs font-medium">Rotation order</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, i) => (
                  <Badge key={v.domain} variant="outline" className="gap-1 font-mono text-[11px]">
                    #{i + 1} {v.email}
                    {v.ipPoolName ? ` · ${v.ipPoolName}` : ""}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Recipients are split evenly across these senders in round-robin order.
              </p>
            </div>
          )}

          {variants.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              {recommended ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">
                        Recommended sender:{" "}
                        <span className="font-mono">{recommended.variant.email}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Score {recommended.stats.score.toFixed(1)} ·{" "}
                        {recommended.stats.openRate.toFixed(1)}% open ·{" "}
                        {recommended.stats.clickRate.toFixed(1)}% click ·{" "}
                        {recommended.stats.bounceRate.toFixed(1)}% bounce across{" "}
                        {recommended.stats.sent} past sends
                      </p>
                    </div>
                  </div>
                  {onApplyRecommended && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onApplyRecommended(recommended.variant.email)}
                    >
                      Use as primary sender
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Not enough delivery history yet (5+ sends per domain). This campaign will rotate
                  senders evenly and build the data needed for a recommendation.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SenderABTesting;