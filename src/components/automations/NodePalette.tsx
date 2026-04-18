import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
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
  ChevronRight,
  Search,
  ArrowRightLeft,
  Wrench,
  Sparkles,
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
    label: "Logic",
    nodes: [
      { id: "if_opened", name: "If Opened", icon: GitBranch, category: "condition", description: "Branch based on open status" },
      { id: "if_clicked", name: "If Clicked", icon: GitBranch, category: "condition", description: "Branch based on click status" },
      { id: "if_tag", name: "Has Tag", icon: GitBranch, category: "condition", description: "Branch based on contact tag" },
    ],
  },
];

interface PaletteItemProps {
  node: NodeConfig;
  onAddClick: (node: NodeConfig) => void;
}

const PaletteItem = ({ node, onAddClick }: PaletteItemProps) => {
  const styles = nodeStyles[node.category];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${node.id}`,
    data: { source: "palette", node },
  });

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      whileHover={{ x: 2, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-md cursor-grab active:cursor-grabbing",
        "border-l border-border/40 transition-all duration-200",
        "hover:border-l-primary/60 hover:bg-secondary/40",
        isDragging && "opacity-40"
      )}
      data-testid={`palette-node-${node.id}`}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
          styles.iconBg
        )}
      >
        <node.icon className={cn("w-3 h-3", styles.iconColor)} />
      </div>
      <p className="text-[12px] font-medium truncate flex-1 text-foreground/85 group-hover:text-foreground">
        {node.name}
      </p>
      {/* Click-to-add fallback button (also helps automation) */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAddClick(node);
        }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition-opacity"
        aria-label={`Add ${node.name}`}
        data-testid={`palette-add-${node.id}`}
      >
        +
      </button>
    </motion.div>
  );
};

interface NodePaletteProps {
  onAddNode: (node: NodeConfig) => void;
}

export const NodePalette = ({ onAddNode }: NodePaletteProps) => {
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
    trigger: ArrowRightLeft,
    delay: Timer,
    action: Send,
    condition: GitBranch,
  };

  return (
    <div className="w-64 shrink-0 border-r border-border/40 bg-[hsl(var(--card))]/80 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border/40">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-8 text-xs bg-secondary/40 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/40"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground border border-border/40 font-mono">
            /
          </kbd>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
            Components
          </span>
          <Sparkles className="w-3 h-3 text-muted-foreground/50" />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {filteredCategories.map((cat) => {
          const styles = nodeStyles[cat.category];
          const isExpanded = search.trim()
            ? true
            : expandedCategories.has(cat.category);
          const CatIcon = categoryIcons[cat.category];

          return (
            <div key={cat.category}>
              <button
                onClick={() => toggleCategory(cat.category)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-all",
                  "hover:bg-secondary/50",
                  isExpanded && "bg-secondary/30"
                )}
              >
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 text-muted-foreground/60 transition-transform shrink-0",
                    isExpanded && "rotate-90"
                  )}
                />
                <CatIcon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isExpanded ? styles.iconColor : "text-muted-foreground"
                  )}
                />
                <span className="flex-1 text-left text-[13px] font-medium text-foreground/90">
                  {cat.label}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {cat.nodes.length}
                </span>
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
                    <div className="pt-1 pb-1.5 pl-3 space-y-0.5">
                      {cat.nodes.map((node) => (
                        <PaletteItem
                          key={node.id}
                          node={node}
                          onAddClick={onAddNode}
                        />
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

      {/* Footer hint */}
      <div className="px-3 py-2.5 border-t border-border/40 bg-secondary/20">
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-colors">
          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
            <Wrench className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            Discover more components
          </span>
        </button>
      </div>
    </div>
  );
};

export { nodeCategories };
