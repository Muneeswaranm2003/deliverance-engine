import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Globe, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

interface VerifiedDomain {
  domain: string;
  source: string;
}

interface VerifiedSenderPickerProps {
  senderEmail: string;
  onSelect: (email: string) => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  elasticemail: "Elastic Email",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  postmark: "Postmark",
  brevo: "Brevo",
};

const providerLabel = (p: string) => PROVIDER_LABEL[p.toLowerCase()] || p;

export const VerifiedSenderPicker = ({ senderEmail, onSelect }: VerifiedSenderPickerProps) => {
  const { user } = useAuth();
  const [localPart, setLocalPart] = useState("noreply");

  // Providers with an active API key that can manage domains
  const { data: apiKeys } = useQuery({
    queryKey: ["sender_picker_api_keys", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, provider, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const domainProviders = useMemo(() => {
    const seen = new Set<string>();
    return (apiKeys ?? []).filter((k) => {
      const p = k.provider.toLowerCase();
      if (p !== "elasticemail") return false;
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
  }, [apiKeys]);

  // Verified domains from configured platform providers
  const {
    data: providerDomains,
    isLoading: providerLoading,
    isFetching: providerFetching,
    refetch,
  } = useQuery({
    queryKey: ["sender_picker_provider_domains", domainProviders.map((k) => k.id).join(",")],
    queryFn: async () => {
      const results: VerifiedDomain[] = [];
      for (const key of domainProviders) {
        const { data, error } = await supabase.functions.invoke("provider-domains", {
          body: { action: "list", provider: key.provider, key_id: key.id },
        });
        if (error) continue;
        const domains = (data?.domains ?? data ?? []) as any[];
        for (const d of domains) {
          if (d?.verified && d?.domain) {
            results.push({ domain: String(d.domain), source: providerLabel(key.provider) });
          }
        }
      }
      return results;
    },
    enabled: domainProviders.length > 0,
    staleTime: 60_000,
  });

  // Verified AWS SES identities (root domains + subdomains)
  const { data: sesDomains, isLoading: sesLoading } = useQuery({
    queryKey: ["sender_picker_ses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ses_identities")
        .select("domain, verification_status, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? [])
        .filter((d) => String(d.verification_status).toLowerCase() === "success" ||
                        String(d.verification_status).toLowerCase() === "verified")
        .map((d) => ({ domain: d.domain, source: "AWS SES" } as VerifiedDomain));
    },
    enabled: !!user?.id,
  });

  const domains = useMemo(() => {
    const all = [...(providerDomains ?? []), ...(sesDomains ?? [])];
    const seen = new Set<string>();
    return all.filter((d) => {
      const key = d.domain.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [providerDomains, sesDomains]);

  const isLoading = providerLoading || sesLoading;
  const currentDomain = senderEmail.includes("@") ? senderEmail.split("@")[1]?.toLowerCase() : "";
  const safeLocal = (localPart.trim() || "noreply").replace(/[^a-zA-Z0-9._+-]/g, "");

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading verified domains…
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
        No verified platform domains yet. Add and verify a domain in{" "}
        <span className="text-foreground font-medium">Deliverability → Domains</span> to pick a
        verified sender address here.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <Label className="text-sm font-medium">Verified platform domains</Label>
          <Badge variant="secondary" className="text-[10px]">{domains.length}</Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => refetch()}
          disabled={providerFetching}
        >
          <RefreshCw className={`w-3 h-3 ${providerFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={localPart}
          onChange={(e) => setLocalPart(e.target.value)}
          placeholder="noreply"
          className="h-8 w-40 bg-background/60 text-sm"
          aria-label="Mailbox name"
        />
        <span className="text-sm text-muted-foreground">@ pick a domain below</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {domains.map((d) => {
          const email = `${safeLocal}@${d.domain}`;
          const isActive = currentDomain === d.domain.toLowerCase();
          return (
            <button
              key={d.domain}
              type="button"
              onClick={() => onSelect(email)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                isActive
                  ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                  : "border-border bg-background/40 hover:border-primary/50"
              }`}
            >
              {isActive ? (
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block truncate font-medium">{email}</span>
                <span className="block text-[11px] text-muted-foreground">{d.source}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VerifiedSenderPicker;
