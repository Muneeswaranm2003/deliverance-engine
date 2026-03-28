import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Send, Users, Zap, FileText, ArrowUpRight } from "lucide-react";

const actions = [
  {
    label: "New Campaign",
    description: "Create & send emails",
    icon: Send,
    href: "/campaigns/new",
    gradient: "from-primary/20 to-primary/5",
    iconColor: "text-primary",
  },
  {
    label: "Add Contacts",
    description: "Import or add manually",
    icon: Users,
    href: "/contacts",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    iconColor: "text-emerald-400",
  },
  {
    label: "Automations",
    description: "Set up email flows",
    icon: Zap,
    href: "/automations",
    gradient: "from-amber-500/20 to-amber-500/5",
    iconColor: "text-amber-400",
  },
  {
    label: "Templates",
    description: "Design email templates",
    icon: FileText,
    href: "/templates",
    gradient: "from-violet-500/20 to-violet-500/5",
    iconColor: "text-violet-400",
  },
];

export const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <h2 className="font-display text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.05 }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(action.href)}
            className={`group relative glass rounded-xl p-4 text-left hover:border-primary/30 transition-all duration-300 overflow-hidden`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <action.icon className={`w-5 h-5 ${action.iconColor}`} />
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="font-display font-semibold text-sm">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};
