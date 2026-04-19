import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Server,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Send,
  Lock,
} from "lucide-react";

interface SmtpServer {
  id: string;
  user_id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: "none" | "tls" | "ssl" | "starttls";
  from_email: string;
  from_name: string;
  priority: number;
  is_active: boolean;
  daily_limit: number | null;
  emails_sent_today: number;
  last_used_at: string | null;
  last_error: string | null;
}

const emptyForm = {
  label: "Primary SMTP",
  host: "",
  port: 587,
  username: "",
  password: "",
  encryption: "tls" as const,
  from_email: "",
  from_name: "",
  daily_limit: "" as string | number,
};

export const SmtpServersManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [form, setForm] = useState(emptyForm);
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["smtp_servers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smtp_servers")
        .select("*")
        .eq("user_id", user!.id)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as SmtpServer[];
    },
    enabled: !!user?.id,
  });

  const saveServer = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const payload = {
        user_id: user.id,
        label: form.label.trim() || "Primary SMTP",
        host: form.host.trim(),
        port: Number(form.port) || 587,
        username: form.username.trim(),
        password: form.password,
        encryption: form.encryption,
        from_email: form.from_email.trim(),
        from_name: form.from_name.trim(),
        daily_limit: form.daily_limit === "" ? null : Number(form.daily_limit),
      };
      if (editingId) {
        const { error } = await supabase
          .from("smtp_servers")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const nextPriority = (servers[servers.length - 1]?.priority ?? 0) + 1;
        const { error } = await supabase
          .from("smtp_servers")
          .insert({ ...payload, priority: nextPriority });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smtp_servers"] });
      toast({ title: editingId ? "SMTP server updated" : "SMTP server added" });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteServer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("smtp_servers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smtp_servers"] });
      toast({ title: "SMTP server removed" });
      setDeleteId(null);
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("smtp_servers")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["smtp_servers"] }),
  });

  const movePriority = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const idx = servers.findIndex((s) => s.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= servers.length) return;
      const a = servers[idx];
      const b = servers[swapIdx];
      await supabase.from("smtp_servers").update({ priority: b.priority }).eq("id", a.id);
      await supabase.from("smtp_servers").update({ priority: a.priority }).eq("id", b.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["smtp_servers"] }),
  });

  const handleTest = async (server: SmtpServer) => {
    if (!user?.email) return;
    setTestingId(server.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: user.email,
          subject: `SMTP test from ${server.label}`,
          html: `<p>This is a test email sent through your SMTP server <strong>${server.label}</strong> (${server.host}:${server.port}).</p>`,
          force_smtp_id: server.id,
        },
      });
      if (error) throw error;
      toast({
        title: "Test email sent",
        description: `Check ${user.email} — sent via ${server.host}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Test failed", description: msg, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const openEdit = (s: SmtpServer) => {
    setEditingId(s.id);
    setForm({
      label: s.label,
      host: s.host,
      port: s.port,
      username: s.username,
      password: s.password,
      encryption: s.encryption,
      from_email: s.from_email,
      from_name: s.from_name,
      daily_limit: s.daily_limit ?? "",
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const toggleVisible = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const maskPassword = (pw: string) =>
    pw.length <= 4 ? "••••" : `${"•".repeat(Math.min(pw.length - 2, 12))}${pw.slice(-2)}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold">Configured SMTP servers</h3>
          <p className="text-sm text-muted-foreground">
            Add SMTP relays as send fallbacks or to route specific traffic. Higher priority is tried first.
          </p>
        </div>
        <Button onClick={openCreate} variant="hero" className="gap-2">
          <Plus className="w-4 h-4" /> Add SMTP server
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Server className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No SMTP servers configured yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((s, i) => (
            <div
              key={s.id}
              className="glass rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"
            >
              <div className="flex flex-col gap-1 items-center justify-center w-12">
                <button
                  onClick={() => movePriority.mutate({ id: s.id, direction: "up" })}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono">{s.priority}</span>
                <button
                  onClick={() => movePriority.mutate({ id: s.id, direction: "down" })}
                  disabled={i === servers.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{s.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {s.encryption.toUpperCase()}
                  </Badge>
                  {!s.is_active && (
                    <Badge variant="secondary" className="text-xs">
                      Disabled
                    </Badge>
                  )}
                  {s.last_error && (
                    <Badge variant="destructive" className="text-xs">
                      Error
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-mono truncate">
                  {s.host}:{s.port} · {s.username}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  <code className="font-mono">
                    {visiblePasswords.has(s.id) ? s.password : maskPassword(s.password)}
                  </code>
                  <button
                    onClick={() => toggleVisible(s.id)}
                    className="hover:text-foreground"
                  >
                    {visiblePasswords.has(s.id) ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </button>
                  <span className="ml-2">
                    From: {s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}
                  </span>
                </div>
                {s.daily_limit && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Sent today: {s.emails_sent_today} / {s.daily_limit}
                  </p>
                )}
                {s.last_error && (
                  <p className="text-xs text-destructive mt-1 truncate">{s.last_error}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={s.is_active}
                  onCheckedChange={(checked) =>
                    toggleActive.mutate({ id: s.id, is_active: checked })
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTest(s)}
                  disabled={testingId === s.id}
                  className="gap-1"
                >
                  {testingId === s.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Test
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(s.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit SMTP server" : "Add SMTP server"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Primary SMTP, Backup relay"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Host</Label>
                <Input
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Encryption</Label>
              <Select
                value={form.encryption}
                onValueChange={(v: "none" | "tls" | "ssl" | "starttls") =>
                  setForm({ ...form, encryption: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls">TLS (port 587)</SelectItem>
                  <SelectItem value="ssl">SSL (port 465)</SelectItem>
                  <SelectItem value="starttls">STARTTLS</SelectItem>
                  <SelectItem value="none">None (plain)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From email</Label>
                <Input
                  type="email"
                  value={form.from_email}
                  onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                  placeholder="hello@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>From name</Label>
                <Input
                  value={form.from_name}
                  onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                  placeholder="Acme Team"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Daily limit (optional)</Label>
              <Input
                type="number"
                value={form.daily_limit}
                onChange={(e) => setForm({ ...form, daily_limit: e.target.value })}
                placeholder="No limit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveServer.mutate()}
              disabled={
                saveServer.isPending ||
                !form.host ||
                !form.username ||
                !form.password ||
                !form.from_email
              }
              className="gap-2"
            >
              {saveServer.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Save changes" : "Add server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this SMTP server?</AlertDialogTitle>
            <AlertDialogDescription>
              The server credentials will be permanently deleted. Any routing rules pointing
              to it will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteServer.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
