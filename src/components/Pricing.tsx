import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "Perfect for growing businesses",
    features: [
      "Up to 50,000 emails/month",
      "2 sending domains",
      "Basic analytics",
      "Email support",
      "CSV uploads",
      "Bounce handling",
    ],
    cta: "Start Free Trial",
    featured: false,
  },
  {
    name: "Pro",
    price: "$199",
    period: "/month",
    description: "For high-volume senders",
    features: [
      "Up to 500,000 emails/month",
      "5 sending domains",
      "Advanced analytics",
      "Priority support",
      "API access",
      "ML deliverability scoring",
      "CRM integrations",
      "Custom webhooks",
    ],
    cta: "Start Free Trial",
    featured: true,
  },
  {
    name: "Agency",
    price: "$499",
    period: "/month",
    description: "Enterprise-grade features",
    features: [
      "Unlimited emails",
      "10 sending domains",
      "Full analytics suite",
      "Dedicated support",
      "Full API access",
      "All ML features",
      "White-label options",
      "Custom storage integration",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    featured: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 relative">
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
            Transparent
            <span className="text-gradient"> Pricing</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Choose the plan that fits your sending volume. All plans include our core deliverability features.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={`relative rounded-2xl p-8 ${
                plan.featured 
                  ? "glass-strong border-primary/30 shadow-glow" 
                  : "glass"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Most Popular
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="font-display text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant={plan.featured ? "hero" : "outline"} 
                className="w-full"
                size="lg"
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
