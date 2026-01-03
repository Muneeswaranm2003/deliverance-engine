import { motion } from "framer-motion";
import { 
  Send, 
  Shield, 
  RefreshCcw, 
  AlertTriangle, 
  Link2, 
  Code2, 
  Brain,
  Database
} from "lucide-react";

const features = [
  {
    icon: Send,
    title: "Bulk Email Sending",
    description: "Batch-wise controlled delivery with throttling, scheduling, and intelligent queue processing.",
  },
  {
    icon: Database,
    title: "Customer-Owned Storage",
    description: "Your data stays in your S3-compatible storage. We only store encrypted metadata.",
  },
  {
    icon: RefreshCcw,
    title: "Multi-Domain Rotation",
    description: "Up to 10 domain/IP configurations with automatic rotation on reputation drops.",
  },
  {
    icon: AlertTriangle,
    title: "Bounce Handling",
    description: "Real-time webhook processing for bounces, unsubscribes, and spam complaints.",
  },
  {
    icon: Link2,
    title: "CRM Integrations",
    description: "Native connectors with two-way sync for contacts and engagement status.",
  },
  {
    icon: Code2,
    title: "Full REST API",
    description: "Complete API coverage with JWT authentication, rate limiting, and usage tracking.",
  },
  {
    icon: Brain,
    title: "ML-Powered Insights",
    description: "Deliverability scoring, bounce prediction, and send-time optimization.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "GDPR & CAN-SPAM compliant with encryption at rest and in transit.",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      
      <div className="container relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need to
            <span className="text-gradient"> Scale Email</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Enterprise features designed for high-volume senders who prioritize deliverability and data privacy.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group p-6 rounded-2xl glass hover:border-primary/30 transition-all duration-300 hover:shadow-card"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
