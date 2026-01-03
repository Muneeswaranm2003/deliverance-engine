import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Database, 
  Server, 
  Mail, 
  BarChart3, 
  Shield,
  Cpu
} from "lucide-react";

const Architecture = () => {
  const components = [
    { icon: Server, label: "API Gateway", color: "text-primary" },
    { icon: Cpu, label: "Worker Queue", color: "text-yellow-400" },
    { icon: Mail, label: "SMTP Relay", color: "text-green-400" },
    { icon: Database, label: "Customer Storage", color: "text-purple-400" },
    { icon: Shield, label: "Bounce Handler", color: "text-red-400" },
    { icon: BarChart3, label: "ML Engine", color: "text-cyan-400" },
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent" />
      
      <div className="container relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Built for
            <span className="text-gradient"> Enterprise Scale</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            A distributed architecture designed for high-volume email delivery with fault tolerance and real-time processing.
          </p>
        </motion.div>

        {/* Architecture Diagram */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="glass rounded-3xl p-8 md:p-12">
            {/* Flow diagram */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              {components.map((comp, index) => (
                <motion.div
                  key={comp.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="relative"
                >
                  <div className="flex flex-col items-center p-6 rounded-2xl bg-secondary/50 border border-border/50 hover:border-primary/30 transition-all duration-300 group">
                    <div className={`w-12 h-12 rounded-xl bg-card flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${comp.color}`}>
                      <comp.icon className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium text-center">{comp.label}</span>
                  </div>
                  
                  {/* Connection arrows (hidden on small screens) */}
                  {index < components.length - 1 && index !== 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Tech specs */}
            <div className="mt-10 pt-8 border-t border-border/50 grid md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-primary mb-1">10+ Regions</p>
                <p className="text-sm text-muted-foreground">Global Infrastructure</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary mb-1">99.99%</p>
                <p className="text-sm text-muted-foreground">Uptime SLA</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary mb-1">Sub-second</p>
                <p className="text-sm text-muted-foreground">Webhook Delivery</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Architecture;
