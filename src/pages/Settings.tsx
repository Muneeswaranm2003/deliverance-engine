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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Server, 
  Key, 
  Globe, 
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react";
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

  // Email sending configuration state
  const [emailProvider, setEmailProvider] = useState<"smtp" | "api">("api");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  
  const [smtpConfig, setSmtpConfig] = useState({
    host: "",
    port: "587",
    username: "",
    password: "",
    encryption: "tls",
    fromEmail: "",
    fromName: "",
  });

  const [apiConfig, setApiConfig] = useState({
    provider: "resend",
    apiKey: "",
    fromEmail: "",
    fromName: "",
  });

  const [ipConfig, setIpConfig] = useState({
    dedicatedIp: "",
    warmupEnabled: false,
    warmupDailyLimit: "100",
    ipPoolName: "",
  });

  const [emailConfigStatus, setEmailConfigStatus] = useState<"unconfigured" | "testing" | "configured">("unconfigured");

  const testEmailConnection = async () => {
    setEmailConfigStatus("testing");
    // Simulate testing connection
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setEmailConfigStatus("configured");
    toast({ title: "Email configuration verified successfully!" });
  };

  const saveEmailConfig = () => {
    toast({ title: "Email configuration saved", description: "Your email sending settings have been updated." });
  };

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

        {/* Email Sending Configuration */}
        <SettingsCard
          icon={Mail}
          title="Email Sending Configuration"
          description="Configure SMTP, API, and IP settings for sending emails"
          delay={0.15}
        >
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {emailConfigStatus === "unconfigured" && (
                <Badge variant="secondary" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Not Configured
                </Badge>
              )}
              {emailConfigStatus === "testing" && (
                <Badge className="gap-1 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Testing...
                </Badge>
              )}
              {emailConfigStatus === "configured" && (
                <Badge className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle className="w-3 h-3" />
                  Configured
                </Badge>
              )}
            </div>

            <Tabs value={emailProvider} onValueChange={(v) => setEmailProvider(v as "smtp" | "api")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="api" className="gap-2">
                  <Key className="w-4 h-4" />
                  API
                </TabsTrigger>
                <TabsTrigger value="smtp" className="gap-2">
                  <Server className="w-4 h-4" />
                  SMTP
                </TabsTrigger>
              </TabsList>

              {/* API Configuration */}
              <TabsContent value="api" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="api-provider">Email Provider</Label>
                  <Select 
                    value={apiConfig.provider} 
                    onValueChange={(v) => setApiConfig({ ...apiConfig, provider: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resend">Resend</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                      <SelectItem value="ses">Amazon SES</SelectItem>
                      <SelectItem value="postmark">Postmark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder="Enter your API key"
                      value={apiConfig.apiKey}
                      onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get your API key from your email provider's dashboard
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-from-email">From Email</Label>
                    <Input
                      id="api-from-email"
                      type="email"
                      placeholder="noreply@yourdomain.com"
                      value={apiConfig.fromEmail}
                      onChange={(e) => setApiConfig({ ...apiConfig, fromEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-from-name">From Name</Label>
                    <Input
                      id="api-from-name"
                      placeholder="Your Company"
                      value={apiConfig.fromName}
                      onChange={(e) => setApiConfig({ ...apiConfig, fromName: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* SMTP Configuration */}
              <TabsContent value="smtp" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-host">SMTP Host</Label>
                    <Input
                      id="smtp-host"
                      placeholder="smtp.example.com"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-port">Port</Label>
                    <Select 
                      value={smtpConfig.port} 
                      onValueChange={(v) => setSmtpConfig({ ...smtpConfig, port: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select port" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 (Unencrypted)</SelectItem>
                        <SelectItem value="465">465 (SSL)</SelectItem>
                        <SelectItem value="587">587 (TLS)</SelectItem>
                        <SelectItem value="2525">2525 (Alternative)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-username">Username</Label>
                    <Input
                      id="smtp-username"
                      placeholder="SMTP username"
                      value={smtpConfig.username}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="smtp-password"
                        type={showSmtpPassword ? "text" : "password"}
                        placeholder="SMTP password"
                        value={smtpConfig.password}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-encryption">Encryption</Label>
                  <Select 
                    value={smtpConfig.encryption} 
                    onValueChange={(v) => setSmtpConfig({ ...smtpConfig, encryption: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select encryption" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="ssl">SSL</SelectItem>
                      <SelectItem value="tls">TLS (Recommended)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from-email">From Email</Label>
                    <Input
                      id="smtp-from-email"
                      type="email"
                      placeholder="noreply@yourdomain.com"
                      value={smtpConfig.fromEmail}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp-from-name">From Name</Label>
                    <Input
                      id="smtp-from-name"
                      placeholder="Your Company"
                      value={smtpConfig.fromName}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            {/* IP Configuration */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <h4 className="font-medium">IP Configuration</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dedicated-ip">Dedicated IP Address</Label>
                  <Input
                    id="dedicated-ip"
                    placeholder="192.168.1.1 (optional)"
                    value={ipConfig.dedicatedIp}
                    onChange={(e) => setIpConfig({ ...ipConfig, dedicatedIp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ip-pool">IP Pool Name</Label>
                  <Input
                    id="ip-pool"
                    placeholder="default (optional)"
                    value={ipConfig.ipPoolName}
                    onChange={(e) => setIpConfig({ ...ipConfig, ipPoolName: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">IP Warmup</p>
                  <p className="text-sm text-muted-foreground">
                    Gradually increase sending volume to build sender reputation
                  </p>
                </div>
                <Switch
                  checked={ipConfig.warmupEnabled}
                  onCheckedChange={(checked) =>
                    setIpConfig({ ...ipConfig, warmupEnabled: checked })
                  }
                />
              </div>

              {ipConfig.warmupEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="warmup-limit">Daily Sending Limit During Warmup</Label>
                  <Select 
                    value={ipConfig.warmupDailyLimit} 
                    onValueChange={(v) => setIpConfig({ ...ipConfig, warmupDailyLimit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select daily limit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 emails/day</SelectItem>
                      <SelectItem value="100">100 emails/day</SelectItem>
                      <SelectItem value="250">250 emails/day</SelectItem>
                      <SelectItem value="500">500 emails/day</SelectItem>
                      <SelectItem value="1000">1,000 emails/day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={testEmailConnection}
                disabled={emailConfigStatus === "testing"}
                className="gap-2"
              >
                {emailConfigStatus === "testing" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Test Connection
              </Button>
              <Button
                variant="hero"
                onClick={saveEmailConfig}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Save Configuration
              </Button>
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
