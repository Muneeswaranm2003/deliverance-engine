import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ChevronRight,
} from "lucide-react";

interface SesIdentity {
  id: string;
  user_id: string;
  parent_id: string | null;
  identity_type: "domain" | "subdomain";
  domain: string;
  region: string;
  verification_status: string;
  dkim_verification_status: string | null;
  dkim_tokens: string[];
  last_checked_at: string | null;
  last_error: string | null;
}

interface DnsRecord { type: string; host: string; value: string; ttl: number }
interface DnsBundle { dkim: DnsRecord[]; spf: DnsRecord; dmarc: DnsRecord }

const REGIONS = [
  "us-east-1", "us-west-2", "eu-west-1", "eu-central-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
];

const statusBadge = (s: string) => {
  if (s === "Success") return <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3" />Verified</Badge>;
  if (s === "Failed") return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />Failed</Badge>;
  return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />{s}</Badge>;
};

const CopyBtn = ({ value }: { value: string }) => (
  <Button
    variant="ghost" size="icon" className="h-6 w-6"
    onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Copied" }); }}
  >
    <Copy className="w-3 h-3" />
  </Button>
);

const DnsTable = ({ records }: { records: DnsBundle }) => (
  <div className="space-y-2 text-xs">
    <p className="font-medium text-sm">Add these records at your DNS provider:</p>
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-secondary/40">
          <tr>
            <th className="text-left p-2 font-medium">Type</th>
            <th className="text-left p-2 font-medium">Host / Name</th>
            <th className="text-left p-2 font-medium">Value</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {records.dkim.map((r, i) => (
            <tr key={`dkim-${i}`} className="border-t border-border">
              <td className="p-2"><Badge variant="outline">{r.type}</Badge></td>
              <td className="p-2 font-mono break-all">{r.host}</td>
              <td className="p-2 font-mono break-all">{r.value}</td>
              <td className="p-2"><CopyBtn value={r.value} /></td>
            </tr>
          ))}
          <tr className="border-t border-border">
            <td className="p-2"><Badge variant="outline">{records.spf.type}</Badge></td>
            <td className="p-2 font-mono break-all">{records.spf.host}</td>
            <td className="p-2 font-mono break-all">{records.spf.value}</td>
            <td className="p-2"><CopyBtn value={records.spf.value} /></td>
          </tr>
          <tr className="border-t border-border">
            <td className="p-2"><Badge variant="outline">{records.dmarc.type}</Badge></td>
            <td className="p-2 font-mono break-all">{records.dmarc.host}</td>
            <td className="p-2 font-mono break-all">{records.dmarc.value}</td>
            <td className="p-2"><CopyBtn value={records.dmarc.value} /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p className="text-muted-foreground">
      DNS propagation can take a few minutes up to 72 hours. Click <b>Check</b> after adding records.
    </p>
  </div>
);

export const SesDomainsManager = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [region, setRegion] = useState("us-east-1");

  const [dnsDialog, setDnsDialog] = useState<{ open: boolean; domain: string; records: DnsBundle | null }>({
    open: false, domain: "", records: null,
  });

  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ identity_id: "", from: "", to: "", subject: "", text: "" });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: identities, isLoading } = useQuery({
    queryKey: ["ses_identities", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("ses_identities" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown) as SesIdentity[];
    },
    enabled: !!user?.id,
  });

  const createIdentity = useMutation({
    mutationFn: async (vars: { domain: string; parent_id: string | null; region: string }) => {
      const { data, error } = await supabase.functions.invoke("ses-manage", {
        body: { action: "create", ...vars },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ses_identities"] });
      setAddOpen(false);
      setNewDomain("");
      setDnsDialog({ open: true, domain: data.identity.domain, records: data.dns_records });
      toast({ title: "Identity created", description: "Add the DNS records shown to verify." });
    },
    onError: (e: Error) => toast({ title: "Failed to create", description: e.message, variant: "destructive" }),
  });

  const checkIdentity = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("ses-manage", {
        body: { action: "check", id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ses_identities"] });
      toast({
        title: data.verification_status === "Success" ? "Verified ✓" : `Status: ${data.verification_status}`,
        description: data.verification_status !== "Success" ? "DNS not detected yet — try again in a few minutes." : "You can now send from this identity.",
      });
    },
    onError: (e: Error) => toast({ title: "Check failed", description: e.message, variant: "destructive" }),
  });

  const deleteIdentity = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("ses-manage", {
        body: { action: "delete", id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ses_identities"] });
      setDeleteId(null);
      toast({ title: "Removed" });
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ses-manage", {
        body: { action: "send", ...sendForm },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
      return data;
    },
    onSuccess: (data) => {
      setSendOpen(false);
      toast({ title: "Email sent", description: `Message ID: ${data.message_id}` });
    },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const openAdd = (parentId: string | null) => {
    setAddParentId(parentId);
    setNewDomain("");
    setAddOpen(true);
  };

  const openSend = (id: string, domain: string) => {
    setSendForm({ identity_id: id, from: `noreply@${domain}`, to: "", subject: "Test from SES", text: "Hello from AWS SES via Lovable." });
    setSendOpen(true);
  };

  const buildLocalDns = (i: SesIdentity): DnsBundle => ({
    dkim: (i.dkim_tokens || []).map((t) => ({
      type: "CNAME",
      host: `${t}._domainkey.${i.domain}`,
      value: `${t}.dkim.amazonses.com`,
      ttl: 1800,
    })),
    spf: { type: "TXT", host: i.domain, value: "v=spf1 include:amazonses.com ~all", ttl: 1800 },
    dmarc: { type: "TXT", host: `_dmarc.${i.domain}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${i.domain}`, ttl: 1800 },
  });

  const rootDomains = (identities || []).filter((i) => !i.parent_id);
  const childrenOf = (id: string) => (identities || []).filter((i) => i.parent_id === id);

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> AWS SES Domains</h3>
          <p className="text-sm text-muted-foreground">
            Add a root domain, verify DNS, then create one or more sending subdomains (e.g. <code>mail.yourdomain.com</code>).
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => openAdd(null)}>
          <Plus className="w-4 h-4" /> Add Domain
        </Button>
      </div>

      {rootDomains.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-lg">
          <Globe className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No SES domains yet</p>
          <p className="text-sm">Add your first domain to begin DNS verification.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rootDomains.map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-secondary/20">
              <div className="flex items-center gap-3 p-3">
                <Globe className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{d.domain}</span>
                    <Badge variant="outline">{d.region}</Badge>
                    {statusBadge(d.verification_status)}
                    {d.dkim_verification_status && (
                      <Badge variant="outline" className="text-xs">DKIM: {d.dkim_verification_status}</Badge>
                    )}
                  </div>
                  {d.last_error && <p className="text-xs text-destructive mt-1">{d.last_error}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setDnsDialog({ open: true, domain: d.domain, records: buildLocalDns(d) })}>
                    DNS
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => checkIdentity.mutate(d.id)} disabled={checkIdentity.isPending}>
                    <RefreshCw className={`w-3 h-3 ${checkIdentity.isPending ? "animate-spin" : ""}`} /> Check
                  </Button>
                  {d.verification_status === "Success" && (
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => openAdd(d.id)}>
                      <Plus className="w-3 h-3" /> Subdomain
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(d.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {childrenOf(d.id).length > 0 && (
                <div className="border-t border-border bg-background/40">
                  {childrenOf(d.id).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 pl-8">
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{c.domain}</span>
                          {statusBadge(c.verification_status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDnsDialog({ open: true, domain: c.domain, records: buildLocalDns(c) })}>
                          DNS
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => checkIdentity.mutate(c.id)} disabled={checkIdentity.isPending}>
                          <RefreshCw className="w-3 h-3" /> Check
                        </Button>
                        {c.verification_status === "Success" && (
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => openSend(c.id, c.domain)}>
                            <Send className="w-3 h-3" /> Send
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addParentId ? "Add Sending Subdomain" : "Add SES Domain"}</DialogTitle>
            <DialogDescription>
              {addParentId
                ? "Subdomains are verified independently in SES. Use this for mail.yourdomain.com or send.yourdomain.com."
                : "We'll create the identity in AWS SES and return the DNS records you need to add."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createIdentity.mutate({ domain: newDomain.trim().toLowerCase(), parent_id: addParentId, region });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="d">Domain</Label>
              <Input id="d" placeholder={addParentId ? "mail.yourdomain.com" : "yourdomain.com"} value={newDomain} onChange={(e) => setNewDomain(e.target.value)} required />
            </div>
            {!addParentId && (
              <div className="space-y-2">
                <Label htmlFor="r">AWS Region</Label>
                <select id="r" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={region} onChange={(e) => setRegion(e.target.value)}>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createIdentity.isPending}>
                {createIdentity.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create
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
              Add the following records at your DNS provider (Cloudflare, GoDaddy, Route53, etc.).
            </DialogDescription>
          </DialogHeader>
          {dnsDialog.records && <DnsTable records={dnsDialog.records} />}
        </DialogContent>
      </Dialog>

      {/* Send test dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send via SES</DialogTitle>
            <DialogDescription>Send a test email from this verified subdomain.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); sendTest.mutate(); }}>
            <div className="space-y-2"><Label>From</Label><Input value={sendForm.from} onChange={(e) => setSendForm({ ...sendForm, from: e.target.value })} required /></div>
            <div className="space-y-2"><Label>To</Label><Input type="email" value={sendForm.to} onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={sendForm.subject} onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Message</Label><textarea className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={sendForm.text} onChange={(e) => setSendForm({ ...sendForm, text: e.target.value })} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={sendTest.isPending}>
                {sendTest.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Send
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete identity?</AlertDialogTitle>
            <AlertDialogDescription>This removes it from AWS SES and from your account. DNS records you added can be cleaned up separately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteIdentity.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};