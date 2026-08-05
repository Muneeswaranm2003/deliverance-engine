import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface VerifiedDomain {
  domain: string;
  source: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  elasticemail: "Elastic Email",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  postmark: "Postmark",
  brevo: "Brevo",
};

const providerLabel = (p: string) => PROVIDER_LABEL[p.toLowerCase()] || p;

/**
 * Verified sending domains available to the current user, merged from
 * platform providers (Elastic Email) and AWS SES identities.
 */
export function useVerifiedSenderDomains() {
  const { user } = useAuth();

  const { data: apiKeys } = useQuery({
    queryKey: ["verified_domains_api_keys", user?.id],
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
      if (p !== "elasticemail" || seen.has(p)) return false;
      seen.add(p);
      return true;
    });
  }, [apiKeys]);

  const {
    data: providerDomains,
    isLoading: providerLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["verified_provider_domains", domainProviders.map((k) => k.id).join(",")],
    queryFn: async () => {
      const results: VerifiedDomain[] = [];
      for (const key of domainProviders) {
        const { data, error } = await supabase.functions.invoke("provider-domains", {
          body: { action: "list", provider: key.provider, key_id: key.id },
        });
        if (error) continue;
        const list = (data?.domains ?? data ?? []) as any[];
        for (const d of list) {
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

  const { data: sesDomains, isLoading: sesLoading } = useQuery({
    queryKey: ["verified_ses_domains", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ses_identities")
        .select("domain, verification_status, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? [])
        .filter((d) => ["success", "verified"].includes(String(d.verification_status).toLowerCase()))
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

  return {
    domains,
    isLoading: providerLoading || sesLoading,
    isFetching,
    refetch,
  };
}