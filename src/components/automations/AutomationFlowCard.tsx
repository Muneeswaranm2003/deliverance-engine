import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FlowNode, FlowConnector } from "./FlowNode";
import { motion } from "framer-motion";
import {
  Mail,
  Clock,
  MousePointerClick,
  UserPlus,
  Calendar,
  UserX,
  Zap,
  Trash2,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Send,
  Tag,
  Bell,
  Webhook,
  Users,
  AlertTriangle,
} from "lucide-react";

interface AutomationFlowCardProps {
  automation: {
    id: string;
    name: string;
    type: "campaign" | "followup";
    trigger: string;
    action: string;
    delay?: string;
    enabled: boolean;
    triggered_count: number;
    completed_count: number;
    created_at: string;
  };
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

const triggerMeta: Record<string, { icon: typeof Mail; label: string }> = {
  email_opened: { icon: Mail, label: "Email Opened" },
  link_clicked: { icon: MousePointerClick, label: "Link Clicked" },
  not_opened: { icon: Clock, label: "Not Opened" },
  new_subscriber: { icon: UserPlus, label: "New Subscriber" },
  no_reply: { icon: Clock, label: "No Reply" },
  opened_no_click: { icon: Mail, label: "Opened, No Click" },
  bounced: { icon: AlertTriangle, label: "Email Bounced" },
  scheduled: { icon: Calendar, label: "Scheduled Date" },
  inactive: { icon: UserX, label: "Inactive Subscriber" },
};

const actionMeta: Record<string, { icon: typeof Send; label: string }> = {
  send_email: { icon: Send, label: "Send Follow-up" },
  send_reengagement: { icon: Send, label: "Send Re-engagement" },
  add_tag: { icon: Tag, label: "Add Tag" },
  move_list: { icon: Users, label: "Move to List" },
  notify: { icon: Bell, label: "Send Notification" },
  webhook: { icon: Webhook, label: "Trigger Webhook" },
  mark_churned: { icon: UserX, label: "Mark as Churned" },
};

const delayLabels: Record<string, string> = {
  "1h": "1 hour",
  "6h": "6 hours",
  "1d": "1 day",
  "2d": "2 days",
  "3d": "3 days",
  "1w": "1 week",
  "2w": "2 weeks",
  "30d": "30 days",
  "60d": "60 days",
  "90d": "90 days",
};

export const AutomationFlowCard = ({
  automation,
  onToggle,
  onDelete,
}: AutomationFlowCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const trigger = triggerMeta[automation.trigger] || {
    icon: Zap,
    label: automation.trigger,
  };
  const action = actionMeta[automation.action] || {
    icon: Zap,
    label: automation.action,
  };
  const TriggerIcon = trigger.icon;
  const ActionIcon = action.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <Card
        className={`glass overflow-hidden transition-all ${
          automation.enabled
            ? "border-border hover:border-primary/30"
            : "border-border/50 opacity-75"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                automation.type === "campaign"
                  ? "bg-primary/10"
                  : "bg-amber-500/10"
              }`}
            >
              <Zap
                className={`w-5 h-5 ${
                  automation.type === "campaign"
                    ? "text-primary"
                    : "text-amber-500"
                }`}
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{automation.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 ${
                    automation.type === "campaign"
                      ? "bg-primary/10 text-primary"
                      : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  {automation.type === "campaign" ? "Campaign" : "Follow-up"}
                </Badge>
                <span>•</span>
                <span>{automation.triggered_count} triggered</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={automation.enabled}
              onCheckedChange={() =>
                onToggle(automation.id, automation.enabled)
              }
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Flow Preview (Collapsed) */}
        <CardContent className="py-4">
          <div className="flex flex-col items-stretch">
            {/* Trigger Node */}
            <FlowNode
              type="trigger"
              icon={<TriggerIcon className="w-5 h-5" />}
              title={trigger.label}
              subtitle="When this happens..."
              active={automation.enabled}
            />

            {/* Delay Node (if present) */}
            {automation.delay && (
              <>
                <FlowConnector />
                <FlowNode
                  type="delay"
                  icon={<Clock className="w-5 h-5" />}
                  title={`Wait ${delayLabels[automation.delay] || automation.delay}`}
                  subtitle="Then continue..."
                  active={automation.enabled}
                />
              </>
            )}

            {/* Action Node */}
            <FlowConnector />
            <FlowNode
              type="action"
              icon={<ActionIcon className="w-5 h-5" />}
              title={action.label}
              subtitle="Execute this action"
              active={automation.enabled}
            />
          </div>

          {/* Expanded Details */}
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-border/50"
            >
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Triggered</p>
                  <p className="font-semibold text-lg">
                    {automation.triggered_count}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="font-semibold text-lg">
                    {automation.completed_count}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                <Badge
                  variant={automation.enabled ? "default" : "secondary"}
                  className="gap-1"
                >
                  {automation.enabled ? (
                    <>
                      <Play className="w-3 h-3" />
                      Running
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3" />
                      Paused
                    </>
                  )}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(automation.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
