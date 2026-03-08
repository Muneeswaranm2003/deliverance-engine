import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
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
  Globe,
  Star,
  Shield,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WarmupDay {
  day: number;
  limit: number;
}

interface IpPool {
  id: string;
  user_id: string;
  pool_name: string;
  description: string | null;
  ips: string[];
  is_default: boolean;
  warmup_enabled: boolean;
  warmup_phase: number;
  warmup_daily_limit: number;
  warmup_start_date: string | null;
  warmup_schedule: WarmupDay[];
  reputation_score: number;
  last_reputation_check: string | null;
  blacklist_status: string;
  total_sent: number;
  total_bounced: number;
  total_complaints: number;
  bounce_rate: number;
  complaint_rate: number;
  is_active: boolean;
}

export const IpPoolsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [newPool, setNewPool] = useState({
    pool_name: "",
    description: "",
    ips: "",
  });

  const { data: ipPools, isLoading } = useQuery({
    queryKey: ["ip_pools", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("ip_pools")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        ips: p.ips || [],
        warmup_schedule: p.warmup_schedule || [],
      })) as IpPool[];
    },
    enabled: !!user?.id,
  });

  const addPoolMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user");
      const ipsArray = newPool.ips
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);
      const { error } = await supabase.from("ip_pools").insert({
        user_id: user.id,
        pool_name: newPool.pool_name,
        description: newPool.description || null,
        ips: ipsArray,
        is_default: !ipPools || ipPools.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip_pools"] });
      setShowDialog(false);
      setNewPool({ pool_name: "", description: "", ips: "" });
      toast({ title: "IP pool created" });
    },
    onError: (error) => {
      toast({ title: "Error creating pool", description: error.message, variant: "destructive" });
    },
  });

  const deletePoolMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ip_pools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip_pools"] });
      toast({ title: "IP pool removed" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) return;
      // Unset all defaults
      await supabase.from("ip_pools").update({ is_default: false }).eq("user_id", user.id);
      const { error } = await supabase.from("ip_pools").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip_pools"] });
      toast({ title: "Default pool updated" });
    },
  });

  const toggleWarmupMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const updates: any = { warmup_enabled: enabled };
      if (enabled) {
        updates.warmup_start_date = new Date().toISOString().split("T")[0];
        updates.warmup_phase = 1;
      }
      const { error } = await supabase.from("ip_pools").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip_pools"] });
    },
  });

  const getReputationColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-destructive";
  };

  const getBlacklistBadge = (status: string) => {
    if (status === "clean") {
      return (
        <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle className="w-3 h-3" />
          Clean
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="w-3 h-3" />
        {status}
      </Badge>
    );
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
          <Globe className="w-4 h-4 text-primary" />
          <h4 className="font-medium">IP Pools</h4>
          <Badge variant="secondary">{ipPools?.length || 0} pools</Badge>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add Pool
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create IP Pool</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pool Name</Label>
                <Input
                  placeholder="e.g. Transactional, Marketing, Warmup"
                  value={newPool.pool_name}
                  onChange={(e) => setNewPool({ ...newPool, pool_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Optional description"
                  value={newPool.description}
                  onChange={(e) => setNewPool({ ...newPool, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>IP Addresses</Label>
                <Input
                  placeholder="192.168.1.1, 192.168.1.2"
                  value={newPool.ips}
                  onChange={(e) => setNewPool({ ...newPool, ips: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Comma-separated list of dedicated IPs</p>
              </div>
              <Button
                onClick={() => addPoolMutation.mutate()}
                disabled={!newPool.pool_name || addPoolMutation.isPending}
                className="w-full gap-2"
              >
                {addPoolMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Pool
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!ipPools || ipPools.length === 0) ? (
        <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 text-center">
          <p className="text-sm text-muted-foreground">No IP pools configured. Create a pool to manage dedicated IPs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ipPools.map((pool) => (
            <div key={pool.id} className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
              {/* Pool Header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pool.pool_name}</span>
                    {pool.is_default && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="w-3 h-3" />
                        Default
                      </Badge>
                    )}
                    {getBlacklistBadge(pool.blacklist_status)}
                  </div>
                  <div className="flex items-center gap-2">
                    {!pool.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(pool.id)}
                        className="text-xs"
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deletePoolMutation.mutate(pool.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {pool.description && (
                  <p className="text-sm text-muted-foreground mt-1">{pool.description}</p>
                )}
                {pool.ips.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pool.ips.map((ip, i) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">
                        {ip}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Reputation & Stats */}
              <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-1 mb-1">
                    <Shield className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Reputation</span>
                  </div>
                  <span className={`text-lg font-bold ${getReputationColor(pool.reputation_score)}`}>
                    {pool.reputation_score}
                  </span>
                  <Progress value={pool.reputation_score} className="mt-1 h-1" />
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Sent</span>
                  </div>
                  <span className="text-lg font-bold">{pool.total_sent.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-xs text-muted-foreground">Bounce Rate</span>
                  <div className={`text-lg font-bold ${pool.bounce_rate > 5 ? "text-destructive" : ""}`}>
                    {pool.bounce_rate}%
                  </div>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-xs text-muted-foreground">Complaint Rate</span>
                  <div className={`text-lg font-bold ${pool.complaint_rate > 0.1 ? "text-destructive" : ""}`}>
                    {pool.complaint_rate}%
                  </div>
                </div>
              </div>

              {/* Warmup Section */}
              <div className="px-4 pb-4 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">IP Warmup</span>
                    {pool.warmup_enabled && (
                      <Badge variant="secondary" className="text-xs">
                        Phase {pool.warmup_phase} · {pool.warmup_daily_limit}/day
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={pool.warmup_enabled}
                    onCheckedChange={(checked) =>
                      toggleWarmupMutation.mutate({ id: pool.id, enabled: checked })
                    }
                  />
                </div>
                {pool.warmup_enabled && pool.warmup_schedule.length > 0 && (
                  <div className="mt-3 grid grid-cols-7 gap-1">
                    {pool.warmup_schedule.map((day: WarmupDay) => (
                      <div
                        key={day.day}
                        className={`text-center p-1.5 rounded text-xs ${
                          pool.warmup_phase >= day.day
                            ? "bg-primary/20 text-primary font-medium"
                            : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <div className="font-mono">D{day.day}</div>
                        <div>{day.limit}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
