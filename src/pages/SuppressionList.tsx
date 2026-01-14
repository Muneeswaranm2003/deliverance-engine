import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Search,
  Ban,
  AlertTriangle,
  MessageSquareWarning,
  UserX,
  Hand
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SuppressionEntry {
  id: string;
  email: string;
  reason: string;
  bounce_type: string | null;
  complaint_type: string | null;
  notes: string | null;
  suppressed_at: string;
  source_campaign_id: string | null;
}

const reasonIcons: Record<string, React.ReactNode> = {
  hard_bounce: <Ban className="w-4 h-4" />,
  soft_bounce: <AlertTriangle className="w-4 h-4" />,
  complaint: <MessageSquareWarning className="w-4 h-4" />,
  unsubscribe: <UserX className="w-4 h-4" />,
  manual: <Hand className="w-4 h-4" />,
};

const reasonColors: Record<string, string> = {
  hard_bounce: "bg-red-500/10 text-red-500 border-red-500/20",
  soft_bounce: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  complaint: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  unsubscribe: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  manual: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const reasonLabels: Record<string, string> = {
  hard_bounce: "Hard Bounce",
  soft_bounce: "Soft Bounce",
  complaint: "Spam Complaint",
  unsubscribe: "Unsubscribed",
  manual: "Manual",
};

const SuppressionList = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterReason, setFilterReason] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    email: "",
    reason: "manual" as const,
    notes: "",
  });

  const { data: suppressionList, isLoading } = useQuery({
    queryKey: ["suppression_list", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("suppression_list")
        .select("*")
        .eq("user_id", user.id)
        .order("suppressed_at", { ascending: false });

      if (error) throw error;
      return data as SuppressionEntry[];
    },
    enabled: !!user?.id,
  });

  const addMutation = useMutation({
    mutationFn: async (entry: { email: string; reason: string; notes: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from("suppression_list").insert({
        user_id: user.id,
        email: entry.email.toLowerCase(),
        reason: entry.reason,
        notes: entry.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppression_list"] });
      setIsAddDialogOpen(false);
      setNewEntry({ email: "", reason: "manual", notes: "" });
      toast({ title: "Email added to suppression list" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to add email", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suppression_list")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppression_list"] });
      toast({ title: "Email removed from suppression list" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to remove email", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const filteredList = (suppressionList || []).filter((entry) => {
    const matchesSearch = entry.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesReason = filterReason === "all" || entry.reason === filterReason;
    return matchesSearch && matchesReason;
  });

  const stats = {
    total: suppressionList?.length || 0,
    hardBounces: suppressionList?.filter(e => e.reason === "hard_bounce").length || 0,
    complaints: suppressionList?.filter(e => e.reason === "complaint").length || 0,
    manual: suppressionList?.filter(e => e.reason === "manual").length || 0,
  };

  if (isLoading) {
    return (
      <AppLayout title="Suppression List" description="Manage suppressed email addresses">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Suppression List" description="Manage suppressed email addresses">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Ban className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Suppressed</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.hardBounces}</p>
                <p className="text-sm text-muted-foreground">Hard Bounces</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <MessageSquareWarning className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.complaints}</p>
                <p className="text-sm text-muted-foreground">Spam Complaints</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <Hand className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.manual}</p>
                <p className="text-sm text-muted-foreground">Manually Added</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters and Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-xl p-4"
        >
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterReason} onValueChange={setFilterReason}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  <SelectItem value="hard_bounce">Hard Bounce</SelectItem>
                  <SelectItem value="soft_bounce">Soft Bounce</SelectItem>
                  <SelectItem value="complaint">Spam Complaint</SelectItem>
                  <SelectItem value="unsubscribe">Unsubscribed</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Email
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add to Suppression List</DialogTitle>
                  <DialogDescription>
                    Manually add an email address to prevent sending emails to it.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@example.com"
                      value={newEntry.email}
                      onChange={(e) => setNewEntry({ ...newEntry, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Select 
                      value={newEntry.reason} 
                      onValueChange={(v) => setNewEntry({ ...newEntry, reason: v as typeof newEntry.reason })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="unsubscribe">Unsubscribed</SelectItem>
                        <SelectItem value="hard_bounce">Hard Bounce</SelectItem>
                        <SelectItem value="complaint">Spam Complaint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any additional notes..."
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="hero" 
                    onClick={() => addMutation.mutate(newEntry)}
                    disabled={!newEntry.email || addMutation.isPending}
                  >
                    {addMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add to List
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Suppression List Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-xl overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Suppressed At</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {searchTerm || filterReason !== "all" 
                      ? "No matching entries found" 
                      : "No suppressed emails yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.email}</TableCell>
                    <TableCell>
                      <Badge className={`gap-1 ${reasonColors[entry.reason] || ""}`}>
                        {reasonIcons[entry.reason]}
                        {reasonLabels[entry.reason] || entry.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {entry.bounce_type && <span>Bounce: {entry.bounce_type}</span>}
                      {entry.complaint_type && <span>Complaint: {entry.complaint_type}</span>}
                      {entry.notes && <span>{entry.notes}</span>}
                      {!entry.bounce_type && !entry.complaint_type && !entry.notes && "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(entry.suppressed_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        disabled={deleteMutation.isPending}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default SuppressionList;
