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
  GitBranch,
  Hourglass,
  type LucideIcon,
} from "lucide-react";

export type NodeKind = "trigger" | "delay" | "action" | "condition";

export interface NodeDef {
  kind: NodeKind;
  type: string;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultConfig?: Record<string, unknown>;
}

export const NODE_REGISTRY: NodeDef[] = [
  // Triggers
  { kind: "trigger", type: "email_opened", label: "Email Opened", icon: Mail, description: "When a recipient opens an email" },
  { kind: "trigger", type: "link_clicked", label: "Link Clicked", icon: MousePointerClick, description: "When a recipient clicks a link" },
  { kind: "trigger", type: "not_opened", label: "Not Opened", icon: Clock, description: "Email not opened after a window" },
  { kind: "trigger", type: "new_subscriber", label: "New Subscriber", icon: UserPlus, description: "A new contact joins a list" },
  { kind: "trigger", type: "no_reply", label: "No Reply", icon: Clock, description: "No response after sending" },
  { kind: "trigger", type: "bounced", label: "Email Bounced", icon: AlertTriangle, description: "Delivery bounced" },
  { kind: "trigger", type: "scheduled", label: "Scheduled", icon: Calendar, description: "On a scheduled date/time" },
  { kind: "trigger", type: "inactive", label: "Inactive Contact", icon: UserX, description: "Contact has been inactive" },

  // Delays
  { kind: "delay", type: "1h", label: "Wait 1 hour", icon: Hourglass, description: "Pause for 1 hour", defaultConfig: { duration: "1h" } },
  { kind: "delay", type: "6h", label: "Wait 6 hours", icon: Hourglass, description: "Pause for 6 hours", defaultConfig: { duration: "6h" } },
  { kind: "delay", type: "1d", label: "Wait 1 day", icon: Hourglass, description: "Pause for 1 day", defaultConfig: { duration: "1d" } },
  { kind: "delay", type: "3d", label: "Wait 3 days", icon: Hourglass, description: "Pause for 3 days", defaultConfig: { duration: "3d" } },
  { kind: "delay", type: "1w", label: "Wait 1 week", icon: Hourglass, description: "Pause for 1 week", defaultConfig: { duration: "1w" } },

  // Conditions
  { kind: "condition", type: "if_opened", label: "If Opened", icon: GitBranch, description: "Branch on open event", defaultConfig: { label: "If Opened" } },
  { kind: "condition", type: "if_clicked", label: "If Clicked", icon: GitBranch, description: "Branch on click event", defaultConfig: { label: "If Clicked" } },

  // Actions
  { kind: "action", type: "send_email", label: "Send Email", icon: Send, description: "Send a templated email" },
  { kind: "action", type: "send_reengagement", label: "Re-engagement", icon: Send, description: "Send a re-engagement message" },
  { kind: "action", type: "add_tag", label: "Add Tag", icon: Tag, description: "Tag the contact" },
  { kind: "action", type: "move_list", label: "Move to List", icon: Users, description: "Move contact between lists" },
  { kind: "action", type: "notify", label: "Notify Team", icon: Bell, description: "Send an internal notification" },
  { kind: "action", type: "webhook", label: "Webhook", icon: Webhook, description: "POST to a webhook URL" },
  { kind: "action", type: "mark_churned", label: "Mark Churned", icon: UserX, description: "Mark contact as churned" },
];

export const findNodeDef = (kind: NodeKind, type: string): NodeDef | undefined =>
  NODE_REGISTRY.find((n) => n.kind === kind && n.type === type);

export const kindStyle: Record<NodeKind, { ring: string; bg: string; border: string; icon: string; dot: string; label: string }> = {
  trigger: {
    ring: "ring-blue-500/30",
    bg: "bg-blue-500/10",
    border: "border-blue-500/40",
    icon: "text-blue-300",
    dot: "bg-blue-400",
    label: "Trigger",
  },
  delay: {
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    icon: "text-amber-300",
    dot: "bg-amber-400",
    label: "Delay",
  },
  condition: {
    ring: "ring-violet-500/30",
    bg: "bg-violet-500/10",
    border: "border-violet-500/40",
    icon: "text-violet-300",
    dot: "bg-violet-400",
    label: "Condition",
  },
  action: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    icon: "text-emerald-300",
    dot: "bg-emerald-400",
    label: "Action",
  },
};
