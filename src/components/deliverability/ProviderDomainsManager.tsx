import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Copy,
  Send,
  Star,
  Layers,
} from "lucide-react";

interface ApiKey {
  id: string;
  provider: string;
  api_key: string;
  label: string;
  is_active: boolean;
}

interface Domain {
  domain: string;
  provider: string;
  default: boolean;
  verified: boolean;
  spf: boolean;
  dkim: boolean;
  mx: boolean;
  dmarc: boolean;
  tracking: boolean;
  validation_log: string | null;
  dns_records: DnsRecord[];
}

interface DnsRecord {
  type: string;
  host: string;
  value: string;
  ttl: number;
  note?: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  elastic_email: "Elastic Email",
};

const PROVIDER_SUPPORTS_DOMAINS = (p: string) => p === "elastic_email";

const CopyBtn = ({ value }: { value: string }) => (
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6"
    onClick={() => {
      navigator.clipboard.writeText(value);
      toast({ title: "Copied" });
    }}
  >
    <Copy className="w-3 h-3" />
  </Button>
);

const DnsTable = ({ records }: { records: DnsRecord[] }) => (
  <div className="rounded-md border border-border overflow-hidden">
    <table className="w-full text-xs">
      <thead className="bg-secondary/40">
        <tr>
          <th className="text-left p-2 font-medium">Type</th>
          <th className="text-left p-2 font-medium">Host / Name</th>
          <th className="text-left p-2 font-medium">Value</th>
          <th className="text-left p-2 font-medium">Note</th>
          <th className="p-2"></th>
        </tr>
      </thead>
      <tbody>
        {records.map((r, i) => (
          <tr key={i} className="border-t border-border align-top">
            <td className="p-2"><Badge variant="outline">{r.type}</Badge></td>
            <td className="p-2 font-mono break-all">{r.host}</td>
            <td className="p-2 font-mono break-all">{r.value}</td>
            <td className="p-2 text-muted-foreground">{r.note || ""}</td>
            <td className="p-2"><CopyBtn value={r.value} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <Badge
    variant="outline"
    className={`gap-1 text-xs ${ok ? "text-green-500 border-green-500/30" : "text-muted-foreground"}`}
  >
    {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
    {label}
  </Badge>
);

export const ProviderDomainsManager = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Configured API keys (the providers available for domain management)
  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ["api_keys", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, provider, api_key, label, is_active")
        .eq("user_id", user.id)
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data || []) as ApiKey[];
    },
    enabled: !!user?.id,
  });

  // Only providers that support domain management, with an active key
  const configuredProviders = (apiKeys || []).filter(
    (k) => k.is_active && PROVIDER_SUPPORTS_DOMAINS(k.provider),
  );

  // Group keys by provider (keep first active key per provider for selection)
  const uniqueProviders = (() => {
    const seen = new Set<string>();
    const out: ApiKey[] = [];
    for (const k of configuredProviders) {
      if (!seen.has(k.provider)) {
        seen.add(k.provider);
        out.push(k);
      }
    }
    return out;
  })();

  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const chosenProvider = uniqueProviders.find((p) => p.provider === activeProvider) || uniqueProviders[0] || null;

  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [dnsDialog, setDnsDialog] = useState<{ open: boolean; domain: string; records: DnsRecord[] | null }>({
    open: false, domain: "", records: null,
  });
  const [deleteDomain, setDeleteDomain] = useState<{ domain: string } | null>(null);
  const [sendForm, setSendForm] = useState<{ open: boolean; domain: string; to: string; subject: string; text: string }>({
    open: false, domain: "", to: "", subject: "Test from Elastic Email", text: "Hello from Elastic Email via EmailReach.",
  });

  // Live domain list for the chosen provider
  const { data: domains, isLoading: domainsLoading, refetch, isFetching } = useQuery({
    queryKey: ["provider_domains", chosenProvider?.id],
    queryFn: async () => {
      if (!chosenProvider) return [];
      const { data, error } = await supabase.functions.invoke("provider-domains", {
        body: { action: "list", provider: chosenProvider.provider, key_id: chosenProvider.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to load domains");
      return (data.data || []) as Domain[];
    },
    enabled: !!chosenProvider,
  });

  const refresh = () => {
    refetch();
  };

  const createDomain = useMutation({
    mutationFn: async () => {
      if (!chosenProvider) throw new Error("No provider selected");
      const { data, error } = await supabase.functions.invoke("provider-domains", {
        body: { action: "create", provider: chosenProvider.provider, key_id: chosenProvider.id, domain: newDomain.trim().toLowerCase(), set_default: true },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
      return data.data as Domain;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["provider_domains"] });
      setAddOpen(false);
      setNewDomain("");
      setDnsDialog({ open: true, domain: d.domain, records: d.dns_records });
      toast({ title: "Domain added", description: "Add the DNS records shown to verify it." });
    },
    onError: (e: Error) => toast({ title: "Failed to add domain", description: e.message, variant: "destructive" }),
  });

  const getDomain = useMutation({
    mutationFn: async (domain: string) => {
      if (!chosenProvider) throw new Error("No provider selected");
      const { data, error } = await supabase.functions.invoke("provider-domains", {
        body: { action: "get", provider: chosenProvider.provider, key_id: chosenProvider.id, domain },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
      return data.data as Domain;
    },
    onSuccess: (d) => {
      setDnsDialog({ open: true, domain: d.domain, records: d.dns_records });
    },
    onError: (e: Error) => toast({ title: "Failed to load DNS records", description: e.message, variant: "destructive" }),
  });

  const verifyDomain = useMutation({
    mutationFn: async (domain: string) => {
      if (!chosenProvider) throw new Error("No provider selected");
      const { data, error } = await supabase.functions.invoke("provider-domains", {
        body: { action: "verify", provider: chosenProvider.provider, key_id: chosenProvider.id, domain },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
      return data.data as Domain;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["provider_domains"] });
      toast({
        title: d.verified ? "Verified ✓" : "Not verified yet",
        description: d.verified
          ? "Your domain is verified and ready to send."
          : "DNS records not detected yet — try again in a few minutes.",
      });
    },
    onError: (e: Error) => toast({ title: "Verification failed", description: e.message, variant: "destructive" }),
  });

  const removeDomain = useMutation({
    mutationFn: async (domain: string) => {
      if (!chosenProvider) throw new Error("No provider selected");
      const { data, error } = await supabase.functions.invoke("provider-domains", {
        body: { action: "delete", provider: chosenProvider.provider, key_id: chosenProvider.id, domain },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider_domains"] });
      setDeleteDomain(null);
      toast({ title: "Domain removed" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const setDefault = useMutation({
    mutationFn: async (domain: string) => {
      if (!chosenProvider) throw new Error("No provider selected");
      const { data, error } = await supabase.functions.invoke("provider-domains", {
        body: { action: "set_default", provider: chosenProvider.provider, key_id: chosenProvider.id, domain },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider_domains"] });
      toast({ title: "Default domain updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      if (!chosenProvider) throw new Error("No provider selected");
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: sendForm.to,
          subject: sendForm.subject,
          html: `<div style="font-family:sans-serif;padding:20px"><h2>✅ Test from ${sendForm.domain}</h2><p>${sendForm.text}</p></div>`,
          text: sendForm.text,
          from_email: `noreply@${sendForm.domain}`,
          from_name: "EmailReach Test",
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Send failed");
      return data;
    },
    onSuccess: () => {
      setSendForm({ ...sendForm, open: false });
      toast({ title: "Test email sent", description: `Check ${sendForm.to}` });
    },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  if (keysLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  // No provider configured at all
  if (uniqueProviders.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-lg">
        <Layers className="w-10 h-10 mx-auto mb-3 opacity-50 text-muted-foreground" />
        <p className="font-medium">No domain-capable platform configured</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Add an API key for a supported provider (e.g. Elastic Email) in the <b>API Keys</b> tab,
          then its domains will appear here on their own slide.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Platform Domains
          </h3>
          <p className="text-sm text-muted-foreground">
            Each configured sending platform has its own slide below. Add a domain, copy the DNS records
            into your DNS provider, verify, and start sending from that platform.
          </p>
        </div>
      </div>

      {/* Provider slides / tabs */}
      <div className="flex flex-wrap gap-2">
        {uniqueProviders.map((p) => {
          const isActive = chosenProvider?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActiveProvider(p.provider)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                isActive
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-secondary/30 hover:border-primary/40"
              }`}
            >
              <Globe className="w-4 h-4 text-primary" />
              <span className="font-medium">{PROVIDER_LABEL[p.provider] || p.provider}</span>
              <Badge variant="secondary" className="gap-1 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Configured
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Chosen provider panel */}
      {chosenProvider && (
        <div className="rounded-xl border border-border bg-secondary/10 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Globe className="w-3 h-3" /> {PROVIDER_LABEL[chosenProvider.provider]}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Star className="w-3 h-3" /> {chosenProvider.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Domains managed live on the {PROVIDER_LABEL[chosenProvider.provider]} platform.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-1" onClick={refresh} disabled={isFetching}>
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button size="sm" className="gap-1" onClick={() => { setNewDomain(""); setAddOpen(true); }}>
                <Plus className="w-4 h-4" /> Add Domain
              </Button>
            </div>
          </div>

          {domainsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !domains || domains.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-lg">
              <Globe className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No domains on this platform yet</p>
              <p className="text-sm">Click <b>Add Domain</b> to register one and get its DNS records.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.domain} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{d.domain}</span>
                        {d.default && (
                          <Badge className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20">
                            <Star className="w-3 h-3" /> Default
                          </Badge>
                        )}
                        {d.verified ? (
                          <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Check ok={d.spf} label="SPF" />
                        <Check ok={d.dkim} label="DKIM" />
                        <Check ok={d.dmarc} label="DMARC" />
                        <Check ok={d.tracking} label="Tracking" />
                      </div>
                      {d.validation_log && (
                        <p className="text-xs text-muted-foreground mt-2 max-h-16 overflow-auto">
                          {d.validation_log}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!d.default && (
                        <Button variant="ghost" size="sm" onClick={() => setDefault.mutate(d.domain)} title="Set as default">
                          <Star className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => getDomain.mutate(d.domain)} disabled={getDomain.isPending}>
                        {getDomain.isPending && getDomain.variables === d.domain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                        DNS
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => verifyDomain.mutate(d.domain)} disabled={verifyDomain.isPending}>
                        {verifyDomain.isPending && verifyDomain.variables === d.domain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Verify
                      </Button>
                      {d.verified && (
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSendForm({ open: true, domain: d.domain, to: "", subject: `Test from ${d.domain}`, text: "Hello from Elastic Email via EmailReach." })}>
                          <Send className="w-3.5 h-3.5" /> Send
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteDomain({ domain: d.domain })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add domain dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add domain to {chosenProvider ? PROVIDER_LABEL[chosenProvider.provider] : ""}</DialogTitle>
            <DialogDescription>
              We'll register this domain on the platform and return the DNS records you need to add at your DNS provider.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); createDomain.mutate(); }}
          >
            <div className="space-y-2">
              <Label htmlFor="pd">Domain</Label>
              <Input id="pd" placeholder="yourdomain.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createDomain.isPending}>
                {createDomain.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DNS records dialog */}
      <Dialog open={dnsDialog.open} onOpenChange={(o) => setDnsDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>DNS records for {dnsDialog.domain}</DialogTitle>
            <DialogDescription>
              Add the following records at your DNS provider (Cloudflare, GoDaddy, Route53, etc.), then click Verify.
            </DialogDescription>
          </DialogHeader>
          {dnsDialog.records ? (
            <div className="space-y-3">
              <DnsTable records={dnsDialog.records} />
              <p className="text-xs text-muted-foreground">
                DNS propagation can take a few minutes up to 72 hours. Come back and click <b>Verify</b> on the domain row.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send test dialog */}
      <Dialog open={sendForm.open} onOpenChange={(o) => setSendForm((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send test from {sendForm.domain}</DialogTitle>
            <DialogDescription>
              Sends via your {PROVIDER_LABEL[chosenProvider?.provider || "elastic_email"]} API key using noreply@{sendForm.domain}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); sendTest.mutate(); }}>
            <div className="space-y-2"><Label>To</Label><Input type="email" value={sendForm.to} onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={sendForm.subject} onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Message</Label><textarea className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={sendForm.text} onChange={(e) => setSendForm({ ...sendForm, text: e.target.value })} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSendForm((s) => ({ ...s, open: false }))}>Cancel</Button>
              <Button type="submit" disabled={sendTest.isPending}>
                {sendTest.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDomain} onOpenChange={() => setDeleteDomain(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete domain?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes "{deleteDomain?.domain}" from the platform. You can clean up the DNS records separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDomain && removeDomain.mutate(deleteDomain.domain)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProviderDomainsManager;
