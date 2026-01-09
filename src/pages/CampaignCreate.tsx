import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import EmailTemplateEditor from "@/components/campaigns/EmailTemplateEditor";
import RecipientSelector from "@/components/campaigns/RecipientSelector";
import SchedulingOptions from "@/components/campaigns/SchedulingOptions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Mail, 
  Users, 
  Clock,
  Send,
  LayoutDashboard,
  Settings,
  LogOut,
  Loader2,
  FileText,
  Sparkles
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: string;
}

const savedTemplates: Template[] = [
  {
    id: "1",
    name: "Welcome Email",
    subject: "Welcome to {{company}}!",
    content: `Hi {{firstName}},

Welcome to {{company}}! We're thrilled to have you on board.

Here's what you can expect:
- Weekly updates on our latest features
- Exclusive tips and resources
- Priority support

If you have any questions, just reply to this email.

Best regards,
The {{company}} Team`,
    category: "Welcome",
  },
  {
    id: "2",
    name: "Monthly Newsletter",
    subject: "{{company}} Monthly Update - {{month}}",
    content: `Hi {{firstName}},

Here's what's new this month at {{company}}:

## New Features
- Feature 1 description
- Feature 2 description

## Tips & Tricks
Learn how to get the most out of our platform...

## Upcoming Events
Mark your calendar for our next webinar!

Stay tuned for more updates.

Best,
The {{company}} Team`,
    category: "Newsletter",
  },
  {
    id: "3",
    name: "Promotional Offer",
    subject: "Special Offer Just for You, {{firstName}}!",
    content: `Hi {{firstName}},

We've got an exclusive offer just for you!

🎉 Get 20% off your next purchase with code: SPECIAL20

This offer is valid until the end of the month, so don't miss out.

Shop now and save!

Cheers,
The {{company}} Team`,
    category: "Promotional",
  },
];

interface Recipient {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

const steps = [
  { id: 1, title: "Campaign Details", icon: Mail },
  { id: 2, title: "Email Content", icon: Mail },
  { id: 3, title: "Recipients", icon: Users },
  { id: 4, title: "Schedule", icon: Clock },
];

const CampaignCreate = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campaign details
  const [campaignName, setCampaignName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  // Email content
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  // Scheduling
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [timezone, setTimezone] = useState("UTC");
  const [batchSize, setBatchSize] = useState(50);
  const [batchDelay, setBatchDelay] = useState(60);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!campaignName.trim()) {
          toast({ title: "Campaign name is required", variant: "destructive" });
          return false;
        }
        if (!senderName.trim()) {
          toast({ title: "Sender name is required", variant: "destructive" });
          return false;
        }
        if (!senderEmail.trim() || !senderEmail.includes("@")) {
          toast({ title: "Valid sender email is required", variant: "destructive" });
          return false;
        }
        return true;
      case 2:
        if (!subject.trim()) {
          toast({ title: "Email subject is required", variant: "destructive" });
          return false;
        }
        if (!content.trim()) {
          toast({ title: "Email content is required", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        if (recipients.length === 0) {
          toast({ title: "Add at least one recipient", variant: "destructive" });
          return false;
        }
        return true;
      case 4:
        if (scheduleType === "later" && !scheduledDate) {
          toast({ title: "Select a scheduled date", variant: "destructive" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(4) || !user) return;

    setIsSubmitting(true);
    try {
      // Create the campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          user_id: user.id,
          name: campaignName,
          sender_name: senderName,
          sender_email: senderEmail,
          subject,
          content,
          status: scheduleType === "now" ? "sending" : "scheduled",
          schedule_type: scheduleType,
          scheduled_at: scheduleType === "later" && scheduledDate 
            ? new Date(`${scheduledDate.toISOString().split('T')[0]}T${scheduledTime}:00`).toISOString()
            : null,
          timezone,
          batch_size: batchSize,
          batch_delay: batchDelay,
          total_recipients: recipients.length,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Add recipients to campaign
      if (recipients.length > 0) {
        const recipientInserts = recipients.map((r) => ({
          campaign_id: campaign.id,
          email: r.email,
          first_name: r.firstName || null,
          last_name: r.lastName || null,
          company: r.company || null,
        }));

        const { error: recipientError } = await supabase
          .from("campaign_recipients")
          .insert(recipientInserts);

        if (recipientError) throw recipientError;
      }

      toast({
        title: "Campaign created!",
        description: scheduleType === "now" 
          ? "Your campaign is ready to send." 
          : "Your campaign has been scheduled.",
      });
      navigate("/campaigns");
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Error creating campaign",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">Create Campaign</h1>
              <p className="text-muted-foreground text-sm">Set up your email campaign</p>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step.id
                      ? "bg-green-500/20 text-green-500"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium hidden md:block">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      currentStep > step.id ? "bg-green-500" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Form Content */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-xl p-8 max-w-4xl mx-auto"
          >
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-semibold mb-2">Campaign Details</h2>
                  <p className="text-muted-foreground">Basic information about your campaign</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaignName">Campaign Name</Label>
                    <Input
                      id="campaignName"
                      placeholder="e.g., Black Friday Sale 2024"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="senderName">Sender Name</Label>
                      <Input
                        id="senderName"
                        placeholder="e.g., John from MailForge"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senderEmail">Sender Email</Label>
                      <Input
                        id="senderEmail"
                        type="email"
                        placeholder="e.g., john@mailforge.com"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        className="bg-secondary/50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-semibold mb-2">Email Content</h2>
                  <p className="text-muted-foreground">Start from a template or create from scratch</p>
                </div>

                {/* Template Selector */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Choose a Template (Optional)</Label>
                  <ScrollArea className="w-full">
                    <div className="flex gap-3 pb-2">
                      {/* Start from scratch option */}
                      <Card 
                        className={`shrink-0 w-48 cursor-pointer transition-all hover:border-primary/50 ${
                          !subject && !content ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                        }`}
                        onClick={() => {
                          setSubject("");
                          setContent("");
                          toast({ title: "Starting from scratch" });
                        }}
                      >
                        <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px]">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-center">Start from Scratch</p>
                          <p className="text-xs text-muted-foreground text-center mt-1">Create your own</p>
                        </CardContent>
                      </Card>

                      {/* Template options */}
                      {savedTemplates.map((template) => (
                        <Card 
                          key={template.id}
                          className={`shrink-0 w-48 cursor-pointer transition-all hover:border-primary/50 ${
                            subject === template.subject && content === template.content 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border'
                          }`}
                          onClick={() => {
                            setSubject(template.subject);
                            setContent(template.content);
                            toast({ title: `Applied "${template.name}" template` });
                          }}
                        >
                          <CardContent className="p-4 flex flex-col min-h-[120px]">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-primary" />
                              <Badge variant="secondary" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium line-clamp-2">{template.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {template.subject}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border-t border-border pt-6">
                  <EmailTemplateEditor
                    subject={subject}
                    onSubjectChange={setSubject}
                    content={content}
                    onContentChange={setContent}
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-semibold mb-2">Recipients</h2>
                  <p className="text-muted-foreground">Select who will receive your campaign</p>
                </div>

                <RecipientSelector
                  recipients={recipients}
                  onRecipientsChange={setRecipients}
                />
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-semibold mb-2">Schedule & Delivery</h2>
                  <p className="text-muted-foreground">Choose when and how to send your campaign</p>
                </div>

                <SchedulingOptions
                  scheduleType={scheduleType}
                  onScheduleTypeChange={setScheduleType}
                  scheduledDate={scheduledDate}
                  onScheduledDateChange={setScheduledDate}
                  scheduledTime={scheduledTime}
                  onScheduledTimeChange={setScheduledTime}
                  timezone={timezone}
                  onTimezoneChange={setTimezone}
                  batchSize={batchSize}
                  onBatchSizeChange={setBatchSize}
                  batchDelay={batchDelay}
                  onBatchDelayChange={setBatchDelay}
                />

                {/* Summary */}
                <div className="bg-secondary/30 rounded-lg p-6 border border-border space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    Campaign Summary
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Campaign Name</p>
                      <p className="font-medium">{campaignName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sender</p>
                      <p className="font-medium">{senderName} &lt;{senderEmail}&gt;</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Recipients</p>
                      <p className="font-medium">{recipients.length} contacts</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Delivery</p>
                      <p className="font-medium">
                        {scheduleType === "now"
                          ? "Send immediately"
                          : scheduledDate
                          ? `Scheduled for ${scheduledDate.toLocaleDateString()} at ${scheduledTime}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>

              {currentStep < 4 ? (
                <Button onClick={handleNext} className="gap-2">
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button variant="hero" onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {scheduleType === "now" ? "Send Campaign" : "Schedule Campaign"}
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default CampaignCreate;
