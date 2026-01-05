import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { 
  Send, 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  Plus,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Pause,
  XCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

const statusConfig: Record<Campaign["status"], { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", icon: Clock, variant: "secondary" },
  scheduled: { label: "Scheduled", icon: Clock, variant: "outline" },
  sending: { label: "Sending", icon: Loader2, variant: "default" },
  sent: { label: "Sent", icon: CheckCircle2, variant: "default" },
  paused: { label: "Paused", icon: Pause, variant: "secondary" },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "destructive" },
};

const Campaigns = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Campaign[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-border bg-card p-6 hidden lg:block">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Send className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold">MailForge</span>
        </div>

        <nav className="space-y-2">
          <a href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </a>
          <a href="/campaigns" className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-secondary text-foreground">
            <Send className="w-4 h-4" />
            Campaigns
          </a>
          <a href="/contacts" className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <Users className="w-4 h-4" />
            Contacts
          </a>
          <a href="/settings" className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <Settings className="w-4 h-4" />
            Settings
          </a>
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64">
        <header className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Campaigns</h1>
            <p className="text-muted-foreground text-sm">Manage your email campaigns</p>
          </div>
          <Button variant="hero" onClick={() => navigate("/campaigns/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            New Campaign
          </Button>
        </header>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-12 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Send className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display text-xl font-semibold mb-2">No campaigns yet</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your first email campaign to start reaching your audience.
              </p>
              <Button variant="hero" onClick={() => navigate("/campaigns/new")}>
                Create Your First Campaign
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign, index) => {
                const status = statusConfig[campaign.status];
                const StatusIcon = status.icon;
                
                return (
                  <motion.div
                    key={campaign.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass rounded-xl p-6 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold truncate">{campaign.name}</h3>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className={`w-3 h-3 ${campaign.status === 'sending' ? 'animate-spin' : ''}`} />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{campaign.subject}</span>
                        <span>•</span>
                        <span>{campaign.total_recipients || 0} recipients</span>
                        <span>•</span>
                        <span>{format(new Date(campaign.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {campaign.status === 'draft' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
                        >
                          Edit
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          {campaign.status === 'draft' && (
                            <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}>
                              Edit Campaign
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive">
                            Delete Campaign
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Campaigns;
