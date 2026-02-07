import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X, Save, Settings } from "lucide-react";
import { FlowStep, nodeStyles } from "./flowTypes";
import { nodeCategories } from "./NodePalette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NodeConfigPanelProps {
  step: FlowStep | null;
  onSave: (stepId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
}

export const NodeConfigPanel = ({ step, onSave, onClose }: NodeConfigPanelProps) => {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});

  const nodeConfig = useMemo(() => {
    if (!step) return null;
    for (const cat of nodeCategories) {
      const found = cat.nodes.find((n) => n.id === step.nodeType);
      if (found) return found;
    }
    return null;
  }, [step?.nodeType]);

  useEffect(() => {
    if (step) {
      setLocalConfig(step.config || {});
    }
  }, [step]);

  if (!step) return null;

  const styles = nodeStyles[step.type];
  const Icon = nodeConfig?.icon;

  const updateField = (key: string, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(step.id, localConfig);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-72 shrink-0 border-l border-border bg-secondary/30 overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          {Icon && (
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", styles.iconBg)}>
              <Icon className={cn("w-4 h-4", styles.iconColor)} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{nodeConfig?.name || step.nodeType}</p>
            <p className="text-xs text-muted-foreground capitalize">{step.type} Settings</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Config Fields */}
        <div className="flex-1 p-4 space-y-4">
          <ConfigFields
            nodeType={step.nodeType}
            stepType={step.type}
            config={localConfig}
            onChange={updateField}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button variant="hero" size="sm" className="w-full" onClick={handleSave}>
            <Save className="w-3.5 h-3.5 mr-2" />
            Apply Settings
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/** Renders the correct form fields based on node type */
const ConfigFields = ({
  nodeType,
  stepType,
  config,
  onChange,
}: {
  nodeType: string;
  stepType: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) => {
  // ---- Trigger configs ----
  if (stepType === "trigger") {
    return <TriggerConfig nodeType={nodeType} config={config} onChange={onChange} />;
  }

  // ---- Delay configs ----
  if (stepType === "delay") {
    return <DelayConfig nodeType={nodeType} config={config} onChange={onChange} />;
  }

  // ---- Action configs ----
  if (stepType === "action") {
    return <ActionConfig nodeType={nodeType} config={config} onChange={onChange} />;
  }

  // ---- Condition configs ----
  if (stepType === "condition") {
    return <ConditionConfig nodeType={nodeType} config={config} onChange={onChange} />;
  }

  return (
    <div className="text-center py-6">
      <Settings className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">No configuration available</p>
    </div>
  );
};

/* ────────────────── Trigger Config ────────────────── */

const TriggerConfig = ({
  nodeType,
  config,
  onChange,
}: {
  nodeType: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) => {
  switch (nodeType) {
    case "email_opened":
    case "not_opened":
    case "no_reply":
      return (
        <div className="space-y-4">
          <FieldGroup label="Campaign">
            <Input
              placeholder="e.g., Welcome Series #1"
              value={(config.campaign_name as string) || ""}
              onChange={(e) => onChange("campaign_name", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Reference to the campaign this trigger monitors
            </p>
          </FieldGroup>
          {(nodeType === "not_opened" || nodeType === "no_reply") && (
            <FieldGroup label="Wait Period">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="3"
                  className="w-20"
                  value={(config.wait_value as string) || ""}
                  onChange={(e) => onChange("wait_value", e.target.value)}
                />
                <Select
                  value={(config.wait_unit as string) || "days"}
                  onValueChange={(v) => onChange("wait_unit", v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FieldGroup>
          )}
        </div>
      );

    case "link_clicked":
      return (
        <div className="space-y-4">
          <FieldGroup label="Link URL (contains)">
            <Input
              placeholder="e.g., /upgrade or https://..."
              value={(config.link_url as string) || ""}
              onChange={(e) => onChange("link_url", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Campaign (optional)">
            <Input
              placeholder="Any campaign"
              value={(config.campaign_name as string) || ""}
              onChange={(e) => onChange("campaign_name", e.target.value)}
            />
          </FieldGroup>
        </div>
      );

    case "new_subscriber":
      return (
        <FieldGroup label="Source List (optional)">
          <Input
            placeholder="e.g., Newsletter, Product Updates"
            value={(config.source_list as string) || ""}
            onChange={(e) => onChange("source_list", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Leave empty to trigger for any new subscriber
          </p>
        </FieldGroup>
      );

    case "scheduled":
      return (
        <div className="space-y-4">
          <FieldGroup label="Schedule Type">
            <Select
              value={(config.schedule_type as string) || "once"}
              onValueChange={(v) => onChange("schedule_type", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One-time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Time">
            <Input
              type="time"
              value={(config.time as string) || "09:00"}
              onChange={(e) => onChange("time", e.target.value)}
            />
          </FieldGroup>
        </div>
      );

    case "inactive":
      return (
        <FieldGroup label="Inactive For">
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              placeholder="30"
              className="w-20"
              value={(config.inactive_days as string) || ""}
              onChange={(e) => onChange("inactive_days", e.target.value)}
            />
            <Select
              value={(config.inactive_unit as string) || "days"}
              onValueChange={(v) => onChange("inactive_unit", v)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
                <SelectItem value="months">Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FieldGroup>
      );

    case "bounced":
      return (
        <FieldGroup label="Bounce Type">
          <Select
            value={(config.bounce_type as string) || "any"}
            onValueChange={(v) => onChange("bounce_type", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Bounce</SelectItem>
              <SelectItem value="hard">Hard Bounce</SelectItem>
              <SelectItem value="soft">Soft Bounce</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      );

    default:
      return <NoConfig />;
  }
};

/* ────────────────── Delay Config ────────────────── */

const DelayConfig = ({
  nodeType,
  config,
  onChange,
}: {
  nodeType: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) => {
  if (nodeType === "wait_custom") {
    return (
      <div className="space-y-4">
        <FieldGroup label="Duration">
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              placeholder="1"
              className="w-20"
              value={(config.delay_value as string) || ""}
              onChange={(e) => onChange("delay_value", e.target.value)}
            />
            <Select
              value={(config.delay_unit as string) || "hours"}
              onValueChange={(v) => onChange("delay_unit", v)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FieldGroup>
        <FieldGroup label="Note (optional)">
          <Input
            placeholder="e.g., Wait for engagement window"
            value={(config.note as string) || ""}
            onChange={(e) => onChange("note", e.target.value)}
          />
        </FieldGroup>
      </div>
    );
  }

  // Preset delays – show read-only info + optional note
  const presetMap: Record<string, string> = {
    wait_1h: "1 Hour",
    wait_1d: "1 Day",
    wait_3d: "3 Days",
    wait_1w: "1 Week",
  };

  return (
    <div className="space-y-4">
      <FieldGroup label="Duration">
        <div className="px-3 py-2 rounded-md bg-secondary text-sm text-foreground">
          {presetMap[nodeType] || nodeType}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Use "Custom Delay" for other durations
        </p>
      </FieldGroup>
      <FieldGroup label="Note (optional)">
        <Input
          placeholder="e.g., Cool-down before next email"
          value={(config.note as string) || ""}
          onChange={(e) => onChange("note", e.target.value)}
        />
      </FieldGroup>
    </div>
  );
};

/* ────────────────── Action Config ────────────────── */

const ActionConfig = ({
  nodeType,
  config,
  onChange,
}: {
  nodeType: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) => {
  switch (nodeType) {
    case "send_email":
    case "send_reengagement":
      return (
        <div className="space-y-4">
          <FieldGroup label="Email Template">
            <Input
              placeholder="e.g., Welcome Email v2"
              value={(config.template_name as string) || ""}
              onChange={(e) => onChange("template_name", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Subject Line">
            <Input
              placeholder="e.g., {{first_name}}, check this out!"
              value={(config.subject as string) || ""}
              onChange={(e) => onChange("subject", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Supports merge tags like {"{{first_name}}"}
            </p>
          </FieldGroup>
          <FieldGroup label="Sender Name (optional)">
            <Input
              placeholder="e.g., Sarah from Acme"
              value={(config.sender_name as string) || ""}
              onChange={(e) => onChange("sender_name", e.target.value)}
            />
          </FieldGroup>
        </div>
      );

    case "add_tag":
      return (
        <div className="space-y-4">
          <FieldGroup label="Tag Name">
            <Input
              placeholder="e.g., engaged, premium, churned"
              value={(config.tag_name as string) || ""}
              onChange={(e) => onChange("tag_name", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Tag Color (optional)">
            <Select
              value={(config.tag_color as string) || "default"}
              onValueChange={(v) => onChange("tag_color", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="emerald">Green</SelectItem>
                <SelectItem value="amber">Yellow</SelectItem>
                <SelectItem value="red">Red</SelectItem>
                <SelectItem value="blue">Blue</SelectItem>
                <SelectItem value="violet">Purple</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
      );

    case "move_list":
      return (
        <FieldGroup label="Destination List">
          <Input
            placeholder="e.g., Engaged Subscribers"
            value={(config.list_name as string) || ""}
            onChange={(e) => onChange("list_name", e.target.value)}
          />
        </FieldGroup>
      );

    case "notify":
      return (
        <div className="space-y-4">
          <FieldGroup label="Notification Channel">
            <Select
              value={(config.channel as string) || "email"}
              onValueChange={(v) => onChange("channel", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="in_app">In-App</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Message">
            <Textarea
              placeholder="Notification message..."
              className="resize-none h-20 text-sm"
              value={(config.message as string) || ""}
              onChange={(e) => onChange("message", e.target.value)}
            />
          </FieldGroup>
        </div>
      );

    case "webhook":
      return (
        <div className="space-y-4">
          <FieldGroup label="Webhook URL">
            <Input
              placeholder="https://api.example.com/webhook"
              value={(config.webhook_url as string) || ""}
              onChange={(e) => onChange("webhook_url", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="HTTP Method">
            <Select
              value={(config.http_method as string) || "POST"}
              onValueChange={(v) => onChange("http_method", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Payload (JSON, optional)">
            <Textarea
              placeholder='{"event": "automation_triggered"}'
              className="resize-none h-20 text-sm font-mono"
              value={(config.payload as string) || ""}
              onChange={(e) => onChange("payload", e.target.value)}
            />
          </FieldGroup>
        </div>
      );

    case "mark_churned":
      return (
        <FieldGroup label="Churn Reason (optional)">
          <Input
            placeholder="e.g., No engagement after re-engagement"
            value={(config.churn_reason as string) || ""}
            onChange={(e) => onChange("churn_reason", e.target.value)}
          />
        </FieldGroup>
      );

    default:
      return <NoConfig />;
  }
};

/* ────────────────── Condition Config ────────────────── */

const ConditionConfig = ({
  nodeType,
  config,
  onChange,
}: {
  nodeType: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) => {
  switch (nodeType) {
    case "if_opened":
      return (
        <div className="space-y-4">
          <FieldGroup label="Check Campaign">
            <Input
              placeholder="e.g., Welcome Email"
              value={(config.campaign_name as string) || ""}
              onChange={(e) => onChange("campaign_name", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Within">
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                placeholder="3"
                className="w-20"
                value={(config.within_value as string) || ""}
                onChange={(e) => onChange("within_value", e.target.value)}
              />
              <Select
                value={(config.within_unit as string) || "days"}
                onValueChange={(v) => onChange("within_unit", v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldGroup>
        </div>
      );

    case "if_clicked":
      return (
        <div className="space-y-4">
          <FieldGroup label="Link URL (contains)">
            <Input
              placeholder="e.g., /pricing"
              value={(config.link_url as string) || ""}
              onChange={(e) => onChange("link_url", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Within">
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                placeholder="3"
                className="w-20"
                value={(config.within_value as string) || ""}
                onChange={(e) => onChange("within_value", e.target.value)}
              />
              <Select
                value={(config.within_unit as string) || "days"}
                onValueChange={(v) => onChange("within_unit", v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldGroup>
        </div>
      );

    case "if_tag":
      return (
        <FieldGroup label="Tag Name">
          <Input
            placeholder="e.g., premium, active"
            value={(config.tag_name as string) || ""}
            onChange={(e) => onChange("tag_name", e.target.value)}
          />
        </FieldGroup>
      );

    default:
      return <NoConfig />;
  }
};

/* ────────────────── Shared helpers ────────────────── */

const FieldGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

const NoConfig = () => (
  <div className="text-center py-6">
    <Settings className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
    <p className="text-sm text-muted-foreground">No additional configuration needed</p>
  </div>
);
