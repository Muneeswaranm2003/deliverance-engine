import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { LayoutDashboard, Send, Users, Settings, LogOut, BarChart3 } from "lucide-react";

const Dashboard = () => {
  const { user, signOut } = useAuth();

  const stats = [
    { label: "Total Campaigns", value: "0", icon: Send },
    { label: "Total Contacts", value: "0", icon: Users },
    { label: "Emails Sent", value: "0", icon: BarChart3 },
  ];

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
          <a href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-secondary text-foreground">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </a>
          <a href="/dashboard/campaigns" className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <Send className="w-4 h-4" />
            Campaigns
          </a>
          <a href="/dashboard/contacts" className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <Users className="w-4 h-4" />
            Contacts
          </a>
          <a href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
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
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Welcome back, {user?.email}</p>
          </div>
          <Button variant="hero">Create Campaign</Button>
        </header>

        <div className="p-6">
          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-muted-foreground text-sm">{stat.label}</span>
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-display text-3xl font-bold">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Empty state */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-12 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Send className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">No campaigns yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first email campaign to start reaching your audience with high deliverability.
            </p>
            <Button variant="hero">Create Your First Campaign</Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
