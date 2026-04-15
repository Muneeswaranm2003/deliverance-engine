import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
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
  GitBranch,
  Timer,
  Zap,
  ChevronDown,
  Search,
  GripVertical,
} from "lucide-react";
import { NodeConfig, nodeStyles } from "./flowTypes";
import { Input } from "@/components/ui/input";

const nodeCategories: {
  category: "trigger" | "delay" | "action" | "condition";
  label: string;
  nodes: NodeConfig[];
}[] = [
  {
    category: "trigger",
    label: "Triggers",
    nodes: [
      { id: "email_opened", name: "Email Opened", icon: Mail, category: "trigger", description: "When a recipient opens an email" },
      { id: "link_clicked", name: "Link Clicked", icon: MousePointerClick, category: "trigger", description: "When a link in an email is clicked" },
      { id: "not_opened", name: "Not Opened", icon: Clock, category: "trigger", description: "When an email remains unopened" },
      { id: "new_subscriber", name: "New Subscriber", icon: UserPlus, category: "trigger", description: "When someone joins your list" },
      { id: "no_reply", name: "No Reply", icon: Clock, category: "trigger", description: "When no reply is received" },
      { id: "bounced", name: "Email Bounced", icon: AlertTriangle, category: "trigger", description: "When an email bounces" },
      { id: "scheduled", name: "Scheduled Date", icon: Calendar, category: "trigger", description: "Trigger at a specific date/time" },
      { id: "inactive", name: "Inactive Subscriber", icon: UserX, category: "trigger", description: "When a subscriber becomes inactive" },
    ],
  },
  {
    category: "delay",
    label: "Delays",
    nodes: [
      { id: "wait_1h", name: "Wait 1 Hour", icon: Timer, category: "delay", description: "Pause for 1 hour" },
      { id: "wait_1d", name: "Wait 1 Day", icon: Timer, category: "delay", description: "Pause for 1 day" },
      { id: "wait_3d", name: "Wait 3 Days", icon: Timer, category: "delay", description: "Pause for 3 days" },
      { id: "wait_1w", name: "Wait 1 Week", icon: Timer, category: "delay", description: "Pause for 1 week" },
      { id: "wait_custom", name: "Custom Delay", icon: Clock, category: "delay", description: "Set a custom wait duration" },
    ],
  },
  {
    category: "action",
    label: "Actions",
    nodes: [
      { id: "send_email", name: "Send Email", icon: Send, category: "action", description: "Send an email to the contact" },
      { id: "send_reengagement", name: "Re-engagement Email", icon: Send, category: "action", description: "Send a win-back email" },
      { id: "add_tag", name: "Add Tag", icon: Tag, category: "action", description: "Tag the contact for segmentation" },
      { id: "move_list", name: "Move to List", icon: Users, category: "action", description: "Move contact to another list" },
      { id: "notify", name: "Send Notification", icon: Bell, category: "action", description: "Notify your team" },
      { id: "webhook", name: "Trigger Webhook", icon: Webhook, category: "action", description: "Send data to an external URL" },
      { id: "mark_churned", name: "Mark as Churned", icon: UserX, category: "action", description: "Flag contact as churned" },
    ],
  },
  {
    category: "condition",
    label: "Conditions",
    nodes: [
      { id: "if_opened", name: "If Opened", icon: GitBranch, category: "condition", description: "Branch based on open status" },
      { id: "if_clicked", name: "If Clicked", icon: GitBranch, category: "condition", description: "Branch based on click status" },
      { id: "if_tag", name: "Has Tag", icon: GitBranch, category: "condition", description: "Branch based on contact tag" },
    ],
  },
];

interface NodePaletteProps {
  onDragStart: (node: NodeConfig) => void;
  onDragEnd: () => void;
}

export const NodePalette = ({ onDragStart, onDragEnd }: NodePaletteProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["trigger"])
  );
  const [search, setSearch] = useState("");

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return nodeCategories;
    const q = search.toLowerCase();
    return nodeCategories
      .map((cat) => ({
        ...cat,
        nodes: cat.nodes.filter(
          (n) =>
            n.name.toLowerCase().includes(q) ||
            n.description?.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.nodes.length > 0);
  }, [search]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const categoryIcons = {
    trigger: Zap,
    delay: Timer,
    action: Send,
    condition: GitBranch,
  };

  return (
    <div className="w-64 shrink-0 border-r border-border/50 bg-card/40 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Components</h3>
            <p className="text-[10px] text-muted-foreground">Drag to canvas</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredCategories.map((cat) => {
          const styles = nodeStyles[cat.category];
          const isExpanded = search.trim()
            ? true
            : expandedCategories.has(cat.category);
          const CatIcon = categoryIcons[cat.category];

          return (
            <div key={cat.category} className="rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory(cat.category)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-xl transition-all",
                  isExpanded
                    ? cn(styles.bg, "border", styles.border)
                    : "hover:bg-secondary/60"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-md flex items-center justify-center shrink-0",
                    isExpanded ? styles.iconBg : "bg-muted"
                  )}
                >
                  <CatIcon
                    className={cn(
                      "w-3 h-3",
                      isExpanded ? styles.iconColor : "text-muted-foreground"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "flex-1 text-left",
                    isExpanded ? styles.iconColor : "text-foreground"
                  )}
                >
                  {cat.label}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {cat.nodes.length}
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform text-muted-foreground",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="py-1.5 px-1 space-y-1">
                      {cat.nodes.map((node) => (
                        <motion.div
                          key={node.id}
                          draggable
                          onDragStart={() => onDragStart(node)}
                          onDragEnd={onDragEnd}
                          whileHover={{ x: 2, transition: { duration: 0.15 } }}
                          whileTap={{ scale: 0.97 }}
                          className={cn(
                            "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing",
                            "border border-transparent transition-all duration-200",
                            "hover:border-border/50 hover:bg-secondary/40 hover:shadow-sm"
                          )}
                        >
                          <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 transition-colors" />
                          <div
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                              styles.iconBg,
                              "group-hover:shadow-sm"
                            )}
                          >
                            <node.icon
                              className={cn("w-4 h-4", styles.iconColor)}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">
                              {node.name}
                            </p>
                            {node.description && (
                              <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                {node.description}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {filteredCategories.length === 0 && (
          <div className="text-center py-8">
            <Search className="w-5 h-5 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No nodes found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { nodeCategories };
