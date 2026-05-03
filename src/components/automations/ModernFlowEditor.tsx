import { useState, useCallback, useRef, useEffect } from "react";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationAISuggestions } from "./AutomationAISuggestions";
import { AutomationTester } from "./AutomationTester";
import { 
  Mail, 
  Clock, 
  MousePointerClick, 
  UserPlus, 
  Calendar, 
  UserX, 
  Send, 
  Tag, 
  Bell, 
  Webhook, 
  Users, 
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  Play,
  Zap,
  GitBranch,
  Eye,
  Sparkles,
  ChevronDown,
  ChevronUp,
  TestTube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export interface FlowNode {
  id: string;
  type: "trigger" | "action" | "delay" | "condition";
  nodeType: string;
  config?: Record<string, unknown>;
  yesBranch?: FlowNode[];
  noBranch?: FlowNode[];
}

interface ModernFlowEditorProps {
  onSubmit: (data: {
    name: string;
    description: string;
    steps: FlowNode[];
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
  initialData?: {
    name: string;
    description: string;
    steps: FlowNode[];
  };
}

const nodeTypes = {
  trigger: {
    email_opened: { name: "Email Opened", icon: Mail, color: "bg-blue-500" },
    link_clicked: { name: "Link Clicked", icon: MousePointerClick, color: "bg-blue-500" },
    not_opened: { name: "Not Opened", icon: Clock, color: "bg-blue-500" },
    new_subscriber: { name: "New Subscriber", icon: UserPlus, color: "bg-blue-500" },
    no_reply: { name: "No Reply", icon: Clock, color: "bg-blue-500" },
    bounced: { name: "Email Bounced", icon: AlertTriangle, color: "bg-blue-500" },
    scheduled: { name: "Scheduled Date", icon: Calendar, color: "bg-blue-500" },
  },
  action: {
    send_email: { name: "Send Email", icon: Send, color: "bg-emerald-500" },
    add_tag: { name: "Add Tag", icon: Tag, color: "bg-emerald-500" },
    move_list: { name: "Move to List", icon: Users, color: "bg-emerald-500" },
    notify: { name: "Send Notification", icon: Bell, color: "bg-emerald-500" },
    webhook: { name: "Trigger Webhook", icon: Webhook, color: "bg-emerald-500" },
    mark_churned: { name: "Mark as Churned", icon: UserX, color: "bg-emerald-500" },
  },
  delay: {
    wait_1h: { name: "Wait 1 Hour", icon: Clock, color: "bg-amber-500" },
    wait_1d: { name: "Wait 1 Day", icon: Clock, color: "bg-amber-500" },
    wait_3d: { name: "Wait 3 Days", icon: Clock, color: "bg-amber-500" },
    wait_1w: { name: "Wait 1 Week", icon: Clock, color: "bg-amber-500" },
  },
  condition: {
    if_opened: { name: "If Opened", icon: GitBranch, color: "bg-purple-500" },
    if_clicked: { name: "If Clicked", icon: GitBranch, color: "bg-purple-500" },
  },
};

const NodeCard = ({ 
  node, 
  onEdit, 
  onDelete,
  onPreview,
}: { 
  node: FlowNode; 
  onEdit?: () => void; 
  onDelete?: () => void;
  onPreview?: () => void;
}) => {
  const typeConfig = (nodeTypes as any)[node.type]?.[node.nodeType];
  if (!typeConfig) return null;

  const Icon = typeConfig.icon;
  const colors = {
    trigger: "from-blue-500/10 to-blue-500/5 border-blue-200 dark:border-blue-900",
    action: "from-emerald-500/10 to-emerald-500/5 border-emerald-200 dark:border-emerald-900",
    delay: "from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-900",
    condition: "from-purple-500/10 to-purple-500/5 border-purple-200 dark:border-purple-900",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative group"
    >
      <Card className={cn("bg-gradient-to-br", colors[node.type], "hover:shadow-lg transition-all duration-300")}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 flex-1">
              <div className={cn("p-2 rounded-lg", typeConfig.color)}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{typeConfig.name}</p>
                {node.config && Object.keys(node.config).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {JSON.stringify(node.config).substring(0, 40)}...
                  </p>
                )}
              </div>
            </div>
            <Badge variant="outline" className="capitalize text-[10px]">{node.type}</Badge>
          </div>

          {(onEdit || onDelete || onPreview) && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {onPreview && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={onPreview}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
              )}
              {onEdit && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={onEdit}
                >
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const NodePalette = ({ onAdd }: { onAdd: (type: string, nodeType: string) => void }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="glass sticky top-0 z-10">
      <CardContent className="p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between font-semibold text-sm hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Step
          </span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border"
            >
              {Object.entries(nodeTypes).map(([type, nodes]) => (
                <div key={type} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{type}</p>
                  <div className="space-y-1">
                    {Object.entries(nodes).map(([nodeType, config]) => (
                      <button
                        key={nodeType}
                        onClick={() => {
                          onAdd(type, nodeType);
                          setExpanded(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors flex items-center gap-2 group"
                      >
                        {/* @ts-ignore */}
                        <config.icon className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                        <span className="text-xs truncate">{config.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export const ModernFlowEditor = ({
  onSubmit,
  onCancel,
  isSaving,
  initialData,
}: ModernFlowEditorProps) => {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [steps, setSteps] = useState<FlowNode[]>(initialData?.steps || []);
  const [previewNode, setPreviewNode] = useState<FlowNode | null>(null);
  const [activeTab, setActiveTab] = useState<"builder" | "suggestions" | "test">("builder");

  const handleAddNode = useCallback((type: string, nodeType: string) => {
    const newNode: FlowNode = {
      id: `node-${Date.now()}-${Math.random()}`,
      type: type as any,
      nodeType,
    };
    setSteps([...steps, newNode]);
  }, [steps]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setSteps(steps.filter((n) => n.id !== nodeId));
  }, [steps]);

  const handleApplySuggestion = useCallback((suggestion: any) => {
    // Apply suggestion steps to the flow
    const newSteps = [...steps];
    suggestion.nextSteps.forEach((step: any) => {
      newSteps.push({
        id: `node-${Date.now()}-${Math.random()}`,
        type: step.type,
        nodeType: step.nodeType,
      });
    });
    setSteps(newSteps);
  }, [steps]);

  const isValid = name.trim() && steps.length > 0 && 
    steps.some((s) => s.type === "trigger") && 
    steps.some((s) => s.type === "action");

  const formattedSteps = steps.map(s => ({
    type: s.type,
    nodeType: s.nodeType,
    label: (nodeTypes as any)[s.type]?.[s.nodeType]?.name || s.nodeType,
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {initialData ? "Edit Automation" : "Create New Automation"}
        </h2>
      </div>

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4 border-b border-border">
          <TabsList className="grid w-full grid-cols-3 max-w-sm">
            <TabsTrigger value="builder" className="gap-2">
              <Zap className="w-3 h-3" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-2">
              <Sparkles className="w-3 h-3" />
              AI Assist
            </TabsTrigger>
            <TabsTrigger value="test" className="gap-2">
              <TestTube className="w-3 h-3" />
              Test
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Builder Tab */}
          {activeTab === "builder" && (
            <div className="max-w-4xl mx-auto p-6 space-y-6">
              {/* Name & Description */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auto-name" className="text-sm font-medium">Automation Name</Label>
                  <Input
                    id="auto-name"
                    placeholder="e.g., Re-engage inactive subscribers"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-desc" className="text-sm font-medium">Description (optional)</Label>
                  <Textarea
                    id="auto-desc"
                    placeholder="Describe what this automation does..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-20 text-sm"
                  />
                </div>
              </div>

              {/* Node Palette */}
              <NodePalette onAdd={handleAddNode} />

              {/* Flow Canvas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Automation Steps ({steps.length})</h3>
                  {!steps.some((s) => s.type === "trigger") && (
                    <Badge variant="destructive" className="text-xs">Missing trigger</Badge>
                  )}
                  {!steps.some((s) => s.type === "action") && (
                    <Badge variant="destructive" className="text-xs">Missing action</Badge>
                  )}
                </div>

                {steps.length === 0 ? (
                  <Card className="glass border-dashed">
                    <CardContent className="p-8 text-center">
                      <Zap className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Add steps to build your automation workflow
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {steps.map((node, idx) => (
                        <div key={node.id} className="space-y-2">
                          <NodeCard
                            node={node}
                            onEdit={() => setPreviewNode(node)}
                            onDelete={() => handleDeleteNode(node.id)}
                            onPreview={() => setPreviewNode(node)}
                          />
                          {idx < steps.length - 1 && (
                            <div className="flex justify-center py-2">
                              <div className="w-px h-4 bg-border" />
                            </div>
                          )}
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Suggestions Tab */}
          {activeTab === "suggestions" && (
            <div className="max-w-4xl mx-auto p-6">
              <AutomationAISuggestions
                currentSteps={steps}
                onApplySuggestion={handleApplySuggestion}
              />
            </div>
          )}

          {/* Test Tab */}
          {activeTab === "test" && (
            <div className="max-w-4xl mx-auto p-6">
              <AutomationTester
                steps={formattedSteps}
                automationName={name || "Automation"}
              />
            </div>
          )}
        </div>
      </Tabs>

      {/* Footer Actions */}
      <div className="border-t border-border px-6 py-4 bg-muted/20 flex items-center justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit({ name, description, steps })}
          disabled={!isValid || isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Save Automation
            </>
          )}
        </Button>
      </div>

      {/* Preview Modal */}
      {previewNode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setPreviewNode(null)}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background rounded-lg p-6 shadow-lg max-w-sm w-full mx-4"
          >
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Step Preview</h3>
                <NodeCard node={previewNode} />
              </div>
              <Button onClick={() => setPreviewNode(null)} className="w-full">
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
