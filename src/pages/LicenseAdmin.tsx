import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRole";
import { safeFormat } from "@/lib/dates";
import { KeyRound, Lock, Loader2, Plus, Copy, ShieldOff, ShieldCheck, CalendarPlus, Server, Users } from "lucide-react";

const money = (cents?: number | null, currency = "usd") =>
  `${currency.toUpperCase() === "USD" ? "$" : ""}${((cents ?? 0) / 100).toLocaleString()}`;

const LicenseAdmin = () => {
  const { isAdmin, isLoading: rolesLoading, roles } = useUserRoles();
  const queryClient = useQueryClient();
  const [issueOpen, setIssueOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_email: "",
    customer_name: "",
    product_slug: "single",
    install_limit: "",
    support_months: "12",
    notes: "",
  });

  const { data: products } = useQuery({
    queryKey: ["license_products_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("license_products").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: licenses, isLoading } = useQuery({
    queryKey: ["admin_licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: activations } = useQuery({
    queryKey: ["admin_activations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("license_activations").select("*").eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: purchases } = useQuery({
    queryKey: ["admin_purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("license_purchases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: leads } = useQuery({
    queryKey: ["admin_license_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("license_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const metrics = useMemo(() => {
    const revenue = (purchases ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
    const byTier = new Map<string, number>();
    for (const p of purchases ?? []) byTier.set(p.product_slug, (byTier.get(p.product_slug) ?? 0) + (p.amount_cents ?? 0));
    const soon = (licenses ?? []).filter((l) => {
      if (!l.support_expires_at) return false;
      const t = new Date(l.support_expires_at).getTime();
      return t > Date.now() && t < Date.now() + 30 * 86400_000;
    }).length;
    return {
      revenue,
      byTier: Array.from(byTier.entries()),
      installs: (activations ?? []).filter((a) => a.is_production).length,
      expiringSoon: soon,
      active: (licenses ?? []).filter((l) => l.status === "active").length,
    };
  }, [purchases, activations, licenses]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin_licenses"] });
    queryClient.invalidateQueries({ queryKey: ["admin_activations"] });
    queryClient.invalidateQueries({ queryKey: ["admin_purchases"] });
  };

  const call = async (body: Record<string, unknown>, successTitle: string) => {
    const { data, error } = await supabase.functions.invoke("license-admin", { body });
    if (error || data?.error) {
      toast({ title: "Action failed", description: data?.error ?? error?.message, variant: "destructive" });
      return null;
    }
    toast({ title: successTitle });
    refresh();
    return data;
  };

  const issue = async () => {
    if (!form.customer_email.includes("@")) {
      toast({ title: "A valid customer email is required", variant: "destructive" });
      return;
    }
    setIssuing(true);
    const data = await call(
      {
        action: "issue",
        customer_email: form.customer_email,
        customer_name: form.customer_name || null,
        product_slug: form.product_slug,
        install_limit: form.install_limit === "" ? undefined : Number(form.install_limit),
        support_months: Number(form.support_months || 12),
        notes: form.notes || undefined,
      },
      "License issued and emailed",
    );
    setIssuing(false);
    if (data?.license_key) {
      setIssuedKey(data.license_key);
      setIssueOpen(false);
      setForm({ ...form, customer_email: "", customer_name: "", notes: "" });
    }
  };

  const slots = (id: string) => (activations ?? []).filter((a) => a.license_id === id && a.is_production).length;

  if (rolesLoading) return <AppLayout title="Licenses"><div /></AppLayout>;

  if (!isAdmin) {
    return (
      <AppLayout title="Licenses" description="License administration">
        <div className="glass rounded-xl p-10 text-center space-y-3">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Restricted access</p>
          <p className="text-sm text-muted-foreground">
            Only admins can manage licenses. Your current role: <Badge variant="secondary">{roles[0] ?? "user"}</Badge>
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Licenses"
      description="Purchases, license keys, installations, and support windows"
      action={
        <Button className="gap-2" onClick={() => setIssueOpen(true)}>
          <Plus className="w-4 h-4" /> Issue license
        </Button>
      }
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Revenue", value: money(metrics.revenue), icon: KeyRound },
          { label: "Active licenses", value: metrics.active, icon: ShieldCheck },
          { label: "Production installs", value: metrics.installs, icon: Server },
          { label: "Support expiring (30d)", value: metrics.expiringSoon, icon: CalendarPlus },
        ].map((m) => (
          <Card key={m.label} className="glass border-border/50">
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="font-display text-2xl font-bold">{m.value}</p>
              </div>
              <m.icon className="w-5 h-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="licenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="licenses" className="gap-2"><KeyRound className="w-4 h-4" /> Licenses</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2"><ShieldCheck className="w-4 h-4" /> Purchases</TabsTrigger>
          <TabsTrigger value="leads" className="gap-2"><Users className="w-4 h-4" /> Sales leads</TabsTrigger>
        </TabsList>

        <TabsContent value="licenses" className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-14"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (licenses ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No licenses issued yet.</p>
          ) : (
            (licenses ?? []).map((l) => {
              const installs = (activations ?? []).filter((a) => a.license_id === l.id);
              return (
                <Card key={l.id} className="glass border-border/50">
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold truncate">{l.customer_email}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {l.key_prefix}-••••-••••-{l.key_last4} · {l.tier_name}
                      </p>
                    </div>
                    <Badge variant={l.status === "active" ? "outline" : "destructive"}>{l.status}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Purchased</p>
                        <p>{safeFormat(l.purchased_at, "PP")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Support until</p>
                        <p>{safeFormat(l.support_expires_at, "PP")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Slots</p>
                        <p>{slots(l.id)} / {l.install_limit ?? "∞"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Amount</p>
                        <p>{money(l.amount_cents, l.currency ?? "usd")}</p>
                      </div>
                    </div>

                    {installs.length > 0 && (
                      <div className="space-y-1 border-t border-border/50 pt-2">
                        {installs.map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-xs">
                            <span className="truncate flex items-center gap-2">
                              <Server className="w-3.5 h-3.5 text-muted-foreground" />
                              {a.domain}
                              <span className="text-muted-foreground">
                                · last seen {safeFormat(a.last_seen_at, "PP p")}
                              </span>
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => call({ action: "release_slot", activation_id: a.id }, "Slot released")}
                            >
                              Release
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => call({ action: "extend_support", license_id: l.id, months: 12 }, "Support extended 12 months")}
                      >
                        <CalendarPlus className="w-3.5 h-3.5" /> +12 months support
                      </Button>
                      {l.status === "active" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={() => call({ action: "revoke", license_id: l.id }, "License revoked")}
                        >
                          <ShieldOff className="w-3.5 h-3.5" /> Revoke
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => call({ action: "restore", license_id: l.id }, "License restored")}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Restore
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="purchases">
          <Card className="glass border-border/50">
            <CardContent className="pt-6 space-y-2">
              {(purchases ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No purchases yet.</p>
              ) : (
                (purchases ?? []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-2">
                    <div className="min-w-0">
                      <p className="truncate">{p.customer_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.product_slug} · {p.source} · {safeFormat(p.created_at, "PP p")}
                        {p.stripe_session_id ? ` · ${p.stripe_session_id.slice(0, 18)}…` : ""}
                      </p>
                    </div>
                    <span className="font-medium">{money(p.amount_cents, p.currency)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card className="glass border-border/50">
            <CardContent className="pt-6 space-y-3">
              {(leads ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No sales enquiries yet.</p>
              ) : (
                (leads ?? []).map((l) => (
                  <div key={l.id} className="border-b border-border/40 pb-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">
                        {l.name} <span className="text-muted-foreground">· {l.email}</span>
                      </p>
                      <Badge variant="outline">{l.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[l.company, l.installs_needed, safeFormat(l.created_at, "PP")].filter(Boolean).join(" · ")}
                    </p>
                    {l.message && <p className="text-sm mt-1">{l.message}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue a license</DialogTitle>
            <DialogDescription>
              Creates a perpetual key and emails it to the customer. Use this for Enterprise deals and offline payments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer email</Label>
                <Input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Customer name</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tier</Label>
                <Select value={form.product_slug} onValueChange={(v) => setForm({ ...form, product_slug: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(products ?? []).map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Install limit</Label>
                <Input
                  placeholder="tier default"
                  value={form.install_limit}
                  onChange={(e) => setForm({ ...form, install_limit: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Support months</Label>
                <Input
                  value={form.support_months}
                  onChange={(e) => setForm({ ...form, support_months: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button onClick={issue} disabled={issuing} className="gap-2">
              {issuing && <Loader2 className="w-4 h-4 animate-spin" />} Issue license
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issuedKey} onOpenChange={(o) => !o && setIssuedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>License key created</DialogTitle>
            <DialogDescription>
              This key is shown once — it is stored hashed. It has also been emailed to the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-secondary/60 px-3 py-2 font-mono text-sm">{issuedKey}</code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(issuedKey ?? "");
                toast({ title: "Copied" });
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIssuedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default LicenseAdmin;
