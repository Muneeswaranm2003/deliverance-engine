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
import { motion } from "framer-motion";
import {
  Plus,
  Zap,
  Webhook,
  Link2,
  Check,
  Loader2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Integration {
  id: string;
  name: string;
  type: "zapier" | "webhook" | "crm";
  webhookUrl: string;
  enabled: boolean;
  createdAt: Date;
}

const integrationTypes = [
  {
    type: "zapier" as const,
    name: "Zapier",
    description: "Connect to 5,000+ apps via Zapier webhooks",
    icon: Zap,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    type: "webhook" as const,
    name: "Custom Webhook",
    description: "Send data to any HTTP endpoint",
    icon: Webhook,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    type: "crm" as const,
    name: "CRM Integration",
    description: "Sync contacts with your CRM system",
    icon: Link2,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
];

const Automations = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"zapier" | "webhook" | "crm" | null>(null);
  const [formData, setFormData] = useState({ name: "", webhookUrl: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = () => {
    if (!selectedType || !formData.name || !formData.webhookUrl) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const newIntegration: Integration = {
      id: crypto.randomUUID(),
      name: formData.name,
      type: selectedType,
      webhookUrl: formData.webhookUrl,
      enabled: true,
      createdAt: new Date(),
    };

    setIntegrations([...integrations, newIntegration]);
    setIsDialogOpen(false);
    setSelectedType(null);
    setFormData({ name: "", webhookUrl: "" });
    toast({ title: "Integration created successfully" });
  };

  const toggleIntegration = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id ? { ...i, enabled: !i.enabled } : i
      )
    );
  };

  const deleteIntegration = (id: string) => {
    setIntegrations(integrations.filter((i) => i.id !== id));
    toast({ title: "Integration removed" });
  };

  const testWebhook = async (integration: Integration) => {
    setIsLoading(true);
    try {
      await fetch(integration.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          source: "MailForge",
        }),
      });
      toast({
        title: "Test sent",
        description: "Check your webhook endpoint for the test payload",
      });
    } catch {
      toast({
        title: "Test failed",
        description: "Could not reach the webhook endpoint",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeConfig = (type: string) =>
    integrationTypes.find((t) => t.type === type)!;

  return (
    <AppLayout
      title="Automations"
      description="Connect your email campaigns to external services"
      action={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Integration</DialogTitle>
            </DialogHeader>

            {!selectedType ? (
              <div className="grid gap-3 py-4">
                {integrationTypes.map((type) => (
                  <button
                    key={type.type}
                    onClick={() => setSelectedType(type.type)}
                    className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/30 transition-all text-left"
                  >
                    <div className={`w-10 h-10 rounded-lg ${type.bgColor} flex items-center justify-center`}>
                      <type.icon className={`w-5 h-5 ${type.color}`} />
                    </div>
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-3 mb-4">
                  {(() => {
                    const config = getTypeConfig(selectedType);
                    return (
                      <>
                        <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                          <config.icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div>
                          <p className="font-medium">{config.name}</p>
                          <button
                            onClick={() => setSelectedType(null)}
                            className="text-sm text-primary hover:underline"
                          >
                            Change type
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Integration Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., New subscriber to Slack"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://hooks.zapier.com/..."
                    value={formData.webhookUrl}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  />
                  {selectedType === "zapier" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Create a Zap with "Webhooks by Zapier" trigger
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => {
                    setSelectedType(null);
                    setFormData({ name: "", webhookUrl: "" });
                  }}>
                    Cancel
                  </Button>
                  <Button variant="hero" onClick={handleCreate}>
                    Create Integration
                  </Button>
                </div>
              </div>
            )}
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
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-semibold mb-2">
            No integrations yet
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your campaigns to Zapier, webhooks, or CRM systems to automate your workflow.
          </p>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            Add Your First Integration
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration, index) => {
            const config = getTypeConfig(integration.type);
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
                        <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                          <config.icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          <CardDescription>{config.name}</CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={() => toggleIntegration(integration.id)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant={integration.enabled ? "default" : "secondary"}>
                        {integration.enabled ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Active
                          </>
                        ) : (
                          "Disabled"
                        )}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhook(integration)}
                        disabled={isLoading || !integration.enabled}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Test"
                        )}
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

export default Automations;
