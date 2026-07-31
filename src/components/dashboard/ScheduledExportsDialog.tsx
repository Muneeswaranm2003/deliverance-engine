import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, Plus, Send, Trash2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

const describe = (s: Schedule) => {
  const time = `${String(s.hour_utc).padStart(2, "0")}:00 UTC`;
  if (s.frequency === "daily") return `Daily at ${time}`;
  if (s.frequency === "weekly") return `Every ${DAYS[s.day_of_week]} at ${time}`;
  return `Monthly on day ${s.day_of_month} at ${time}`;
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
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/50 p-3"
              >
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
            <p className="text-xs text-muted-foreground">
              Range preset: <span className="text-foreground font-medium">{range.label}</span> —
              each report covers the last {range.days} day{range.days === 1 ? "" : "s"} at send time.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
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