import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  Zap,
  Mail,
  Clock,
  MousePointerClick,
  UserPlus,
  Tag,
  Send,
  Loader2,
  X,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIFlowSuggestion {
  id: string;
  title: string;
  description: string;
  nextSteps: Array<{
    type: "trigger" | "delay" | "action";
    nodeType: string;
    label: string;
  }>;
  confidence: number;
  category: string;
}

interface AutomationAISuggestionsProps {
  currentSteps: Array<{
    type: "trigger" | "delay" | "action" | "condition";
    nodeType: string;
  }>;
  onApplySuggestion: (suggestion: AIFlowSuggestion) => void;
  isLoading?: boolean;
}

// Mock AI suggestions - in production, this would call an API
const generateAISuggestions = (
  currentSteps: Array<{ type: string; nodeType: string }>
): AIFlowSuggestion[] => {
  const suggestions: AIFlowSuggestion[] = [];

  // Detect pattern: Email opened
  if (currentSteps.some((s) => s.nodeType === "email_opened")) {
    suggestions.push({
      id: "suggest-1",
      title: "Add delay before follow-up",
      description: "Wait 2 days before sending a follow-up email to opened messages",
      nextSteps: [
        { type: "delay", nodeType: "wait_2d", label: "Wait 2 days" },
        { type: "action", nodeType: "send_email", label: "Send Follow-up" },
      ],
      confidence: 0.92,
      category: "engagement",
    });

    suggestions.push({
      id: "suggest-2",
      title: "Tag engaged users",
      description: "Add an 'engaged' tag to users who opened your email",
      nextSteps: [
        { type: "action", nodeType: "add_tag", label: "Add 'engaged' tag" },
      ],
      confidence: 0.85,
      category: "segmentation",
    });
  }

  // Detect pattern: Link clicked
  if (currentSteps.some((s) => s.nodeType === "link_clicked")) {
    suggestions.push({
      id: "suggest-3",
      title: "Send VIP follow-up",
      description: "Immediately send a VIP follow-up to highly engaged users",
      nextSteps: [
        { type: "action", nodeType: "send_email", label: "Send VIP Email" },
      ],
      confidence: 0.88,
      category: "engagement",
    });

    suggestions.push({
      id: "suggest-4",
      title: "Move to VIP list",
      description: "Move users to a VIP list for premium content",
      nextSteps: [
        { type: "action", nodeType: "move_list", label: "Move to VIP List" },
      ],
      confidence: 0.82,
      category: "list-management",
    });
  }

  // Detect pattern: Not opened
  if (currentSteps.some((s) => s.nodeType === "not_opened")) {
    suggestions.push({
      id: "suggest-5",
      title: "Add re-engagement sequence",
      description: "Send a re-engagement email to users who didn't open",
      nextSteps: [
        { type: "delay", nodeType: "wait_3d", label: "Wait 3 days" },
        { type: "action", nodeType: "send_reengagement", label: "Send Re-engagement" },
      ],
      confidence: 0.91,
      category: "retention",
    });

    suggestions.push({
      id: "suggest-6",
      title: "Lower send priority",
      description: "Tag these users for lower priority campaigns",
      nextSteps: [
        { type: "action", nodeType: "add_tag", label: "Tag as 'low-priority'" },
      ],
      confidence: 0.78,
      category: "segmentation",
    });
  }

  // Detect pattern: New subscriber
  if (currentSteps.some((s) => s.nodeType === "new_subscriber")) {
    suggestions.push({
      id: "suggest-7",
      title: "Complete welcome series",
      description: "Add a welcome email followed by an educational email",
      nextSteps: [
        { type: "action", nodeType: "send_email", label: "Send Welcome Email" },
        { type: "delay", nodeType: "wait_1d", label: "Wait 1 day" },
        { type: "action", nodeType: "send_email", label: "Send Educational Email" },
      ],
      confidence: 0.95,
      category: "onboarding",
    });

    suggestions.push({
      id: "suggest-8",
      title: "Track engagement",
      description: "Send introductory email and wait for engagement",
      nextSteps: [
        { type: "action", nodeType: "send_email", label: "Send Intro Email" },
      ],
      confidence: 0.87,
      category: "engagement",
    });
  }

  // Filter out duplicates and sort by confidence
  const uniqueSuggestions = suggestions.filter(
    (v, i, a) => a.findIndex((t) => t.id === v.id) === i
  );

  return uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);
};

const iconMap: Record<string, typeof Sparkles> = {
  email_opened: Mail,
  link_clicked: MousePointerClick,
  not_opened: Clock,
  new_subscriber: UserPlus,
  send_email: Send,
  add_tag: Tag,
  move_list: Zap,
  wait_1d: Clock,
  wait_2d: Clock,
  wait_3d: Clock,
  send_reengagement: Send,
};

export const AutomationAISuggestions = ({
  currentSteps,
  onApplySuggestion,
  isLoading = false,
}: AutomationAISuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<AIFlowSuggestion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const generateSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const newSuggestions = generateAISuggestions(currentSteps);
    setSuggestions(newSuggestions);
    setLoadingSuggestions(false);
  }, [currentSteps]);

  const handleApply = (suggestion: AIFlowSuggestion) => {
    onApplySuggestion(suggestion);
    setAppliedSuggestions((prev) => new Set([...prev, suggestion.id]));
    setExpandedId(null);
  };

  const handleRefresh = () => {
    setSuggestions([]);
    setAppliedSuggestions(new Set());
    generateSuggestions();
  };

  if (currentSteps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">AI-Powered Suggestions</h3>
          <Badge variant="outline" className="text-[10px]">
            Smart Assistant
          </Badge>
        </div>
        {suggestions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleRefresh}
            disabled={loadingSuggestions}
          >
            {loadingSuggestions ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-1" />
                Regenerate
              </>
            )}
          </Button>
        )}
      </div>

      {suggestions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="glass border-dashed">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Get AI suggestions</p>
                  <p className="text-xs text-muted-foreground">
                    Get smart recommendations based on your current flow
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={generateSuggestions}
                disabled={loadingSuggestions}
              >
                {loadingSuggestions ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Get Suggestions
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <AnimatePresence>
            {suggestions.map((suggestion, idx) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className={cn(
                    "glass cursor-pointer transition-all duration-300 hover:shadow-lg",
                    expandedId === suggestion.id && "ring-2 ring-primary",
                    appliedSuggestions.has(suggestion.id) && "border-emerald-500/50 bg-emerald-500/5"
                  )}
                  onClick={() =>
                    setExpandedId(expandedId === suggestion.id ? null : suggestion.id)
                  }
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{suggestion.title}</p>
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {Math.round(suggestion.confidence * 100)}%
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 capitalize"
                            >
                              {suggestion.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {suggestion.description}
                          </p>
                        </div>
                      </div>

                      {appliedSuggestions.has(suggestion.id) ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <ChevronRight
                          className={cn(
                            "w-5 h-5 text-muted-foreground transition-transform shrink-0",
                            expandedId === suggestion.id && "rotate-90"
                          )}
                        />
                      )}
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {expandedId === suggestion.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 pt-3 border-t border-border/50 space-y-3"
                        >
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Next steps in your flow
                            </p>
                            <div className="space-y-1.5">
                              {suggestion.nextSteps.map((step, stepIdx) => {
                                const Icon =
                                  (iconMap[step.nodeType] as any) || Zap;
                                return (
                                  <div
                                    key={stepIdx}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/50"
                                  >
                                    <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="text-xs">{step.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <Button
                            onClick={() => handleApply(suggestion)}
                            className="w-full h-8 text-xs gap-1"
                            disabled={appliedSuggestions.has(suggestion.id)}
                          >
                            {appliedSuggestions.has(suggestion.id) ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Applied
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" />
                                Apply Suggestion
                              </>
                            )}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          <p className="text-xs text-muted-foreground text-center">
            {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} based on your flow
          </p>
        </motion.div>
      )}
    </div>
  );
};
