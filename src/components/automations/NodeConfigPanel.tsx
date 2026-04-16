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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
          {(config.schedule_type === "once") && (
            <FieldGroup label="Date">
              <Input
                type="date"
                value={(config.date as string) || ""}
                onChange={(e) => onChange("date", e.target.value)}
              />
            </FieldGroup>
          )}
          {(config.schedule_type === "weekly") && (
            <FieldGroup label="Day of Week">
              <Select
                value={(config.day_of_week as string) || "monday"}
                onValueChange={(v) => onChange("day_of_week", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="tuesday">Tuesday</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
          )}
          <FieldGroup label="Time">
            <Input
              type="time"
              value={(config.time as string) || "09:00"}
              onChange={(e) => onChange("time", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Timezone">
            <Select
              value={(config.timezone as string) || "UTC"}
              onValueChange={(v) => onChange("timezone", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern (US)</SelectItem>
                <SelectItem value="America/Chicago">Central (US)</SelectItem>
                <SelectItem value="America/Denver">Mountain (US)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific (US)</SelectItem>
                <SelectItem value="Europe/London">London (GMT)</SelectItem>
                <SelectItem value="Europe/Paris">Central Europe</SelectItem>
                <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
              </SelectContent>
            </Select>
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

/* ────────────────── Send Email Config ────────────────── */

const SendEmailConfig = ({
  config,
  onChange,
  nodeType,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  nodeType: string;
}) => {
  const { user } = useAuth();
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-automation", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("campaigns").select("id, name, subject, status").eq("user_id", user.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });
  const { data: senderDomains } = useQuery({
    queryKey: ["sender-domains-for-automation", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("sender_domains").select("id, from_email, from_name, domain_name, is_verified").eq("user_id", user.id).order("display_order");
      return data || [];
    },
    enabled: !!user,
  });
  return (
    <div className="space-y-4">
      <FieldGroup label="Campaign to Send">
        <Select value={(config.campaign_id as string) || "custom"} onValueChange={(v) => onChange("campaign_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select a campaign" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">✏️ Custom Email</SelectItem>
            {campaigns?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.status === "sent" ? "bg-emerald-500" : c.status === "draft" ? "bg-amber-500" : "bg-muted-foreground")} />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campaigns && campaigns.length === 0 && <p className="text-[11px] text-amber-500 mt-1">No campaigns found. Create one first or use custom email.</p>}
      </FieldGroup>
      {(!config.campaign_id || config.campaign_id === "custom") && (
        <>
          <FieldGroup label="Email Template">
            <Input placeholder="e.g., Welcome Email v2" value={(config.template_name as string) || ""} onChange={(e) => onChange("template_name", e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Subject Line">
            <Input placeholder="e.g., {{first_name}}, check this out!" value={(config.subject as string) || ""} onChange={(e) => onChange("subject", e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">Supports merge tags like {"{{first_name}}"}</p>
          </FieldGroup>
        </>
      )}
      <FieldGroup label="Send From">
        <Select value={(config.sender_domain_id as string) || "default"} onValueChange={(v) => onChange("sender_domain_id", v)}>
          <SelectTrigger><SelectValue placeholder="Select sender" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default Sender</SelectItem>
            {senderDomains?.map((d) => (<SelectItem key={d.id} value={d.id}>{d.is_verified ? "✓" : "⚠️"} {d.from_name} &lt;{d.from_email}&gt;</SelectItem>))}
          </SelectContent>
        </Select>
      </FieldGroup>
      <FieldGroup label="Sender Name (override)">
        <Input placeholder="e.g., Sarah from Acme" value={(config.sender_name as string) || ""} onChange={(e) => onChange("sender_name", e.target.value)} />
      </FieldGroup>
      <div className="pt-2 border-t border-border/50">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs font-semibold">Schedule Send Time</Label>
          <Switch checked={(config.schedule_enabled as boolean) || false} onCheckedChange={(v) => onChange("schedule_enabled", v)} />
        </div>
        {config.schedule_enabled && (
          <div className="space-y-3">
            <FieldGroup label="Send At">
              <Select value={(config.send_timing as string) || "immediate"} onValueChange={(v) => onChange("send_timing", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediately after trigger</SelectItem>
                  <SelectItem value="specific_time">At specific time</SelectItem>
                  <SelectItem value="business_hours">During business hours</SelectItem>
                  <SelectItem value="optimal">Optimal send time</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            {config.send_timing === "specific_time" && (
              <>
                <FieldGroup label="Time">
                  <Input type="time" value={(config.send_time as string) || "09:00"} onChange={(e) => onChange("send_time", e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Timezone">
                  <Select value={(config.send_timezone as string) || "UTC"} onValueChange={(v) => onChange("send_timezone", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="recipient">Recipient's timezone</SelectItem>
                      <SelectItem value="America/New_York">Eastern (US)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific (US)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
              </>
            )}
            {config.send_timing === "business_hours" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <FieldGroup label="From"><Input type="time" value={(config.bh_start as string) || "09:00"} onChange={(e) => onChange("bh_start", e.target.value)} className="text-xs" /></FieldGroup>
                  <FieldGroup label="To"><Input type="time" value={(config.bh_end as string) || "17:00"} onChange={(e) => onChange("bh_end", e.target.value)} className="text-xs" /></FieldGroup>
                </div>
                <p className="text-[11px] text-muted-foreground">Emails outside these hours are queued for the next window</p>
              </div>
            )}
            {config.send_timing === "optimal" && (
              <p className="text-[11px] text-muted-foreground bg-primary/5 rounded-md p-2 border border-primary/10">📊 Sent at optimal time per recipient based on engagement history</p>
            )}
          </div>
        )}
      </div>
      {nodeType === "send_reengagement" && (
        <div className="pt-2 border-t border-border/50 space-y-3">
          <FieldGroup label="Max per Batch">
            <Select value={(config.batch_size as string) || "50"} onValueChange={(v) => onChange("batch_size", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
      )}
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
        <SendEmailConfig config={config} onChange={onChange} nodeType={nodeType} />
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
