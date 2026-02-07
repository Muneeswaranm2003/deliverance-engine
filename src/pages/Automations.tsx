import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationFlowCard } from "@/components/automations/AutomationFlowCard";
import { FlowBuilder } from "@/components/automations/FlowBuilder";
 import { MultiStepFlowBuilder } from "@/components/automations/MultiStepFlowBuilder";
 import { FlowStep } from "@/components/automations/flowTypes";
import { motion } from "framer-motion";
import {
  Plus,
  Zap,
  Clock,
  Loader2,
  Send,
  Copy,
  ExternalLink,
  RefreshCw,
  UserX,
  Workflow,
   Layers,
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
  flow_config?: FlowStep[] | null;
  description?: string | null;
}

/** Convert a saved automation record back into flow builder data */
const automationToFlowData = (automation: Automation): { name: string; description: string; steps: FlowStep[] } => {
  // If we have a saved flow_config, use it directly
  if (automation.flow_config && Array.isArray(automation.flow_config) && automation.flow_config.length > 0) {
    return {
      name: automation.name,
      description: automation.description || "",
      steps: automation.flow_config,
    };
  }

  // Legacy fallback: reconstruct from flat fields
  const steps: FlowStep[] = [];

  steps.push({
    id: `step-trigger-${automation.id}`,
    type: "trigger",
    nodeType: automation.trigger,
  });

  if (automation.delay) {
    const reverseDelayMap: Record<string, string> = {
      "1h": "wait_1h",
      "1d": "wait_1d",
      "3d": "wait_3d",
      "1w": "wait_1w",
    };
    steps.push({
      id: `step-delay-${automation.id}`,
      type: "delay",
      nodeType: reverseDelayMap[automation.delay] || "wait_custom",
    });
  }

  steps.push({
    id: `step-action-${automation.id}`,
    type: "action",
    nodeType: automation.action,
  });

  return {
    name: automation.name,
    description: automation.description || "",
    steps,
  };
};

/** Safely map a DB record to the local Automation type */
const mapDbToAutomation = (a: Record<string, unknown>): Automation => ({
  id: a.id as string,
  name: a.name as string,
  type: a.type as "campaign" | "followup",
  trigger: a.trigger as string,
  action: a.action as string,
  delay: (a.delay as string) || undefined,
  enabled: a.enabled as boolean,
  webhook_url: (a.webhook_url as string) || undefined,
  triggered_count: (a.triggered_count as number) || 0,
  completed_count: (a.completed_count as number) || 0,
  created_at: a.created_at as string,
  flow_config: Array.isArray(a.flow_config) ? (a.flow_config as unknown as FlowStep[]) : undefined,
  description: (a.description as string) || undefined,
});

const Automations = () => {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReengaging, setIsReengaging] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMultiStepDialogOpen, setIsMultiStepDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
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
  const reengagementUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-reengagement`;

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

  const processReengagement = async () => {
    setIsReengaging(true);
    try {
      const response = await fetch(reengagementUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Re-engagement processed",
          description: `Processed ${data.contacts_processed} contacts, ${data.newly_inactive} newly inactive, ${data.reengagement_triggered} re-engagement triggered`,
        });
      } else {
        throw new Error(data.error || 'Failed to process');
      }
    } catch (error) {
      console.error('Error processing re-engagement:', error);
      toast({
        title: "Error processing re-engagement",
        variant: "destructive",
      });
    } finally {
      setIsReengaging(false);
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
      
      setAutomations(data?.map(a => mapDbToAutomation(a as unknown as Record<string, unknown>)) || []);
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

      setAutomations([mapDbToAutomation(data as unknown as Record<string, unknown>), ...automations]);
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

   const handleMultiStepCreate = async (data: {
     name: string;
     description: string;
     steps: FlowStep[];
   }) => {
     if (!user) return;
 
     // Extract trigger and first action from steps for backwards compatibility
     const triggerStep = data.steps.find((s) => s.type === "trigger");
     const actionStep = data.steps.find((s) => s.type === "action");
     const delayStep = data.steps.find((s) => s.type === "delay");
 
     if (!triggerStep || !actionStep) {
       toast({
         title: "Invalid flow",
         description: "Flow must have at least one trigger and one action",
         variant: "destructive",
       });
       return;
     }
 
     // Determine type based on trigger
     const campaignTriggers = ["email_opened", "link_clicked", "not_opened", "new_subscriber"];
     const automationType = campaignTriggers.includes(triggerStep.nodeType) ? "campaign" : "followup";
 
     // Map delay step to delay string
     const delayMap: Record<string, string> = {
       wait_1h: "1h",
       wait_1d: "1d",
       wait_3d: "3d",
       wait_1w: "1w",
       wait_custom: "1d",
     };
 
     setIsSaving(true);
     try {
       const { data: newAutomation, error } = await supabase
          .from("automations")
          .insert({
            user_id: user.id,
            name: data.name,
            description: data.description || null,
            type: automationType,
            trigger: triggerStep.nodeType,
            action: actionStep.nodeType,
            delay: delayStep ? delayMap[delayStep.nodeType] || null : null,
            flow_config: JSON.parse(JSON.stringify(data.steps)),
            enabled: true,
          })
          .select()
          .single();
 
        if (error) throw error;

        setAutomations([
          mapDbToAutomation(newAutomation as unknown as Record<string, unknown>),
          ...automations,
        ]);
       setIsMultiStepDialogOpen(false);
       toast({ title: "Multi-step automation created successfully" });
     } catch (error) {
       console.error("Error creating automation:", error);
       toast({
         title: "Error creating automation",
         variant: "destructive",
       });
     } finally {
       setIsSaving(false);
     }
    };
 
  const handleEditAutomation = (id: string) => {
    const automation = automations.find((a) => a.id === id);
    if (!automation) return;
    setEditingAutomation(automation);
    setIsMultiStepDialogOpen(true);
  };

  const handleMultiStepUpdate = async (data: {
    name: string;
    description: string;
    steps: FlowStep[];
  }) => {
    if (!user || !editingAutomation) return;

    const triggerStep = data.steps.find((s) => s.type === "trigger");
    const actionStep = data.steps.find((s) => s.type === "action");
    const delayStep = data.steps.find((s) => s.type === "delay");

    if (!triggerStep || !actionStep) {
      toast({
        title: "Invalid flow",
        description: "Flow must have at least one trigger and one action",
        variant: "destructive",
      });
      return;
    }

    const campaignTriggers = ["email_opened", "link_clicked", "not_opened", "new_subscriber"];
    const automationType = campaignTriggers.includes(triggerStep.nodeType) ? "campaign" : "followup";

    const delayMap: Record<string, string> = {
      wait_1h: "1h",
      wait_1d: "1d",
      wait_3d: "3d",
      wait_1w: "1w",
      wait_custom: "1d",
    };

    setIsSaving(true);
    try {
      const { data: updated, error } = await supabase
        .from("automations")
        .update({
          name: data.name,
          description: data.description || null,
          type: automationType,
          trigger: triggerStep.nodeType,
          action: actionStep.nodeType,
          delay: delayStep ? delayMap[delayStep.nodeType] || null : null,
          flow_config: JSON.parse(JSON.stringify(data.steps)),
        })
        .eq("id", editingAutomation.id)
        .select()
        .single();

      if (error) throw error;

      setAutomations(
        automations.map((a) =>
          a.id === editingAutomation.id
            ? mapDbToAutomation(updated as unknown as Record<string, unknown>)
            : a
        )
      );
      setIsMultiStepDialogOpen(false);
      setEditingAutomation(null);
      toast({ title: "Automation updated successfully" });
    } catch (error) {
      console.error("Error updating automation:", error);
      toast({
        title: "Error updating automation",
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

  const filteredAutomations = automations.filter((a) => a.type === activeTab);
  const campaignCount = automations.filter((a) => a.type === "campaign").length;
  const followupCount = automations.filter((a) => a.type === "followup").length;

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
      description="Build visual automation flows for your campaigns"
      action={
        <div className="flex gap-2">
          <Dialog open={isMultiStepDialogOpen} onOpenChange={(open) => {
            setIsMultiStepDialogOpen(open);
            if (!open) setEditingAutomation(null);
          }}>
            <DialogTrigger asChild>
              <Button variant="hero" className="gap-2" onClick={() => setEditingAutomation(null)}>
                <Layers className="w-4 h-4" />
                Multi-Step Flow
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 overflow-hidden">
              <DialogHeader className="sr-only">
                <DialogTitle>{editingAutomation ? "Edit Automation" : "Create Multi-Step Automation"}</DialogTitle>
              </DialogHeader>
              <MultiStepFlowBuilder
                onSubmit={editingAutomation ? handleMultiStepUpdate : handleMultiStepCreate}
                onCancel={() => {
                  setIsMultiStepDialogOpen(false);
                  setEditingAutomation(null);
                }}
                isSaving={isSaving}
                initialData={editingAutomation ? automationToFlowData(editingAutomation) : undefined}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Quick Create
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-primary" />
                  Create Automation Flow
                </DialogTitle>
              </DialogHeader>
              <FlowBuilder
                formData={formData}
                onChange={(data) => setFormData({ ...formData, ...data })}
                onSubmit={handleCreate}
                onCancel={() => setIsDialogOpen(false)}
                isSaving={isSaving}
              />
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* Quick Actions Grid */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {/* Webhook URL Card */}
        <Card className="glass border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Webhook URL</p>
                <p className="text-xs text-muted-foreground truncate">
                  For incoming events
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Automations Card */}
        <Card className="glass border-secondary/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Scheduled</p>
                <p className="text-xs text-muted-foreground">
                  Time-based triggers
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={processScheduledAutomations}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Re-engagement Card */}
        <Card className="glass border-amber-500/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Re-engage</p>
                <p className="text-xs text-muted-foreground">
                  Inactive subscribers
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={processReengagement}
                disabled={isReengaging}
              >
                {isReengaging ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Campaign vs Follow-up */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "campaign" | "followup")} className="mb-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="campaign" className="gap-2">
            <Send className="w-4 h-4" />
            Campaign
            {campaignCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                {campaignCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="followup" className="gap-2">
            <Clock className="w-4 h-4" />
            Follow-up
            {followupCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                {followupCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredAutomations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-12 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6">
            <Workflow className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-semibold mb-2">
            Build Your First {activeTab === "campaign" ? "Campaign" : "Follow-up"} Flow
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            {activeTab === "campaign"
              ? "Create visual automation flows that trigger based on email events like opens, clicks, and bounces."
              : "Set up automated follow-up sequences for contacts who haven't responded or engaged."}
          </p>
          <Button 
            variant="hero" 
            size="lg"
            onClick={() => {
              setFormData({ ...formData, type: activeTab });
              setIsDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Automation Flow
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsMultiStepDialogOpen(true)}
            className="gap-2"
          >
            <Layers className="w-5 h-5" />
            Multi-Step Builder
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAutomations.map((automation) => (
            <AutomationFlowCard
              key={automation.id}
              automation={automation}
              onToggle={toggleAutomation}
              onDelete={deleteAutomation}
              onEdit={handleEditAutomation}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Automations;
