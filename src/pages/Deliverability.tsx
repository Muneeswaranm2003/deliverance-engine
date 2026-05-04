import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmtpServersManager } from "@/components/deliverability/SmtpServersManager";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { IpPoolsManager } from "@/components/settings/IpPoolsManager";
import { Server, ShieldCheck, Globe, GitBranch, Key, Network, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useUserRoles } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";

const Deliverability = () => {
  const { canManageDeliverability, isLoading, roles } = useUserRoles();

  const RestrictedView = ({ feature }: { feature: string }) => (
    <div className="glass rounded-xl p-10 text-center space-y-3">
      <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
      <p className="font-medium">Restricted access</p>
      <p className="text-sm text-muted-foreground">
        Only admins and managers can manage {feature}. Your current role:{" "}
        <Badge variant="secondary">{roles[0] ?? "user"}</Badge>
      </p>
    </div>
  );

  return (
    <AppLayout
      title="Deliverability"
      description="SMTP relays, DNS authentication, IP reverse DNS, and routing rules"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Tabs defaultValue="smtp" className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-6">
            <TabsTrigger value="smtp" className="gap-2">
              <Server className="w-4 h-4" /> SMTP
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Key className="w-4 h-4" /> API Keys
            </TabsTrigger>
            <TabsTrigger value="ips" className="gap-2">
              <Network className="w-4 h-4" /> IP Pools
            </TabsTrigger>
            <TabsTrigger value="dns" className="gap-2" disabled>
              <ShieldCheck className="w-4 h-4" /> DNS Auth
            </TabsTrigger>
            <TabsTrigger value="rdns" className="gap-2" disabled>
              <Globe className="w-4 h-4" /> IP rDNS
            </TabsTrigger>
            <TabsTrigger value="routing" className="gap-2" disabled>
              <GitBranch className="w-4 h-4" /> Routing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="smtp" className="space-y-4">
            <div className="glass rounded-xl p-6">
              <SmtpServersManager />
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <div className="glass rounded-xl p-6">
              {isLoading ? null : canManageDeliverability ? (
                <ApiKeysManager />
              ) : (
                <RestrictedView feature="API keys" />
              )}
            </div>
          </TabsContent>

          <TabsContent value="ips" className="space-y-4">
            <div className="glass rounded-xl p-6">
              {isLoading ? null : canManageDeliverability ? (
                <IpPoolsManager />
              ) : (
                <RestrictedView feature="IP pools" />
              )}
            </div>
          </TabsContent>

          <TabsContent value="dns">
            <div className="glass rounded-xl p-10 text-center text-muted-foreground">
              DNS authentication checker coming next.
            </div>
          </TabsContent>
          <TabsContent value="rdns">
            <div className="glass rounded-xl p-10 text-center text-muted-foreground">
              Reverse DNS checker coming next.
            </div>
          </TabsContent>
          <TabsContent value="routing">
            <div className="glass rounded-xl p-10 text-center text-muted-foreground">
              Routing rules coming next.
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
};

export default Deliverability;
