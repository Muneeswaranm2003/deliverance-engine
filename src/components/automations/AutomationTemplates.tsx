import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Mail,
  Clock,
  MousePointerClick,
  UserPlus,
  UserX,
  AlertTriangle,
  Send,
  Tag,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: "engagement" | "retention" | "onboarding" | "re-engagement";
  icon: any;
  color: string;
  steps: Array<{
    type: "trigger" | "delay" | "action";
    nodeType: string;
  }>;
  tags: string[];
  popularity: number;
}

export const automationTemplates: AutomationTemplate[] = [
  {
    id: "welcome-series",
    name: "Welcome Email Series",
    description: "Send a series of emails to new subscribers",
    category: "onboarding",
    icon: Mail,
    color: "from-blue-500/10 to-blue-500/5",
    steps: [
      { type: "trigger", nodeType: "new_subscriber" },
      { type: "delay", nodeType: "wait_1d" },
      { type: "action", nodeType: "send_email" },
    ],
    tags: ["onboarding", "welcome"],
    popularity: 95,
  },
  {
    id: "re-engage-inactive",
    name: "Re-engage Inactive Users",
    description: "Send re-engagement emails to inactive subscribers",
    category: "re-engagement",
    icon: UserX,
    color: "from-orange-500/10 to-orange-500/5",
    steps: [
      { type: "trigger", nodeType: "inactive" },
      { type: "delay", nodeType: "wait_3d" },
      { type: "action", nodeType: "send_reengagement" },
    ],
    tags: ["inactive", "retention"],
    popularity: 88,
  },
  {
    id: "unopened-follow-up",
    name: "Unopened Email Follow-up",
    description: "Follow up with recipients who didn't open the email",
    category: "engagement",
    icon: Clock,
    color: "from-amber-500/10 to-amber-500/5",
    steps: [
      { type: "trigger", nodeType: "not_opened" },
      { type: "delay", nodeType: "wait_3d" },
      { type: "action", nodeType: "send_email" },
    ],
    tags: ["follow-up", "engagement"],
    popularity: 92,
  },
  {
    id: "link-click-action",
    name: "Link Click Action",
    description: "Tag users who clicked a link in your email",
    category: "engagement",
    icon: MousePointerClick,
    color: "from-emerald-500/10 to-emerald-500/5",
    steps: [
      { type: "trigger", nodeType: "link_clicked" },
      { type: "action", nodeType: "add_tag" },
    ],
    tags: ["engagement", "tagging"],
    popularity: 85,
  },
  {
    id: "bounce-handling",
    name: "Email Bounce Handler",
    description: "Mark bounced emails and remove from active list",
    category: "retention",
    icon: AlertTriangle,
    color: "from-red-500/10 to-red-500/5",
    steps: [
      { type: "trigger", nodeType: "bounced" },
      { type: "action", nodeType: "mark_churned" },
    ],
    tags: ["bounce", "cleanup"],
    popularity: 78,
  },
  {
    id: "scheduled-campaign",
    name: "Scheduled Campaign",
    description: "Send emails on a specific date to all subscribers",
    category: "engagement",
    icon: Send,
    color: "from-purple-500/10 to-purple-500/5",
    steps: [
      { type: "trigger", nodeType: "scheduled" },
      { type: "action", nodeType: "send_email" },
    ],
    tags: ["scheduled", "campaign"],
    popularity: 82,
  },
];

interface AutomationTemplateGridProps {
  onSelectTemplate: (template: AutomationTemplate) => void;
}

const TemplateCard = ({ 
  template, 
  onSelect,
}: { 
  template: AutomationTemplate;
  onSelect: () => void;
}) => {
  const Icon = template.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card className={cn(
        "glass cursor-pointer overflow-hidden group hover:shadow-lg transition-all duration-300 bg-gradient-to-br",
        template.color
      )}>
        <CardContent className="p-5 space-y-4 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <Icon className="w-5 h-5" />
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {template.popularity}% used
            </Badge>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold text-sm line-clamp-2">{template.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {template.description}
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] px-2 py-0"
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* Steps Preview */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{template.steps.length} steps</p>
            <div className="flex items-center gap-1">
              {template.steps.slice(0, 3).map((step, idx) => (
                <span key={idx} className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50" />
              ))}
              {template.steps.length > 3 && (
                <span className="text-[9px] text-muted-foreground">
                  +{template.steps.length - 3}
                </span>
              )}
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={onSelect}
            className="w-full gap-2 h-8 text-xs group-hover:shadow-lg"
          >
            Use Template
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const AutomationTemplateGrid = ({ onSelectTemplate }: AutomationTemplateGridProps) => {
  const categorizedTemplates = {
    onboarding: automationTemplates.filter((t) => t.category === "onboarding"),
    engagement: automationTemplates.filter((t) => t.category === "engagement"),
    retention: automationTemplates.filter((t) => t.category === "retention"),
    "re-engagement": automationTemplates.filter((t) => t.category === "re-engagement"),
  };

  return (
    <div className="space-y-8">
      {Object.entries(categorizedTemplates).map(([category, templates]) => 
        templates.length > 0 && (
          <div key={category} className="space-y-3">
            <div>
              <h3 className="font-semibold text-base capitalize">
                {category === "re-engagement" ? "Re-engagement" : category}
              </h3>
              <p className="text-sm text-muted-foreground">
                {templates.length} template{templates.length !== 1 ? "s" : ""} available
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => onSelectTemplate(template)}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
};
