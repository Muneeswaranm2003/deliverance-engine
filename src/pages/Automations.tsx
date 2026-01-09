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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  Plus,
  Zap,
  Mail,
  Clock,
  Check,
  Loader2,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  Send,
  UserPlus,
  MousePointerClick,
  Calendar,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Automation {
  id: string;
  name: string;
  type: "campaign" | "followup";
  trigger: string;
  action: string;
  delay?: string;
  enabled: boolean;
  stats: {
    triggered: number;
    completed: number;
  };
  createdAt: Date;
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
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"campaign" | "followup">("campaign");
  const [formData, setFormData] = useState({
    name: "",
    type: "campaign" as "campaign" | "followup",
    trigger: "",
    action: "",
    delay: "",
  });

  const handleCreate = () => {
    if (!formData.name || !formData.trigger || !formData.action) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const newAutomation: Automation = {
      id: crypto.randomUUID(),
      name: formData.name,
      type: formData.type,
      trigger: formData.trigger,
      action: formData.action,
      delay: formData.delay || undefined,
      enabled: true,
      stats: { triggered: 0, completed: 0 },
      createdAt: new Date(),
    };

    setAutomations([...automations, newAutomation]);
    setIsDialogOpen(false);
    setFormData({ name: "", type: "campaign", trigger: "", action: "", delay: "" });
    toast({ title: "Automation created successfully" });
  };

  const toggleAutomation = (id: string) => {
    setAutomations(
      automations.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      )
    );
  };

  const deleteAutomation = (id: string) => {
    setAutomations(automations.filter((a) => a.id !== id));
    toast({ title: "Automation deleted" });
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

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="hero" onClick={handleCreate}>
                  Create Automation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
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
                      onCheckedChange={() => toggleAutomation(automation.id)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {/* Workflow visualization */}
                  <div className="flex items-center gap-2 text-sm">
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
                    <span>Triggered: {automation.stats.triggered}</span>
                    <span>Completed: {automation.stats.completed}</span>
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