import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  Activity,
  Send,
  Clock,
  Sparkles,
  LayoutTemplate,
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "triggered" | "completion">("recent");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

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
    let all = automations;
    if (activeTab === "campaign") all = all.filter((a) => a.type === "campaign");
    if (activeTab === "followup") all = all.filter((a) => a.type === "followup");

    if (statusFilter === "active") all = all.filter((a) => a.enabled);
    if (statusFilter === "paused") all = all.filter((a) => !a.enabled);

    if (search.trim()) {
      const q = search.toLowerCase();
      all = all.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description?.toLowerCase().includes(q) ?? false) ||
          a.trigger.toLowerCase().includes(q) ||
          a.action.toLowerCase().includes(q)
      );
    }

    const sorted = [...all];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "triggered":
          return b.triggered_count - a.triggered_count;
        case "completion": {
          const ar = a.triggered_count ? a.completed_count / a.triggered_count : 0;
          const br = b.triggered_count ? b.completed_count / b.triggered_count : 0;
          return br - ar;
        }
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return sorted;
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
  const totalTriggered = automations.reduce((sum, a) => sum + (a.triggered_count || 0), 0);
  const totalCompleted = automations.reduce((sum, a) => sum + (a.completed_count || 0), 0);
  const overallSuccess = totalTriggered ? Math.round((totalCompleted / totalTriggered) * 100) : 0;

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
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8"
        >
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-20 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Workflow Engine
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
                Automate every touchpoint
              </h2>
              <p className="text-sm text-muted-foreground">
                Build branching, time-aware journeys that nurture, recover, and re-engage subscribers automatically.
              </p>
            </div>
            <div className="flex items-center gap-6 md:gap-8 px-1">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Triggered</p>
                <p className="text-2xl font-bold tabular-nums">{totalTriggered}</p>
              </div>
              <div className="h-10 w-px bg-border/60" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Success</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-400">{overallSuccess}%</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Flows", value: stats.total, icon: Zap, accent: "from-primary/20 to-primary/0", iconColor: "text-primary", ring: "ring-primary/20" },
            { label: "Active", value: stats.active, icon: Activity, accent: "from-emerald-500/20 to-emerald-500/0", iconColor: "text-emerald-400", ring: "ring-emerald-500/20" },
            { label: "Campaigns", value: stats.campaigns, icon: Send, accent: "from-blue-500/20 to-blue-500/0", iconColor: "text-blue-400", ring: "ring-blue-500/20" },
            { label: "Follow-ups", value: stats.followups, icon: Clock, accent: "from-amber-500/20 to-amber-500/0", iconColor: "text-amber-400", ring: "ring-amber-500/20" },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className={cn("glass relative overflow-hidden group transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-10px_hsl(var(--primary)/0.3)]")}>
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none", stat.accent)} />
                <CardContent className="p-4 relative">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                      <p className="text-3xl font-bold font-display tabular-nums">{stat.value}</p>
                    </div>
                    <div className={cn("p-2 rounded-lg bg-background/40 backdrop-blur ring-1", stat.ring, stat.iconColor)}>
                      <stat.icon className="w-4 h-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs + Toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full lg:w-auto">
            <TabsList className="bg-card/60 backdrop-blur border border-border/60 h-10 p-1">
              <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <Zap className="w-3.5 h-3.5" /> All
                <span className="text-xs opacity-70">{automations.length}</span>
              </TabsTrigger>
              <TabsTrigger value="campaign" className="gap-2 data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-400">
                <Send className="w-3.5 h-3.5" /> Campaigns
                <span className="text-xs opacity-70">{stats.campaigns}</span>
              </TabsTrigger>
              <TabsTrigger value="followup" className="gap-2 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400">
                <Clock className="w-3.5 h-3.5" /> Follow-ups
                <span className="text-xs opacity-70">{stats.followups}</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-400">
                <LayoutTemplate className="w-3.5 h-3.5" /> Templates
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {activeTab !== "templates" && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:flex-none lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search automations…"
                  className="pl-9 h-10 bg-card/60 backdrop-blur border-border/60"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="h-10 w-[120px] bg-card/60 backdrop-blur border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-10 w-[140px] bg-card/60 backdrop-blur border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="name">Name (A–Z)</SelectItem>
                  <SelectItem value="triggered">Most triggered</SelectItem>
                  <SelectItem value="completion">Best success rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Automations List */}
        <div className="space-y-4">
            {activeTab === "templates" ? (
              <AutomationTemplateGrid onSelectTemplate={handleSelectTemplate} />
            ) : (
              <>
                {automated.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Card className="glass border-dashed border-border/60 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
                      <CardContent className="p-10 text-center relative">
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                          {search || statusFilter !== "all" ? (
                            <AlertCircle className="w-6 h-6 text-primary" />
                          ) : (
                            <Sparkles className="w-6 h-6 text-primary" />
                          )}
                        </div>
                        <h3 className="font-display text-lg font-semibold">
                          {search || statusFilter !== "all"
                            ? "No matching automations"
                            : "Your canvas is empty"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                          {search || statusFilter !== "all"
                            ? "Try a different search term or status filter."
                            : "Build a flow from scratch or start from a proven template."}
                        </p>
                        {!(search || statusFilter !== "all") && (
                          <div className="flex items-center justify-center gap-2 mt-5">
                            <Button variant="hero" className="gap-2" onClick={() => setIsBuilderOpen(true)}>
                              <Plus className="w-4 h-4" /> Create automation
                            </Button>
                            <Button variant="outline" className="gap-2" onClick={() => setActiveTab("templates")}>
                              <LayoutTemplate className="w-4 h-4" /> Browse templates
                            </Button>
                          </div>
                        )}
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
