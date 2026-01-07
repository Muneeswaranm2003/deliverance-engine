import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { Loader2, User, Mail, Shield, Bell, Palette, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Settings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
  });

  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    campaignAlerts: true,
    weeklyDigest: false,
  });

  // Update form when profile loads
  useState(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || user?.email || "",
      });
    }
  });

  const updateProfile = useMutation({
    mutationFn: async (data: { full_name: string }) => {
      if (!user?.id) throw new Error("No user");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: data.full_name })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error updating profile", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateProfile.mutate({ full_name: formData.full_name });
  };

  const SettingsCard = ({
    icon: Icon,
    title,
    description,
    children,
    delay = 0,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
    children: React.ReactNode;
    delay?: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass rounded-xl p-6"
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );

  if (isLoading) {
    return (
      <AppLayout title="Settings" description="Manage your account preferences">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings" description="Manage your account preferences">
      <div className="max-w-3xl space-y-6">
        {/* Profile Settings */}
        <SettingsCard
          icon={User}
          title="Profile Information"
          description="Update your personal details"
          delay={0}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                value={formData.full_name || profile?.full_name || ""}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support for assistance.
              </p>
            </div>
            <Button
              variant="hero"
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="gap-2"
            >
              {updateProfile.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          </div>
        </SettingsCard>

        {/* Notification Settings */}
        <SettingsCard
          icon={Bell}
          title="Notifications"
          description="Configure how you receive updates"
          delay={0.1}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Updates</p>
                <p className="text-sm text-muted-foreground">
                  Receive important product updates via email
                </p>
              </div>
              <Switch
                checked={notifications.emailUpdates}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, emailUpdates: checked })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Campaign Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when campaigns are sent or completed
                </p>
              </div>
              <Switch
                checked={notifications.campaignAlerts}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, campaignAlerts: checked })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Digest</p>
                <p className="text-sm text-muted-foreground">
                  Receive a weekly summary of your campaign performance
                </p>
              </div>
              <Switch
                checked={notifications.weeklyDigest}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, weeklyDigest: checked })
                }
              />
            </div>
          </div>
        </SettingsCard>

        {/* Security Settings */}
        <SettingsCard
          icon={Shield}
          title="Security"
          description="Manage your account security"
          delay={0.2}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  Last changed: Never
                </p>
              </div>
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button variant="outline" size="sm">
                Enable 2FA
              </Button>
            </div>
          </div>
        </SettingsCard>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-6"
        >
          <h3 className="font-display font-semibold text-lg text-destructive mb-2">
            Danger Zone
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive" size="sm">
            Delete Account
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default Settings;
