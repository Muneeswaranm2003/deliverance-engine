import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  Plus,
  Zap,
  Mail,
  Clock,
  Loader2,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  Send,
  UserPlus,
  MousePointerClick,
  Calendar,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Automation {
  id: string;
  name: string;
  type: "campaign" | "followup";
  trigger: string;
  action: string;
  delay?: string;
  enabled: boolean;
  webhook_url?: string;
  triggered_count: number;
  completed_count: number;
  created_at: string;
}

const campaignTriggers = [
  { id: "email_opened", name: "Email Opened", icon: Mail },
  { id: "link_clicked", name: "Link Clicked", icon: MousePointerClick },
  { id: "not_opened", name: "Not Opened (after X days)", icon: Clock },
  { id: "new_subscriber", name: "New Subscriber", icon: UserPlus },
];

const followupTriggers = [
  { id: "no_reply", name: "No Reply After", icon: Clock },
  { id: "opened_no_click", name: "Opened But No Click", icon: Mail },
  { id: "bounced", name: "Email Bounced", icon: Mail },
  { id: "scheduled", name: "Scheduled Date", icon: Calendar },
];

const actions = [
  { id: "send_email", name: "Send Follow-up Email" },
  { id: "add_tag", name: "Add Tag to Contact" },
  { id: "move_list", name: "Move to Another List" },
  { id: "notify", name: "Send Notification" },
  { id: "webhook", name: "Trigger Webhook" },
];

const delayOptions = [
  { id: "1h", name: "1 hour" },
  { id: "6h", name: "6 hours" },
  { id: "1d", name: "1 day" },
  { id: "2d", name: "2 days" },
  { id: "3d", name: "3 days" },
  { id: "1w", name: "1 week" },
];

const Automations = () => {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"campaign" | "followup">("campaign");
  const [formData, setFormData] = useState({
    name: "",
    type: "campaign" as "campaign" | "followup",
    trigger: "",
    action: "",
    delay: "",
    webhook_url: "",
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-handler`;
  const scheduledUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-scheduled-automations`;

  const processScheduledAutomations = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(scheduledUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Scheduled automations processed",
          description: `Checked ${data.automations_checked} automations, processed ${data.total_contacts_processed} contacts`,
        });
        // Refresh automations to show updated counts
        fetchAutomations();
      } else {
        throw new Error(data.error || 'Failed to process');
      }
    } catch (error) {
      console.error('Error processing scheduled automations:', error);
      toast({
        title: "Error processing automations",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, [user]);

  const fetchAutomations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setAutomations(data?.map(a => ({
        ...a,
        type: a.type as "campaign" | "followup",
        delay: a.delay || undefined,
        webhook_url: a.webhook_url || undefined,
      })) || []);
    } catch (error) {
      console.error('Error fetching automations:', error);
      toast({
        title: "Error loading automations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.trigger || !formData.action) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.action === "webhook" && !formData.webhook_url) {
      toast({
        title: "Webhook URL required",
        description: "Please enter a webhook URL for this action",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('automations')
        .insert({
          user_id: user.id,
          name: formData.name,
          type: formData.type,
          trigger: formData.trigger,
          action: formData.action,
          delay: formData.delay || null,
          webhook_url: formData.action === "webhook" ? formData.webhook_url : null,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;

      setAutomations([{
        ...data,
        type: data.type as "campaign" | "followup",
        delay: data.delay || undefined,
        webhook_url: data.webhook_url || undefined,
      }, ...automations]);
      setIsDialogOpen(false);
      setFormData({ name: "", type: "campaign", trigger: "", action: "", delay: "", webhook_url: "" });
      toast({ title: "Automation created successfully" });
    } catch (error) {
      console.error('Error creating automation:', error);
      toast({
        title: "Error creating automation",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAutomation = async (id: string, currentEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('automations')
        .update({ enabled: !currentEnabled })
        .eq('id', id);

      if (error) throw error;

      setAutomations(
        automations.map((a) =>
          a.id === id ? { ...a, enabled: !currentEnabled } : a
        )
      );
    } catch (error) {
      console.error('Error toggling automation:', error);
      toast({
        title: "Error updating automation",
        variant: "destructive",
      });
    }
  };

  const deleteAutomation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAutomations(automations.filter((a) => a.id !== id));
      toast({ title: "Automation deleted" });
    } catch (error) {
      console.error('Error deleting automation:', error);
      toast({
        title: "Error deleting automation",
        variant: "destructive",
      });
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "Webhook URL copied to clipboard" });
  };

  const getTriggerName = (triggerId: string, type: "campaign" | "followup") => {
    const triggers = type === "campaign" ? campaignTriggers : followupTriggers;
    return triggers.find((t) => t.id === triggerId)?.name || triggerId;
  };

  const getActionName = (actionId: string) => {
    return actions.find((a) => a.id === actionId)?.name || actionId;
  };

  const getDelayName = (delayId: string) => {
    return delayOptions.find((d) => d.id === delayId)?.name || delayId;
  };

  const filteredAutomations = automations.filter((a) => a.type === activeTab);

  if (isLoading) {
    return (
      <AppLayout title="Automations" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Automations"
      description="Set up automated campaign responses and follow-ups"
      action={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" className="gap-2">
              <Plus className="w-4 h-4" />
              New Automation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Automation</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Automation Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Follow up on unopened emails"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Automation Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "campaign" | "followup") =>
                    setFormData({ ...formData, type: value, trigger: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campaign">
                      <span className="flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        Campaign Automation
                      </span>
                    </SelectItem>
                    <SelectItem value="followup">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Follow-up Automation
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>When this happens (Trigger)</Label>
                <Select
                  value={formData.trigger}
                  onValueChange={(value) => setFormData({ ...formData, trigger: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {(formData.type === "campaign" ? campaignTriggers : followupTriggers).map(
                      (trigger) => (
                        <SelectItem key={trigger.id} value={trigger.id}>
                          <span className="flex items-center gap-2">
                            <trigger.icon className="w-4 h-4" />
                            {trigger.name}
                          </span>
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {(formData.trigger === "not_opened" || formData.trigger === "no_reply") && (
                <div className="space-y-2">
                  <Label>Wait Duration</Label>
                  <Select
                    value={formData.delay}
                    onValueChange={(value) => setFormData({ ...formData, delay: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select delay" />
                    </SelectTrigger>
                    <SelectContent>
                      {delayOptions.map((delay) => (
                        <SelectItem key={delay.id} value={delay.id}>
                          {delay.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Do this (Action)</Label>
                <Select
                  value={formData.action}
                  onValueChange={(value) => setFormData({ ...formData, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an action" />
                  </SelectTrigger>
                  <SelectContent>
                    {actions.map((action) => (
                      <SelectItem key={action.id} value={action.id}>
                        {action.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.action === "webhook" && (
                <div className="space-y-2">
                  <Label htmlFor="webhook_url">Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    type="url"
                    placeholder="https://your-webhook-endpoint.com"
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    This URL will be called when the automation triggers
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="hero" onClick={handleCreate} disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Automation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Webhook URL Info Card */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Incoming Webhook URL</p>
                <p className="text-xs text-muted-foreground">
                  Configure your email provider to send events to this URL
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xl">
              <code className="text-xs bg-background px-3 py-2 rounded border flex-1 truncate">
                {webhookUrl}
              </code>
              <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Automations Card */}
      <Card className="mb-6 border-secondary/20 bg-secondary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Scheduled Automations</p>
                <p className="text-xs text-muted-foreground">
                  Process time-based triggers like "not opened after X days"
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={processScheduledAutomations}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Run Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Campaign vs Follow-up */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "campaign" | "followup")} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="campaign" className="gap-2">
            <Send className="w-4 h-4" />
            Campaign Automations
          </TabsTrigger>
          <TabsTrigger value="followup" className="gap-2">
            <Clock className="w-4 h-4" />
            Follow-up Automations
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredAutomations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-12 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-semibold mb-2">
            No {activeTab === "campaign" ? "campaign" : "follow-up"} automations yet
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {activeTab === "campaign"
              ? "Create automations that trigger based on campaign events like opens and clicks."
              : "Set up automated follow-ups for contacts who haven't responded."}
          </p>
          <Button variant="hero" onClick={() => {
            setFormData({ ...formData, type: activeTab });
            setIsDialogOpen(true);
          }}>
            Create Your First Automation
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAutomations.map((automation, index) => (
            <motion.div
              key={automation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="glass border-border hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{automation.name}</CardTitle>
                      <CardDescription>
                        {automation.type === "campaign" ? "Campaign" : "Follow-up"}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={automation.enabled}
                      onCheckedChange={() => toggleAutomation(automation.id, automation.enabled)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {/* Workflow visualization */}
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <Badge variant="outline" className="shrink-0">
                      {getTriggerName(automation.trigger, automation.type)}
                    </Badge>
                    {automation.delay && (
                      <>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <Badge variant="outline" className="shrink-0">
                          <Clock className="w-3 h-3 mr-1" />
                          {getDelayName(automation.delay)}
                        </Badge>
                      </>
                    )}
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <Badge variant="secondary" className="shrink-0">
                      {getActionName(automation.action)}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Triggered: {automation.triggered_count}</span>
                    <span>Completed: {automation.completed_count}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <Badge variant={automation.enabled ? "default" : "secondary"}>
                      {automation.enabled ? (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Running
                        </>
                      ) : (
                        <>
                          <Pause className="w-3 h-3 mr-1" />
                          Paused
                        </>
                      )}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteAutomation(automation.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Automations;
