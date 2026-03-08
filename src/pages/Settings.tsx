import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { 
  Loader2, 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Save, 
  Key, 
  Globe, 
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { IpPoolsManager } from "@/components/settings/IpPoolsManager";
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

  // Fetch email settings
  const { data: emailSettings, isLoading: emailSettingsLoading } = useQuery({
    queryKey: ["email_settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("email_settings")
        .select("*")
        .eq("user_id", user.id)
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

  // Email sending configuration state
  const [showApiKey, setShowApiKey] = useState(false);

  const [apiConfig, setApiConfig] = useState({
    provider: "resend",
    apiKey: "",
    fromEmail: "",
    fromName: "",
  });

  const [ipConfig, setIpConfig] = useState({
    dedicatedIp: false,
    warmupEnabled: false,
    warmupDailyLimit: "100",
    ipPoolName: "",
  });

  const [emailConfigStatus, setEmailConfigStatus] = useState<"unconfigured" | "testing" | "configured">("unconfigured");
  const [isSavingEmailConfig, setIsSavingEmailConfig] = useState(false);

  // Load email settings when fetched
  useEffect(() => {
    if (emailSettings) {
      setApiConfig({
        provider: emailSettings.api_provider || "resend",
        apiKey: emailSettings.api_key || "",
        fromEmail: emailSettings.api_from_email || "",
        fromName: emailSettings.api_from_name || "",
      });
      setIpConfig({
        dedicatedIp: emailSettings.use_dedicated_ip || false,
        warmupEnabled: emailSettings.enable_ip_warmup || false,
        warmupDailyLimit: String(emailSettings.daily_warmup_limit || 100),
        ipPoolName: emailSettings.ip_pool || "",
      });
      setEmailConfigStatus("configured");
    }
  }, [emailSettings]);

  // Set up realtime subscription for email_settings
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('email_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Email settings changed:', payload);
          queryClient.invalidateQueries({ queryKey: ["email_settings", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const testEmailConnection = async () => {
    setEmailConfigStatus("testing");
    
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: user?.email || "test@example.com",
          subject: "Test Email - Configuration Verified",
          html: "<h1>Email Configuration Test</h1><p>Your email settings are working correctly!</p>",
        },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setEmailConfigStatus("configured");
        toast({ title: "Email configuration verified!", description: "Test email sent successfully." });
      } else {
        setEmailConfigStatus("unconfigured");
        toast({ title: "Configuration test failed", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      setEmailConfigStatus("unconfigured");
      toast({ 
        title: "Configuration test failed", 
        description: error.message || "Failed to test email configuration", 
        variant: "destructive" 
      });
    }
  };

  const saveEmailConfig = async () => {
    if (!user?.id) return;
    
    setIsSavingEmailConfig(true);
    
    try {
      const settingsData = {
        user_id: user.id,
        provider_type: "api" as const,
        api_provider: apiConfig.provider,
        api_key: apiConfig.apiKey,
        api_from_email: apiConfig.fromEmail,
        api_from_name: apiConfig.fromName,
        use_dedicated_ip: ipConfig.dedicatedIp,
        ip_pool: ipConfig.ipPoolName,
        enable_ip_warmup: ipConfig.warmupEnabled,
        daily_warmup_limit: parseInt(ipConfig.warmupDailyLimit),
      };

      const { error } = await supabase
        .from("email_settings")
        .upsert(settingsData, { onConflict: "user_id" });

      if (error) throw error;

      setEmailConfigStatus("configured");
      toast({ title: "Email configuration saved", description: "Your email sending settings have been updated." });
      queryClient.invalidateQueries({ queryKey: ["email_settings", user.id] });
    } catch (error: any) {
      toast({ 
        title: "Error saving configuration", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSavingEmailConfig(false);
    }
  };

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || user?.email || "",
      });
    }
  }, [profile, user?.email]);

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

  if (isLoading || emailSettingsLoading) {
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

        {/* API Keys Configuration */}
        <SettingsCard
          icon={Key}
          title="API Keys"
          description="Manage multiple API keys with rotation and failover"
          delay={0.15}
        >
          <ApiKeysManager />
        </SettingsCard>

        {/* IP Pools & Reputation */}
        <SettingsCard
          icon={Globe}
          title="IP Pools & Reputation"
          description="Manage dedicated IPs, warmup schedules, and monitor reputation"
          delay={0.2}
        >
          <IpPoolsManager />
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
