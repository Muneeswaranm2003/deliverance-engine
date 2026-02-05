 import { useState } from "react";
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
 } from "lucide-react";
 import { NodeConfig, nodeStyles } from "./flowTypes";
 
 const nodeCategories: { category: "trigger" | "delay" | "action" | "condition"; label: string; nodes: NodeConfig[] }[] = [
   {
     category: "trigger",
     label: "Triggers",
     nodes: [
       { id: "email_opened", name: "Email Opened", icon: Mail, category: "trigger" },
       { id: "link_clicked", name: "Link Clicked", icon: MousePointerClick, category: "trigger" },
       { id: "not_opened", name: "Not Opened", icon: Clock, category: "trigger" },
       { id: "new_subscriber", name: "New Subscriber", icon: UserPlus, category: "trigger" },
       { id: "no_reply", name: "No Reply", icon: Clock, category: "trigger" },
       { id: "bounced", name: "Email Bounced", icon: AlertTriangle, category: "trigger" },
       { id: "scheduled", name: "Scheduled Date", icon: Calendar, category: "trigger" },
       { id: "inactive", name: "Inactive Subscriber", icon: UserX, category: "trigger" },
     ],
   },
   {
     category: "delay",
     label: "Delays",
     nodes: [
       { id: "wait_1h", name: "Wait 1 Hour", icon: Timer, category: "delay" },
       { id: "wait_1d", name: "Wait 1 Day", icon: Timer, category: "delay" },
       { id: "wait_3d", name: "Wait 3 Days", icon: Timer, category: "delay" },
       { id: "wait_1w", name: "Wait 1 Week", icon: Timer, category: "delay" },
       { id: "wait_custom", name: "Custom Delay", icon: Clock, category: "delay" },
     ],
   },
   {
     category: "action",
     label: "Actions",
     nodes: [
       { id: "send_email", name: "Send Email", icon: Send, category: "action" },
       { id: "send_reengagement", name: "Re-engagement Email", icon: Send, category: "action" },
       { id: "add_tag", name: "Add Tag", icon: Tag, category: "action" },
       { id: "move_list", name: "Move to List", icon: Users, category: "action" },
       { id: "notify", name: "Send Notification", icon: Bell, category: "action" },
       { id: "webhook", name: "Trigger Webhook", icon: Webhook, category: "action" },
       { id: "mark_churned", name: "Mark as Churned", icon: UserX, category: "action" },
     ],
   },
   {
     category: "condition",
     label: "Conditions",
     nodes: [
       { id: "if_opened", name: "If Opened", icon: GitBranch, category: "condition" },
       { id: "if_clicked", name: "If Clicked", icon: GitBranch, category: "condition" },
       { id: "if_tag", name: "Has Tag", icon: GitBranch, category: "condition" },
     ],
   },
 ];
 
 interface NodePaletteProps {
   onDragStart: (node: NodeConfig) => void;
   onDragEnd: () => void;
 }
 
 export const NodePalette = ({ onDragStart, onDragEnd }: NodePaletteProps) => {
   const [expandedCategory, setExpandedCategory] = useState<string | null>("trigger");
 
   return (
     <div className="w-56 shrink-0 border-r border-border bg-secondary/30 overflow-y-auto">
       <div className="p-3 border-b border-border">
         <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
           <Zap className="w-3.5 h-3.5" />
           Node Palette
         </h3>
       </div>
       <div className="p-2 space-y-1">
         {nodeCategories.map((cat) => {
           const styles = nodeStyles[cat.category];
           const isExpanded = expandedCategory === cat.category;
 
           return (
             <div key={cat.category} className="rounded-lg overflow-hidden">
               <button
                 onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                 className={cn(
                   "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                   isExpanded ? styles.bg : "hover:bg-secondary/50"
                 )}
               >
                 <span className={isExpanded ? styles.iconColor : "text-foreground"}>
                   {cat.label}
                 </span>
                 <ChevronDown
                   className={cn(
                     "w-4 h-4 transition-transform text-muted-foreground",
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
                     transition={{ duration: 0.2 }}
                     className="overflow-hidden"
                   >
                     <div className="p-1.5 space-y-1">
                       {cat.nodes.map((node) => (
                         <motion.div
                           key={node.id}
                           draggable
                           onDragStart={() => onDragStart(node)}
                           onDragEnd={onDragEnd}
                           whileHover={{ scale: 1.02 }}
                           whileTap={{ scale: 0.98 }}
                           className={cn(
                             "flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing",
                             "border backdrop-blur-sm transition-all",
                             styles.bg,
                             styles.border,
                             "hover:" + styles.glow
                           )}
                         >
                           <div
                             className={cn(
                               "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                               styles.iconBg
                             )}
                           >
                             <node.icon className={cn("w-3.5 h-3.5", styles.iconColor)} />
                           </div>
                           <span className="text-xs font-medium truncate">{node.name}</span>
                         </motion.div>
                       ))}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
           );
         })}
       </div>
     </div>
   );
 };
 
 export { nodeCategories };