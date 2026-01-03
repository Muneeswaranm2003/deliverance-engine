import { motion } from "framer-motion";
import { Upload, Settings, Rocket, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Upload Your List",
    description: "Import contacts via CSV or API. Automatic validation and deduplication.",
  },
  {
    icon: Settings,
    step: "02",
    title: "Configure Domains",
    description: "Set up multiple sending domains with automatic IP rotation and warm-up.",
  },
  {
    icon: Rocket,
    step: "03",
    title: "Launch Campaign",
    description: "Schedule delivery with ML-optimized send times for maximum engagement.",
  },
  {
    icon: BarChart3,
    step: "04",
    title: "Analyze Results",
    description: "Real-time analytics with bounce handling and engagement scoring.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      <div className="container relative z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Simple to Start,
            <span className="text-gradient"> Powerful to Scale</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Get your first campaign running in minutes with our intuitive workflow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-16 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          
          {steps.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="relative text-center"
            >
              <div className="relative inline-flex mb-6">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center border border-border relative z-10">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-glow">
                  {step.step}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
