import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImprovedAutomationCard } from "@/components/automations/ImprovedAutomationCard";
import { ModernFlowEditor, FlowNode } from "@/components/automations/ModernFlowEditor";
import { AutomationTemplateGrid, automationTemplates } from "@/components/automations/AutomationTemplates";
import { AutomationAnalytics } from "@/components/automations/AutomationAnalytics";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Zap,
  Loader2,
  AlertCircle,
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
  flow_config?: unknown;
  description?: string;
}

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
  flow_config: a.flow_config,
  description: (a.description as string) || undefined,
});

const Automations = () => {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "templates" | "analytics" | "campaign" | "followup">("all");
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [selectedAnalytics, setSelectedAnalytics] = useState<Automation | null>(null);

  useEffect(() => {
    fetchAutomations();
  }, [user]);

  const fetchAutomations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAutomations(data?.map((a) => mapDbToAutomation(a as unknown as Record<string, unknown>)) || []);
    } catch (error) {
      console.error("Error fetching automations:", error);
      toast({
        title: "Error loading automations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAutomation = async (data: {
    name: string;
    description: string;
    steps: FlowNode[];
  }) => {
    if (!user) return;

    const triggerStep = data.steps.find((s) => s.type === "trigger");
    const actionStep = data.steps.find((s) => s.type === "action");

    if (!triggerStep || !actionStep) {
      toast({
        title: "Invalid flow",
        description: "Flow must have at least a trigger and an action",
        variant: "destructive",
      });
      return;
    }

    const campaignTriggers = ["email_opened", "link_clicked", "not_opened", "new_subscriber"];
    const automationType = campaignTriggers.includes(triggerStep.nodeType) ? "campaign" : "followup";

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
          flow_config: JSON.parse(JSON.stringify(data.steps)),
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;

      setAutomations([mapDbToAutomation(newAutomation as unknown as Record<string, unknown>), ...automations]);
      setIsBuilderOpen(false);
      setEditingAutomation(null);
      toast({
        title: "Automation created",
        description: "Your automation is now active",
      });
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

  const handleUpdateAutomation = async (data: {
    name: string;
    description: string;
    steps: FlowNode[];
  }) => {
    if (!user || !editingAutomation) return;

    const triggerStep = data.steps.find((s) => s.type === "trigger");
    const actionStep = data.steps.find((s) => s.type === "action");

    if (!triggerStep || !actionStep) {
      toast({
        title: "Invalid flow",
        description: "Flow must have at least a trigger and an action",
        variant: "destructive",
      });
      return;
    }

    const campaignTriggers = ["email_opened", "link_clicked", "not_opened", "new_subscriber"];
    const automationType = campaignTriggers.includes(triggerStep.nodeType) ? "campaign" : "followup";

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
          flow_config: JSON.parse(JSON.stringify(data.steps)),
        })
        .eq("id", editingAutomation.id)
        .select()
        .single();

      if (error) throw error;

      setAutomations(
        automations.map((a) =>
          a.id === editingAutomation.id ? mapDbToAutomation(updated as unknown as Record<string, unknown>) : a
        )
      );
      setIsBuilderOpen(false);
      setEditingAutomation(null);
      toast({
        title: "Automation updated",
      });
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
        .from("automations")
        .update({ enabled: !currentEnabled })
        .eq("id", id);

      if (error) throw error;

      setAutomations(
        automations.map((a) => (a.id === id ? { ...a, enabled: !currentEnabled } : a))
      );
      toast({
        title: currentEnabled ? "Automation paused" : "Automation activated",
      });
    } catch (error) {
      console.error("Error toggling automation:", error);
      toast({
        title: "Error updating automation",
        variant: "destructive",
      });
    }
  };

  const deleteAutomation = async (id: string) => {
    try {
      const { error } = await supabase.from("automations").delete().eq("id", id);

      if (error) throw error;

      setAutomations(automations.filter((a) => a.id !== id));
      toast({
        title: "Automation deleted",
      });
    } catch (error) {
      console.error("Error deleting automation:", error);
      toast({
        title: "Error deleting automation",
        variant: "destructive",
      });
    }
  };

  const handleSelectTemplate = (template: typeof automationTemplates[0]) => {
    toast({
      title: "Template loaded",
      description: `Ready to customize "${template.name}"`,
    });
    setIsBuilderOpen(true);
  };

  const filteredAutomations = () => {
    const all = automations;
    switch (activeTab) {
      case "campaign":
        return all.filter((a) => a.type === "campaign");
      case "followup":
        return all.filter((a) => a.type === "followup");
      default:
        return all;
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Automations" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const automated = filteredAutomations();
  const stats = {
    total: automations.length,
    active: automations.filter((a) => a.enabled).length,
    campaigns: automations.filter((a) => a.type === "campaign").length,
    followups: automations.filter((a) => a.type === "followup").length,
  };

  return (
    <AppLayout
      title="Automations"
      description="Create and manage email automation workflows"
      action={
        <Dialog open={isBuilderOpen} onOpenChange={(open) => {
          setIsBuilderOpen(open);
          if (!open) setEditingAutomation(null);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setEditingAutomation(null)}>
              <Plus className="w-4 h-4" />
              Create Automation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>{editingAutomation ? "Edit Automation" : "Create Automation"}</DialogTitle>
            </DialogHeader>
            <ModernFlowEditor
              onSubmit={editingAutomation ? handleUpdateAutomation : handleCreateAutomation}
              onCancel={() => {
                setIsBuilderOpen(false);
                setEditingAutomation(null);
              }}
              isSaving={isSaving}
            />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, icon: Zap, color: "text-primary" },
            { label: "Active", value: stats.active, icon: Zap, color: "text-emerald-500" },
            { label: "Campaigns", value: stats.campaigns, icon: Zap, color: "text-blue-500" },
            { label: "Follow-ups", value: stats.followups, icon: Zap, color: "text-amber-500" },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                      <stat.icon className="w-4 h-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All ({automations.length})</TabsTrigger>
            <TabsTrigger value="campaign">Campaigns ({stats.campaigns})</TabsTrigger>
            <TabsTrigger value="followup">Follow-ups ({stats.followups})</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          {/* Automations List */}
          <div className="space-y-4 mt-6">
            {activeTab === "templates" ? (
              <AutomationTemplateGrid onSelectTemplate={handleSelectTemplate} />
            ) : (
              <>
                {automated.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Card className="glass border-dashed">
                      <CardContent className="p-8 text-center">
                        <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-3 opacity-50" />
                        <p className="text-muted-foreground">No automations yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Create your first automation or choose from templates
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  <div className="grid gap-4">
                    <AnimatePresence>
                      {automated.map((automation) => (
                        <ImprovedAutomationCard
                          key={automation.id}
                          automation={automation}
                          onToggle={toggleAutomation}
                          onDelete={deleteAutomation}
                          onEdit={(id) => {
                            const auto = automations.find((a) => a.id === id);
                            if (auto) {
                              setEditingAutomation(auto);
                              setIsBuilderOpen(true);
                            }
                          }}
                          onAnalytics={(id) => {
                            const auto = automations.find((a) => a.id === id);
                            if (auto) setSelectedAnalytics(auto);
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </div>
        </Tabs>
      </div>

      {/* Analytics Modal */}
      {selectedAnalytics && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedAnalytics(null)}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background rounded-lg p-6 shadow-lg max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{selectedAnalytics.name}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAnalytics(null)}
                >
                  Close
                </Button>
              </div>
              <AutomationAnalytics automation={selectedAnalytics} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AppLayout>
  );
};

export default Automations;
