import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Key,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ApiKey {
  id: string;
  user_id: string;
  provider: string;
  api_key: string;
  label: string;
  priority: number;
  is_active: boolean;
  daily_limit: number | null;
  emails_sent_today: number;
  last_error: string | null;
  last_used_at: string | null;
}

export const ApiKeysManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState({
    label: "",
    provider: "resend",
    api_key: "",
    daily_limit: "",
    endpoint_url: "",
  });

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["api_keys", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", user.id)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as ApiKey[];
    },
    enabled: !!user?.id,
  });

  const addKeyMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user");
      const nextPriority = (apiKeys?.length || 0) + 1;
      const { error } = await supabase.from("api_keys").insert({
        user_id: user.id,
        label: newKey.label || `Key ${nextPriority}`,
        provider: newKey.provider,
        api_key: newKey.api_key,
        priority: nextPriority,
        daily_limit: newKey.daily_limit ? parseInt(newKey.daily_limit) : null,
        endpoint_url: newKey.provider === "custom" ? newKey.endpoint_url || null : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api_keys"] });
      setShowDialog(false);
      setNewKey({ label: "", provider: "resend", api_key: "", daily_limit: "", endpoint_url: "" });
      toast({ title: "API key added" });
    },
    onError: (error) => {
      toast({ title: "Error adding API key", description: error.message, variant: "destructive" });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api_keys"] });
      toast({ title: "API key removed" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("api_keys").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api_keys"] });
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      if (!apiKeys) return;
      const idx = apiKeys.findIndex((k) => k.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= apiKeys.length) return;

      const updates = [
        { id: apiKeys[idx].id, priority: apiKeys[swapIdx].priority },
        { id: apiKeys[swapIdx].id, priority: apiKeys[idx].priority },
      ];

      for (const u of updates) {
        const { error } = await supabase.from("api_keys").update({ priority: u.priority }).eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api_keys"] });
    },
  });

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <h4 className="font-medium">API Keys</h4>
          <Badge variant="secondary">{apiKeys?.length || 0} keys</Badge>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add API Key</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  placeholder="e.g. Primary, Backup, High Volume"
                  value={newKey.label}
                  onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={newKey.provider} onValueChange={(v) => setNewKey({ ...newKey, provider: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="mailgun">Mailgun</SelectItem>
                    <SelectItem value="ses">Amazon SES</SelectItem>
                    <SelectItem value="postmark">Postmark</SelectItem>
                    <SelectItem value="sparkpost">SparkPost</SelectItem>
                    <SelectItem value="mandrill">Mandrill (Mailchimp)</SelectItem>
                    <SelectItem value="sendinblue">Brevo (Sendinblue)</SelectItem>
                    <SelectItem value="elastic_email">Elastic Email</SelectItem>
                    <SelectItem value="smtp2go">SMTP2GO</SelectItem>
                    <SelectItem value="socketlabs">SocketLabs</SelectItem>
                    <SelectItem value="pepipost">Pepipost</SelectItem>
                    <SelectItem value="mailjet">Mailjet</SelectItem>
                    <SelectItem value="custom">Custom / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newKey.provider === "custom" && (
                <div className="space-y-2">
                  <Label>API Endpoint URL</Label>
                  <Input
                    placeholder="https://api.yourprovider.com/v1/send"
                    value={newKey.endpoint_url}
                    onChange={(e) => setNewKey({ ...newKey, endpoint_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The endpoint URL where email send requests will be posted
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Enter API key"
                  value={newKey.api_key}
                  onChange={(e) => setNewKey({ ...newKey, api_key: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Daily Limit (optional)</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={newKey.daily_limit}
                  onChange={(e) => setNewKey({ ...newKey, daily_limit: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited. Failover to next key when limit is reached.
                </p>
              </div>
              <Button
                onClick={() => addKeyMutation.mutate()}
                disabled={!newKey.api_key || addKeyMutation.isPending}
                className="w-full gap-2"
              >
                {addKeyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Add API Key
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!apiKeys || apiKeys.length === 0) ? (
        <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 text-center">
          <p className="text-sm text-muted-foreground">No API keys configured. Add your first key to start sending.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map((key, idx) => (
            <div
              key={key.id}
              className={`p-4 rounded-lg border transition-all ${
                key.is_active
                  ? "border-border bg-secondary/30"
                  : "border-border bg-muted/30 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => updatePriorityMutation.mutate({ id: key.id, direction: "up" })}
                      disabled={idx === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => updatePriorityMutation.mutate({ id: key.id, direction: "down" })}
                      disabled={idx === apiKeys.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <Badge variant="outline" className="font-mono shrink-0">
                    #{key.priority}
                  </Badge>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{key.label}</span>
                      <Badge variant="secondary" className="text-xs">{key.provider}</Badge>
                      {key.is_active ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-muted-foreground">
                        {visibleKeys.has(key.id) ? key.api_key : maskKey(key.api_key)}
                      </code>
                      <button onClick={() => toggleVisibility(key.id)} className="text-muted-foreground hover:text-foreground">
                        {visibleKeys.has(key.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        Sent today: {key.emails_sent_today}
                        {key.daily_limit ? ` / ${key.daily_limit}` : " (unlimited)"}
                      </span>
                      {key.last_error && (
                        <span className="text-destructive truncate max-w-[200px]">Error: {key.last_error}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={key.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: key.id, is_active: checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteKeyMutation.mutate(key.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Keys are used in priority order. When a key hits its daily limit or fails, the next active key takes over automatically.
      </p>
    </div>
  );
};
