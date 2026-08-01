import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, Plus, Send, Trash2, Loader2, AlertCircle, AlertTriangle, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import type { AnalyticsRange } from "./DateRangeFilter";

type Schedule = Tables<"analytics_export_schedules">;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Tokens usable in subject / message templates. */
const TOKENS = ["{{name}}", "{{range}}", "{{from}}", "{{to}}", "{{campaigns}}", "{{contacts}}", "{{emails_sent}}", "{{open_rate}}"];
const defaultSubject = "{{name}} — {{range}} analytics";

const KNOWN_TOKENS = TOKENS.map((t) => t.replace(/[{}\s]/g, ""));
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 2000;

export type ValidationSeverity = "strict" | "lenient";
const SEVERITY_KEY = "analytics-export-validation-severity";

/**
 * Validates template strings.
 * In "strict" mode unknown tokens and brace issues block saving; in "lenient"
 * mode they are surfaced as warnings only. Length limits always block.
 */
const validateTemplates = (subject: string, message: string, severity: ValidationSeverity = "strict") => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const flag = (msg: string) => (severity === "strict" ? errors : warnings).push(msg);

  if (subject.length > MAX_SUBJECT) errors.push(`Subject must be under ${MAX_SUBJECT} characters.`);
  if (message.length > MAX_MESSAGE) errors.push(`Message must be under ${MAX_MESSAGE} characters.`);

  const check = (value: string, field: string) => {
    if (!value.trim()) return;
    // Unbalanced braces / malformed placeholders
    const opens = (value.match(/\{\{/g) || []).length;
    const closes = (value.match(/\}\}/g) || []).length;
    if (opens !== closes) flag(`${field}: unbalanced {{ }} braces.`);

    const used = [...value.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map((m) => m[1]);
    const unknown = [...new Set(used.filter((t) => !KNOWN_TOKENS.includes(t)))];
    if (unknown.length) {
      flag(
        `${field}: unknown token${unknown.length > 1 ? "s" : ""} ${unknown
          .map((t) => `{{${t}}}`)
          .join(", ")}. Available: ${TOKENS.join(" ")}`,
      );
    }
    // Single-brace placeholders won't be replaced
    if (/(^|[^{])\{[^{}]+\}([^}]|$)/.test(value)) {
      warnings.push(`${field}: single braces are not replaced — use {{token}}.`);
    }
    if (used.length === 0) {
      warnings.push(`${field}: no tokens used, the same text is sent every time.`);
    }
  };

  check(subject, "Subject");
  check(message, "Message");
  return { errors, warnings };
};

const TemplateIssues = ({ errors, warnings }: { errors: string[]; warnings: string[] }) => {
  if (!errors.length && !warnings.length) return null;
  return (
    <div className="space-y-1">
      {errors.map((e) => (
        <p key={e} className="text-[11px] text-destructive flex items-start gap-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {e}
        </p>
      ))}
      {warnings.map((w) => (
        <p key={w} className="text-[11px] text-amber-500 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          {w}
        </p>
      ))}
    </div>
  );
};

const describe = (s: Schedule) => {
  const time = `${String(s.hour_utc).padStart(2, "0")}:00 UTC`;
  if (s.frequency === "daily") return `Daily at ${time}`;
  if (s.frequency === "weekly") return `Every ${DAYS[s.day_of_week]} at ${time}`;
  return `Monthly on day ${s.day_of_month} at ${time}`;
};

const nextRunAt = (
  frequency: "daily" | "weekly" | "monthly",
  hourUtc: number,
  dow: number,
  dom: number,
) => {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hourUtc);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  if (frequency === "weekly") {
    while (next.getUTCDay() !== dow) next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === "monthly") {
    while (next.getUTCDate() !== dom) next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
};

interface Props {
  range: AnalyticsRange;
}

export const ScheduledExportsDialog = ({ range }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [recipients, setRecipients] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [hour, setHour] = useState("8");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [severity, setSeverity] = useState<ValidationSeverity>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(SEVERITY_KEY) : null;
    return stored === "lenient" ? "lenient" : "strict";
  });

  const changeSeverity = (v: ValidationSeverity) => {
    setSeverity(v);
    localStorage.setItem(SEVERITY_KEY, v);
  };

  const createIssues = validateTemplates(subjectTemplate, messageTemplate, severity);
  const editIssues = validateTemplates(editSubject, editMessage, severity);

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["analytics-export-schedules"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_export_schedules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Schedule[];
    },
  });

  const resetForm = () => {
    setName("");
    setRecipients(user?.email ?? "");
    setFrequency("weekly");
    setHour("8");
    setDayOfWeek("1");
    setDayOfMonth("1");
    setSubjectTemplate("");
    setMessageTemplate("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const emails = recipients
        .split(/[,\s;]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      if (!name.trim()) throw new Error("Give the schedule a name.");
      if (emails.length === 0) throw new Error("Add at least one recipient email.");
      const invalid = emails.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (invalid) throw new Error(`"${invalid}" is not a valid email address.`);
      if (!user) throw new Error("You must be signed in.");

      const { errors } = validateTemplates(subjectTemplate, messageTemplate, severity);
      if (errors.length) throw new Error(errors.join(" "));

      const { error } = await supabase.from("analytics_export_schedules").insert({
        user_id: user.id,
        name: name.trim(),
        recipients: emails,
        frequency,
        hour_utc: Number(hour),
        day_of_week: Number(dayOfWeek),
        day_of_month: Number(dayOfMonth),
        range_days: range.days,
        range_label: range.label,
        subject_template: subjectTemplate.trim() || null,
        message_template: messageTemplate.trim() || null,
        next_run_at: nextRunAt(frequency, Number(hour), Number(dayOfWeek), Number(dayOfMonth)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Schedule created", description: "Your recurring export is active." });
      qc.invalidateQueries({ queryKey: ["analytics-export-schedules"] });
      setCreating(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("analytics_export_schedules")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics-export-schedules"] }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, subject, message }: { id: string; subject: string; message: string }) => {
      const { errors } = validateTemplates(subject, message, severity);
      if (errors.length) throw new Error(errors.join(" "));
      const { error } = await supabase
        .from("analytics_export_schedules")
        .update({
          subject_template: subject.trim() || null,
          message_template: message.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Template saved" });
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["analytics-export-schedules"] });
    },
    onError: (e: Error) =>
      toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("analytics_export_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Schedule removed" });
      qc.invalidateQueries({ queryKey: ["analytics-export-schedules"] });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("process-analytics-exports", {
        body: { schedule_id: id },
      });
      if (error) throw new Error(error.message);
      if (data && (data as { success?: boolean }).success === false) {
        throw new Error((data as { error?: string }).error || "Send failed");
      }
    },
    onSuccess: () => {
      toast({ title: "Report sent", description: "Check your inbox in a moment." });
      qc.invalidateQueries({ queryKey: ["analytics-export-schedules"] });
    },
    onError: (e: Error) =>
      toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetForm();
        else setCreating(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarClock className="w-4 h-4" />
          Schedule Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scheduled analytics exports</DialogTitle>
          <DialogDescription>
            Email recurring dashboard reports to yourself or your team. New schedules use the
            currently selected range ({range.label}).
          </DialogDescription>
        </DialogHeader>

        {/* Existing schedules */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (schedules?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No scheduled exports yet.
            </p>
          ) : (
            schedules!.map((s) => (
              <div key={s.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{s.name}</p>
                    <Badge variant="secondary" className="text-[10px]">{s.range_label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {describe(s)} · {s.recipients.join(", ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    {s.last_run_at
                      ? `Last sent ${format(new Date(s.last_run_at), "MMM d, HH:mm")}`
                      : "Not sent yet"}
                    {" · "}
                    Next {format(new Date(s.next_run_at), "MMM d, HH:mm")}
                  </p>
                  {s.last_error && (
                    <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {s.last_error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={(enabled) => toggleMutation.mutate({ id: s.id, enabled })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Edit email template"
                    onClick={() => {
                      const next = editingId === s.id ? null : s.id;
                      setEditingId(next);
                      setEditSubject(s.subject_template ?? "");
                      setEditMessage(s.message_template ?? "");
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Send now"
                    disabled={sendNowMutation.isPending}
                    onClick={() => sendNowMutation.mutate(s.id)}
                  >
                    {sendNowMutation.isPending && sendNowMutation.variables === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    onClick={() => deleteMutation.mutate(s.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {editingId === s.id && (
                <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email subject</Label>
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder={defaultSubject}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Intro message</Label>
                    <Textarea
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      placeholder={`Analytics for the last {{range}}`}
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tokens: {TOKENS.join(" ")}
                  </p>
                  <TemplateIssues errors={editIssues.errors} warnings={editIssues.warnings} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={updateTemplateMutation.isPending || editIssues.errors.length > 0}
                      onClick={() =>
                        updateTemplateMutation.mutate({ id: s.id, subject: editSubject, message: editMessage })
                      }
                    >
                      Save template
                    </Button>
                  </div>
                </div>
              )}
              </div>
            ))
          )}
        </div>

        {/* Create form */}
        {creating ? (
          <div className="space-y-4 rounded-lg border border-border/60 p-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sched-name">Report name</Label>
                <Input
                  id="sched-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Weekly performance digest"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-recipients">Recipients</Label>
                <Input
                  id="sched-recipients"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="me@team.com, lead@team.com"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {frequency === "weekly" && (
                <div className="space-y-1.5">
                  <Label>Day</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {frequency === "monthly" && (
                <div className="space-y-1.5">
                  <Label>Day of month</Label>
                  <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Time (UTC)</Label>
                <Select value={hour} onValueChange={setHour}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-subject">Email subject (optional)</Label>
              <Input
                id="sched-subject"
                value={subjectTemplate}
                onChange={(e) => setSubjectTemplate(e.target.value)}
                placeholder={defaultSubject}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-message">Intro message (optional)</Label>
              <Textarea
                id="sched-message"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Here's your {{range}} performance summary."
                className="min-h-[80px] text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Tokens: {TOKENS.join(" ")}</p>
            </div>
            <TemplateIssues errors={createIssues.errors} warnings={createIssues.warnings} />
            <p className="text-xs text-muted-foreground">
              Range preset: <span className="text-foreground font-medium">{range.label}</span> —
              each report covers the last {range.days} day{range.days === 1 ? "" : "s"} at send time.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || createIssues.errors.length > 0}
                className="gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create schedule
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="gap-2 w-full" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" />
            New scheduled export ({range.label})
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};