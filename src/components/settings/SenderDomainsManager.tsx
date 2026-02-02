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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Plus, 
  Trash2, 
  GripVertical, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Mail,
  Star
} from "lucide-react";

interface SenderDomain {
  id: string;
  user_id: string;
  display_order: number;
  domain_name: string;
  from_email: string;
  from_name: string;
  is_verified: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const SenderDomainsManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newDomain, setNewDomain] = useState({
    domain_name: "",
    from_email: "",
    from_name: "",
    is_default: false,
  });

  const { data: senderDomains, isLoading } = useQuery({
    queryKey: ["sender_domains", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("sender_domains")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as SenderDomain[];
    },
    enabled: !!user?.id,
  });

  const addDomain = useMutation({
    mutationFn: async (domain: typeof newDomain) => {
      if (!user?.id) throw new Error("No user");
      
      // Get the next available order number
      const nextOrder = (senderDomains?.length || 0) + 1;
      
      if (nextOrder > 5) {
        throw new Error("Maximum 5 sender domains allowed");
      }

      // If setting as default, unset other defaults first
      if (domain.is_default && senderDomains?.some(d => d.is_default)) {
        await supabase
          .from("sender_domains")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }

      const { data, error } = await supabase
        .from("sender_domains")
        .insert({
          user_id: user.id,
          display_order: nextOrder,
          domain_name: domain.domain_name,
          from_email: domain.from_email,
          from_name: domain.from_name,
          is_default: domain.is_default || nextOrder === 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sender_domains"] });
      setIsAddOpen(false);
      setNewDomain({ domain_name: "", from_email: "", from_name: "", is_default: false });
      toast({ title: "Sender domain added successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error adding domain", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const deleteDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sender_domains")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Reorder remaining domains
      if (user?.id) {
        const remaining = senderDomains?.filter(d => d.id !== id) || [];
        for (let i = 0; i < remaining.length; i++) {
          await supabase
            .from("sender_domains")
            .update({ display_order: i + 1 })
            .eq("id", remaining[i].id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sender_domains"] });
      setDeleteId(null);
      toast({ title: "Sender domain removed" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error removing domain", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("No user");
      
      // Unset all defaults first
      await supabase
        .from("sender_domains")
        .update({ is_default: false })
        .eq("user_id", user.id);
      
      // Set the new default
      const { error } = await supabase
        .from("sender_domains")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sender_domains"] });
      toast({ title: "Default sender updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating default", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.from_email.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    
    // Extract domain from email
    const domain = newDomain.from_email.split("@")[1];
    
    addDomain.mutate({
      ...newDomain,
      domain_name: newDomain.domain_name || domain,
    });
  };

  const canAddMore = (senderDomains?.length || 0) < 5;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Configure up to 5 sender domains. Emails will be sent using these domains in order.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              className="gap-2" 
              disabled={!canAddMore}
            >
              <Plus className="w-4 h-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Sender Domain</DialogTitle>
              <DialogDescription>
                Add a new sender domain for your email campaigns.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="from_name">Sender Name</Label>
                <Input
                  id="from_name"
                  placeholder="e.g., John from Company"
                  value={newDomain.from_name}
                  onChange={(e) => setNewDomain({ ...newDomain, from_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_email">Sender Email</Label>
                <Input
                  id="from_email"
                  type="email"
                  placeholder="e.g., hello@yourdomain.com"
                  value={newDomain.from_email}
                  onChange={(e) => setNewDomain({ ...newDomain, from_email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain_name">Domain Name (optional)</Label>
                <Input
                  id="domain_name"
                  placeholder="Auto-detected from email"
                  value={newDomain.domain_name}
                  onChange={(e) => setNewDomain({ ...newDomain, domain_name: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_default"
                  checked={newDomain.is_default}
                  onCheckedChange={(checked) => setNewDomain({ ...newDomain, is_default: checked })}
                />
                <Label htmlFor="is_default">Set as default sender</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addDomain.isPending}>
                  {addDomain.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Domain
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Domain List */}
      <div className="space-y-2">
        {senderDomains && senderDomains.length > 0 ? (
          senderDomains.map((domain, index) => (
            <div
              key={domain.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <GripVertical className="w-4 h-4" />
                <Badge variant="outline" className="font-mono">
                  #{domain.display_order}
                </Badge>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="font-medium truncate">{domain.from_name}</span>
                  {domain.is_default && (
                    <Badge className="gap-1 bg-primary/10 text-primary border-primary/20">
                      <Star className="w-3 h-3" />
                      Default
                    </Badge>
                  )}
                  {domain.is_verified ? (
                    <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Unverified
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {domain.from_email} • {domain.domain_name}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {!domain.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefault.mutate(domain.id)}
                    disabled={setDefault.isPending}
                  >
                    Set Default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(domain.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No sender domains configured</p>
            <p className="text-sm">Add your first domain to start sending emails</p>
          </div>
        )}
      </div>

      {!canAddMore && (
        <p className="text-sm text-amber-500">
          Maximum of 5 sender domains reached. Delete an existing domain to add a new one.
        </p>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sender Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sender domain? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteDomain.mutate(deleteId)}
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
