import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import {
  Mail,
  Clock,
  MousePointerClick,
  UserPlus,
  Calendar,
  UserX,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  Tag,
  Bell,
  Webhook,
  Users,
  AlertTriangle,
  Pencil,
  TrendingUp,
  Eye,
  Play,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImprovedAutomationCardProps {
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
    description?: string;
  };
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onAnalytics?: (id: string) => void;
  onTest?: (id: string) => void;
}

const triggerMeta: Record<string, { icon: any; label: string; color: string }> = {
  email_opened: { icon: Mail, label: "Email Opened", color: "text-blue-500" },
  link_clicked: { icon: MousePointerClick, label: "Link Clicked", color: "text-blue-500" },
  not_opened: { icon: Clock, label: "Not Opened", color: "text-blue-500" },
  new_subscriber: { icon: UserPlus, label: "New Subscriber", color: "text-blue-500" },
  no_reply: { icon: Clock, label: "No Reply", color: "text-blue-500" },
  bounced: { icon: AlertTriangle, label: "Email Bounced", color: "text-red-500" },
  scheduled: { icon: Calendar, label: "Scheduled", color: "text-purple-500" },
  inactive: { icon: UserX, label: "Inactive", color: "text-orange-500" },
};

const actionMeta: Record<string, { icon: any; label: string; color: string }> = {
  send_email: { icon: Send, label: "Send Email", color: "text-emerald-500" },
  send_reengagement: { icon: Send, label: "Re-engagement", color: "text-emerald-500" },
  add_tag: { icon: Tag, label: "Add Tag", color: "text-emerald-500" },
  move_list: { icon: Users, label: "Move List", color: "text-emerald-500" },
  notify: { icon: Bell, label: "Notify", color: "text-emerald-500" },
  webhook: { icon: Webhook, label: "Webhook", color: "text-emerald-500" },
  mark_churned: { icon: UserX, label: "Mark Churned", color: "text-emerald-500" },
};

const delayLabels: Record<string, string> = {
  "1h": "1 hr",
  "6h": "6 hrs",
  "1d": "1 day",
  "2d": "2 days",
  "3d": "3 days",
  "1w": "1 week",
  "2w": "2 weeks",
  "30d": "30 days",
};

export const ImprovedAutomationCard = ({
  automation,
  onToggle,
  onDelete,
  onEdit,
  onAnalytics,
  onTest,
}: ImprovedAutomationCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const trigger = triggerMeta[automation.trigger] || {
    icon: Mail,
    label: automation.trigger,
    color: "text-muted-foreground",
  };
  const action = actionMeta[automation.action] || {
    icon: Send,
    label: automation.action,
    color: "text-muted-foreground",
  };
  
  const TriggerIcon = trigger.icon;
  const ActionIcon = action.icon;

  // Calculate completion rate
  const completionRate = automation.triggered_count > 0 
    ? Math.round((automation.completed_count / automation.triggered_count) * 100)
    : 0;

  // Determine status color based on enabled/disabled
  const statusColor = automation.enabled 
    ? "border-primary/30 bg-primary/5 shadow-[0_0_15px_hsl(var(--primary)/0.1)]"
    : "border-border/50 opacity-75 bg-muted/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <Card className={cn("glass overflow-hidden transition-all duration-300 hover:shadow-lg", statusColor)}>
        {/* Header */}
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-base truncate">{automation.name}</h3>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "capitalize text-xs",
                    automation.type === "campaign" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900"
                  )}
                >
                  {automation.type}
                </Badge>
                {!automation.enabled && (
                  <Badge variant="secondary" className="text-xs">Paused</Badge>
                )}
              </div>
              {automation.description && (
                <p className="text-sm text-muted-foreground truncate">{automation.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={automation.enabled}
                onCheckedChange={() => onToggle(automation.id, automation.enabled)}
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
        </CardHeader>

        {/* Flow Preview */}
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
            {/* Trigger */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-200 dark:border-blue-900">
              <TriggerIcon className={cn("w-4 h-4", trigger.color)} />
              <span className="text-xs font-medium">{trigger.label}</span>
            </div>

            {/* Delay (if present) */}
            {automation.delay && (
              <>
                <div className="text-muted-foreground">→</div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-200 dark:border-amber-900">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium">{delayLabels[automation.delay] || automation.delay}</span>
                </div>
              </>
            )}

            {/* Action */}
            <>
              <div className="text-muted-foreground">→</div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-200 dark:border-emerald-900">
                <ActionIcon className={cn("w-4 h-4", action.color)} />
                <span className="text-xs font-medium">{action.label}</span>
              </div>
            </>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 bg-secondary/50 rounded-lg p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{automation.triggered_count}</p>
              <p className="text-xs text-muted-foreground">Triggered</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-500">{automation.completed_count}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </div>

          {/* Expanded Details */}
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-3 border-t border-border/50 space-y-4"
            >
              {/* Timeline */}
              <div className="text-xs text-muted-foreground">
                <p>Created {new Date(automation.created_at).toLocaleDateString()}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {onTest && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs h-8"
                    onClick={() => onTest(automation.id)}
                  >
                    <Play className="w-3 h-3" />
                    Test
                  </Button>
                )}
                {onAnalytics && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs h-8"
                    onClick={() => onAnalytics(automation.id)}
                  >
                    <BarChart3 className="w-3 h-3" />
                    Analytics
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs h-8 flex-1"
                  onClick={() => onEdit(automation.id)}
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs h-8 text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background rounded-lg p-6 shadow-lg max-w-sm w-full mx-4 space-y-4"
          >
            <div>
              <h3 className="font-semibold">Delete Automation?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDelete(automation.id);
                  setShowDeleteConfirm(false);
                }}
              >
                Delete
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};
