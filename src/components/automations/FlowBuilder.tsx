import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FlowNode, FlowConnector } from "./FlowNode";
import {
  Mail,
  Clock,
  MousePointerClick,
  UserPlus,
  Calendar,
  UserX,
  Send,
  Tag,
  Bell,
  Webhook,
  Users,
  AlertTriangle,
  Loader2,
  Zap,
} from "lucide-react";

interface FlowBuilderProps {
  formData: {
    name: string;
    type: "campaign" | "followup";
    trigger: string;
    action: string;
    delay: string;
    webhook_url: string;
  };
  onChange: (data: Partial<FlowBuilderProps["formData"]>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
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
  { id: "bounced", name: "Email Bounced", icon: AlertTriangle },
  { id: "scheduled", name: "Scheduled Date", icon: Calendar },
  { id: "inactive", name: "Inactive Subscriber", icon: UserX },
];

const actions = [
  { id: "send_email", name: "Send Follow-up Email", icon: Send },
  { id: "send_reengagement", name: "Send Re-engagement Email", icon: Send },
  { id: "add_tag", name: "Add Tag to Contact", icon: Tag },
  { id: "move_list", name: "Move to Another List", icon: Users },
  { id: "notify", name: "Send Notification", icon: Bell },
  { id: "webhook", name: "Trigger Webhook", icon: Webhook },
  { id: "mark_churned", name: "Mark as Churned", icon: UserX },
];

const delayOptions = [
  { id: "1h", name: "1 hour" },
  { id: "6h", name: "6 hours" },
  { id: "1d", name: "1 day" },
  { id: "2d", name: "2 days" },
  { id: "3d", name: "3 days" },
  { id: "1w", name: "1 week" },
  { id: "2w", name: "2 weeks" },
  { id: "30d", name: "30 days" },
  { id: "60d", name: "60 days" },
  { id: "90d", name: "90 days" },
];

export const FlowBuilder = ({
  formData,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
}: FlowBuilderProps) => {
  const triggers = formData.type === "campaign" ? campaignTriggers : followupTriggers;
  const selectedTrigger = triggers.find((t) => t.id === formData.trigger);
  const selectedAction = actions.find((a) => a.id === formData.action);
  const showDelay = formData.trigger === "not_opened" || formData.trigger === "no_reply";
  const TriggerIcon = selectedTrigger?.icon || Zap;
  const ActionIcon = selectedAction?.icon || Zap;

  return (
    <div className="space-y-6">
      {/* Name Input */}
      <div className="space-y-2">
        <Label htmlFor="flow-name">Automation Name</Label>
        <Input
          id="flow-name"
          placeholder="e.g., Follow up on unopened emails"
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      {/* Type Selection */}
      <div className="space-y-2">
        <Label>Automation Type</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ type: "campaign", trigger: "" })}
            className={`p-4 rounded-xl border text-left transition-all ${
              formData.type === "campaign"
                ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Send className={`w-5 h-5 mb-2 ${formData.type === "campaign" ? "text-primary" : "text-muted-foreground"}`} />
            <p className="font-medium text-sm">Campaign</p>
            <p className="text-xs text-muted-foreground">Trigger on email events</p>
          </button>
          <button
            type="button"
            onClick={() => onChange({ type: "followup", trigger: "" })}
            className={`p-4 rounded-xl border text-left transition-all ${
              formData.type === "followup"
                ? "border-amber-500 bg-amber-500/10 shadow-[0_0_20px_hsl(38_92%_50%/0.1)]"
                : "border-border hover:border-amber-500/50"
            }`}
          >
            <Clock className={`w-5 h-5 mb-2 ${formData.type === "followup" ? "text-amber-500" : "text-muted-foreground"}`} />
            <p className="font-medium text-sm">Follow-up</p>
            <p className="text-xs text-muted-foreground">Time-based triggers</p>
          </button>
        </div>
      </div>

      {/* Visual Flow Builder */}
      <div className="space-y-2">
        <Label>Build Your Flow</Label>
        <div className="p-6 rounded-xl border border-dashed border-border bg-secondary/20">
          {/* Trigger Node */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">When this happens...</p>
            <Select
              value={formData.trigger}
              onValueChange={(value) => onChange({ trigger: value })}
            >
              <SelectTrigger className="w-full bg-emerald-500/5 border-emerald-500/30 focus:ring-emerald-500/50">
                <SelectValue placeholder="Select a trigger" />
              </SelectTrigger>
              <SelectContent>
                {triggers.map((trigger) => (
                  <SelectItem key={trigger.id} value={trigger.id}>
                    <span className="flex items-center gap-2">
                      <trigger.icon className="w-4 h-4" />
                      {trigger.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.trigger && (
              <FlowNode
                type="trigger"
                icon={<TriggerIcon className="w-5 h-5" />}
                title={selectedTrigger?.name || formData.trigger}
                subtitle="Trigger"
              />
            )}
          </div>

          {/* Delay Node (conditional) */}
          {showDelay && (
            <>
              <FlowConnector className="my-2" />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Wait for...</p>
                <Select
                  value={formData.delay}
                  onValueChange={(value) => onChange({ delay: value })}
                >
                  <SelectTrigger className="w-full bg-amber-500/5 border-amber-500/30 focus:ring-amber-500/50">
                    <SelectValue placeholder="Select delay duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {delayOptions.map((delay) => (
                      <SelectItem key={delay.id} value={delay.id}>
                        {delay.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.delay && (
                  <FlowNode
                    type="delay"
                    icon={<Clock className="w-5 h-5" />}
                    title={`Wait ${delayOptions.find((d) => d.id === formData.delay)?.name}`}
                    subtitle="Delay"
                  />
                )}
              </div>
            </>
          )}

          {/* Action Node */}
          {formData.trigger && (
            <>
              <FlowConnector className="my-2" />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Then do this...</p>
                <Select
                  value={formData.action}
                  onValueChange={(value) => onChange({ action: value })}
                >
                  <SelectTrigger className="w-full bg-primary/5 border-primary/30 focus:ring-primary/50">
                    <SelectValue placeholder="Select an action" />
                  </SelectTrigger>
                  <SelectContent>
                    {actions.map((action) => (
                      <SelectItem key={action.id} value={action.id}>
                        <span className="flex items-center gap-2">
                          <action.icon className="w-4 h-4" />
                          {action.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.action && (
                  <FlowNode
                    type="action"
                    icon={<ActionIcon className="w-5 h-5" />}
                    title={selectedAction?.name || formData.action}
                    subtitle="Action"
                  />
                )}
              </div>
            </>
          )}

          {/* Webhook URL (conditional) */}
          {formData.action === "webhook" && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://your-webhook-endpoint.com"
                value={formData.webhook_url}
                onChange={(e) => onChange({ webhook_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                This URL will be called when the automation triggers
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="hero" onClick={onSubmit} disabled={isSaving}>
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Automation
        </Button>
      </div>
    </div>
  );
};
