import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, ShieldCheck, Server, Infinity as InfinityIcon } from "lucide-react";

const FEATURES: Record<string, string[]> = {
  single: [
    "1 production installation",
    "Full source code, self-hosted",
    "Unlimited sending volume",
    "SMTP, AWS SES & API providers",
    "12 months updates & support",
    "Perpetual license — never expires",
  ],
  agency: [
    "Up to 5 production installations",
    "Everything in Single",
    "Client sub-domains & IP pools",
    "Priority support queue",
    "12 months updates & support",
    "Perpetual license — never expires",
  ],
  enterprise: [
    "Multiple / unlimited installations",
    "Everything in Agency",
    "White-label & custom branding",
    "Deployment assistance",
    "12 months updates & support",
    "Perpetual license — never expires",
  ],
};

const TIER_ICON: Record<string, typeof Server> = {
  single: Server,
  agency: ShieldCheck,
  enterprise: InfinityIcon,
};

const LicensePricing = () => {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSlug, setLeadSlug] = useState("enterprise");
  const [lead, setLead] = useState({ name: "", email: "", company: "", installs: "", message: "" });
  const [leadSaving, setLeadSaving] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["license_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("license_products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const openLead = (slug: string) => {
    setLeadSlug(slug);
    setLead((l) => ({ ...l, email: l.email || email }));
    setLeadOpen(true);
  };

  const buy = async (slug: string, isCustom: boolean) => {
    if (isCustom) return openLead(slug);
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Enter your email first", description: "We send the license key there.", variant: "destructive" });
      return;
    }
    setBusy(slug);
    try {
      const { data, error } = await supabase.functions.invoke("license-checkout", {
        body: { product_slug: slug, customer_email: email.trim(), origin: window.location.origin },
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      const message = data?.error || error?.message || "Checkout is unavailable right now.";
      toast({ title: "Card checkout unavailable", description: message });
      openLead(slug);
    } catch (err: any) {
      toast({ title: "Card checkout unavailable", description: err.message });
      openLead(slug);
    } finally {
      setBusy(null);
    }
  };

  const submitLead = async () => {
    if (!lead.name.trim() || !lead.email.includes("@")) {
      toast({ title: "Name and a valid email are required", variant: "destructive" });
      return;
    }
    setLeadSaving(true);
    const { error } = await supabase.from("license_leads").insert({
      name: lead.name.trim(),
      email: lead.email.trim().toLowerCase(),
      company: lead.company.trim() || null,
      installs_needed: lead.installs.trim() || leadSlug,
      message: lead.message.trim() || null,
    });
    setLeadSaving(false);
    if (error) {
      toast({ title: "Could not send your request", description: error.message, variant: "destructive" });
      return;
    }
    setLeadOpen(false);
    setLead({ name: "", email: "", company: "", installs: "", message: "" });
    toast({ title: "Request sent", description: "We'll reply with pricing and your license key details." });
  };

  const price = (p: any) =>
    p.is_custom ? "Custom" : `$${Math.round(p.price_cents / 100).toLocaleString()}`;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-28 pb-20">
        <section className="container px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <Badge variant="outline" className="mb-4">Self-hosted · One-time payment</Badge>
            <h1 className="font-display text-3xl md:text-5xl font-bold mb-4">
              Own your sending stack.
              <span className="text-gradient"> Pay once.</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Install the full platform on your own servers. Every license is perpetual — the software keeps
              running forever. The first 12 months of updates and support are included.
            </p>
          </motion.div>

          <div className="max-w-md mx-auto mb-12 space-y-2">
            <Label htmlFor="license-email">Where should we send your license key?</Label>
            <Input
              id="license-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {(products ?? []).map((p, i) => {
                const Icon = TIER_ICON[p.slug] ?? Server;
                const featured = p.slug === "agency";
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className={`glass rounded-2xl p-7 flex flex-col border ${
                      featured ? "border-primary/50 shadow-lg shadow-primary/10" : "border-border/50"
                    }`}
                  >
                    {featured && <Badge className="self-start mb-3">Most popular</Badge>}
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-primary" />
                      <h2 className="font-display text-xl font-bold">{p.name}</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">{p.description}</p>
                    <div className="flex items-end gap-2 mb-6">
                      <span className="font-display text-4xl font-bold">{price(p)}</span>
                      {!p.is_custom && <span className="text-muted-foreground mb-1.5">one-time</span>}
                    </div>
                    <ul className="space-y-2.5 mb-7 flex-1">
                      {(FEATURES[p.slug] ?? []).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full gap-2"
                      variant={featured ? "default" : "outline"}
                      disabled={busy === p.slug}
                      onClick={() => buy(p.slug, p.is_custom)}
                    >
                      {busy === p.slug && <Loader2 className="w-4 h-4 animate-spin" />}
                      {p.is_custom ? "Contact sales" : `Buy ${p.name}`}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-10">
            Already bought a license?{" "}
            <Link to="/license" className="text-primary hover:underline">
              Open your license portal
            </Link>
          </p>
        </section>
      </main>

      <Footer />

      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a license</DialogTitle>
            <DialogDescription>
              Tell us about your deployment and we'll reply with pricing, a payment link, and your license key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={lead.email}
                  onChange={(e) => setLead({ ...lead, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input value={lead.company} onChange={(e) => setLead({ ...lead, company: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Installations needed</Label>
                <Input
                  placeholder="e.g. 12 servers"
                  value={lead.installs}
                  onChange={(e) => setLead({ ...lead, installs: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Anything else?</Label>
              <Textarea
                rows={3}
                value={lead.message}
                onChange={(e) => setLead({ ...lead, message: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeadOpen(false)}>Cancel</Button>
            <Button onClick={submitLead} disabled={leadSaving} className="gap-2">
              {leadSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LicensePricing;
