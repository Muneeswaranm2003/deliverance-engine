import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { safeFormat } from "@/lib/dates";
import { KeyRound, Server, Loader2, Download, LifeBuoy } from "lucide-react";
import { Link } from "react-router-dom";

const LicensePortal = () => {
  const { data: licenses, isLoading } = useQuery({
    queryKey: ["my_licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activations } = useQuery({
    queryKey: ["my_activations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("license_activations")
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const slotsFor = (id: string) =>
    (activations ?? []).filter((a) => a.license_id === id && a.is_production).length;

  return (
    <AppLayout title="My Licenses" description="Perpetual self-host licenses, installations, and support window">
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (licenses ?? []).length === 0 ? (
        <Card className="glass border-border/50">
          <CardContent className="py-14 text-center space-y-4">
            <KeyRound className="w-8 h-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">No licenses on this account yet</p>
              <p className="text-sm text-muted-foreground">
                Licenses are linked to the email used at checkout.
              </p>
            </div>
            <Button asChild>
              <Link to="/pricing">View license pricing</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {(licenses ?? []).map((l) => {
            const used = slotsFor(l.id);
            const limit = l.install_limit;
            const supportLive = l.support_expires_at && new Date(l.support_expires_at) > new Date();
            const installs = (activations ?? []).filter((a) => a.license_id === l.id);
            return (
              <Card key={l.id} className="glass border-border/50">
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-primary" />
                      {l.tier_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      {l.key_prefix}-••••-••••-{l.key_last4}
                    </p>
                  </div>
                  <Badge variant={l.status === "active" ? "outline" : "destructive"}>{l.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Purchased</p>
                      <p className="font-medium">{safeFormat(l.purchased_at, "PP")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Updates &amp; support</p>
                      <p className="font-medium">
                        {supportLive ? `until ${safeFormat(l.support_expires_at, "PP")}` : "expired"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">License type</p>
                      <p className="font-medium">Perpetual</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Production installations</span>
                      <span className="font-medium">
                        {used} / {limit ?? "∞"}
                      </span>
                    </div>
                    {limit ? <Progress value={Math.min(100, (used / limit) * 100)} className="h-2" /> : null}
                  </div>

                  {installs.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-border/50">
                      {installs.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 truncate">
                            <Server className="w-3.5 h-3.5 text-muted-foreground" />
                            {a.domain}
                            {!a.is_production && (
                              <Badge variant="secondary" className="text-[10px]">non-production</Badge>
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            last seen {safeFormat(a.last_seen_at, "PP p")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" size="sm" className="gap-2" disabled={!supportLive}>
                      <Download className="w-3.5 h-3.5" /> Download latest build
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2" asChild>
                      <Link to="/pricing">
                        <LifeBuoy className="w-3.5 h-3.5" /> Renew updates &amp; support
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default LicensePortal;
