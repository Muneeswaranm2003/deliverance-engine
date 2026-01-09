import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  Plus,
  Link2,
  Check,
  Loader2,
  Trash2,
  Database,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CRMIntegration {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  syncEnabled: boolean;
  lastSync: Date | null;
  contactsCount: number;
  createdAt: Date;
}

const crmProviders = [
  { id: "salesforce", name: "Salesforce", logo: "🏢" },
  { id: "hubspot", name: "HubSpot", logo: "🧡" },
  { id: "pipedrive", name: "Pipedrive", logo: "📊" },
  { id: "zoho", name: "Zoho CRM", logo: "📋" },
  { id: "freshsales", name: "Freshsales", logo: "🌿" },
  { id: "custom", name: "Custom API", logo: "⚙️" },
];

const Integrations = () => {
  const [integrations, setIntegrations] = useState<CRMIntegration[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    apiKey: "",
    apiEndpoint: "",
  });

  const handleCreate = () => {
    if (!formData.name || !formData.provider || !formData.apiKey) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const newIntegration: CRMIntegration = {
      id: crypto.randomUUID(),
      name: formData.name,
      provider: formData.provider,
      apiKey: formData.apiKey,
      syncEnabled: true,
      lastSync: null,
      contactsCount: 0,
      createdAt: new Date(),
    };

    setIntegrations([...integrations, newIntegration]);
    setIsDialogOpen(false);
    setFormData({ name: "", provider: "", apiKey: "", apiEndpoint: "" });
    toast({ title: "CRM integration created successfully" });
  };

  const toggleSync = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id ? { ...i, syncEnabled: !i.syncEnabled } : i
      )
    );
  };

  const deleteIntegration = (id: string) => {
    setIntegrations(integrations.filter((i) => i.id !== id));
    toast({ title: "Integration removed" });
  };

  const syncContacts = async (integration: CRMIntegration) => {
    setSyncingId(integration.id);
    // Simulate sync
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIntegrations(
      integrations.map((i) =>
        i.id === integration.id
          ? { ...i, lastSync: new Date(), contactsCount: Math.floor(Math.random() * 500) + 100 }
          : i
      )
    );
    setSyncingId(null);
    toast({ title: "Contacts synced successfully" });
  };

  const getProviderInfo = (providerId: string) =>
    crmProviders.find((p) => p.id === providerId) || crmProviders[5];

  return (
    <AppLayout
      title="CRM Integrations"
      description="Connect and sync contacts with your CRM systems"
      action={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2">
              <Plus className="w-4 h-4" />
              Connect CRM
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect CRM System</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Integration Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Salesforce Account"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>CRM Provider</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) => setFormData({ ...formData, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    {crmProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <span className="flex items-center gap-2">
                          <span>{provider.logo}</span>
                          {provider.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your CRM API key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Find your API key in your CRM's settings or integrations page
                </p>
              </div>

              {formData.provider === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="apiEndpoint">API Endpoint</Label>
                  <Input
                    id="apiEndpoint"
                    placeholder="https://api.yourcrm.com/v1"
                    value={formData.apiEndpoint}
                    onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="hero" onClick={handleCreate}>
                  Connect CRM
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {integrations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-12 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Link2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-semibold mb-2">
            No CRM integrations yet
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your CRM system to automatically sync contacts and keep your data in sync.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {crmProviders.slice(0, 4).map((provider) => (
              <Badge key={provider.id} variant="secondary" className="text-sm py-1.5 px-3">
                {provider.logo} {provider.name}
              </Badge>
            ))}
          </div>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            Connect Your First CRM
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration, index) => {
            const provider = getProviderInfo(integration.provider);
            return (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass border-border hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-2xl">
                          {provider.logo}
                        </div>
                        <div>
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          <CardDescription>{provider.name}</CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={integration.syncEnabled}
                        onCheckedChange={() => toggleSync(integration.id)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={integration.syncEnabled ? "default" : "secondary"}>
                        {integration.syncEnabled ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Sync Active
                          </>
                        ) : (
                          "Sync Disabled"
                        )}
                      </Badge>
                      {integration.contactsCount > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Database className="w-3 h-3" />
                          {integration.contactsCount} contacts
                        </Badge>
                      )}
                    </div>

                    {integration.lastSync && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {integration.lastSync.toLocaleString()}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncContacts(integration)}
                        disabled={syncingId === integration.id || !integration.syncEnabled}
                        className="flex-1"
                      >
                        {syncingId === integration.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Sync Now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteIntegration(integration.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};

export default Integrations;