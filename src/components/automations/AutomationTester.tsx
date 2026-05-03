import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Mail,
  MousePointerClick,
  UserPlus,
  Tag,
  Send,
  Loader2,
  Eye,
  EyeOff,
  Download,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlowStep {
  type: "trigger" | "delay" | "action";
  nodeType: string;
  label: string;
}

interface AutomationTesterProps {
  steps: FlowStep[];
  automationName: string;
}

interface TestExecution {
  id: string;
  stepIndex: number;
  status: "pending" | "running" | "completed" | "error";
  timestamp: Date;
  duration: number;
  result?: string;
  error?: string;
}

const iconMap: Record<string, typeof Zap> = {
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

const generateMockResult = (nodeType: string, stepIndex: number) => {
  const results: Record<string, string[]> = {
    email_opened: [
      "✓ Email opened by user",
      "✓ Detected at 2024-04-30 14:32:15 UTC",
      "✓ Device: Chrome on macOS",
    ],
    link_clicked: [
      "✓ Link clicked detected",
      "✓ URL: https://example.com/campaign",
      "✓ Click timestamp: 2024-04-30 14:35:42 UTC",
    ],
    not_opened: [
      "✓ Email not opened after 3 days",
      "✓ Trigger conditions met",
      "✓ Ready for follow-up action",
    ],
    new_subscriber: [
      "✓ New subscriber detected",
      "✓ Added to workflow",
      "✓ Subscription date: 2024-04-30",
    ],
    send_email: [
      "✓ Email queued for sending",
      "✓ To: user@example.com",
      "✓ Subject: Follow-up Message",
      "✓ Scheduled for immediate delivery",
    ],
    add_tag: [
      "✓ Tag 'engaged' added to contact",
      "✓ 15 contacts tagged",
      "✓ Tags: engaged, opened, premium",
    ],
    move_list: [
      "✓ Contacts moved to VIP list",
      "✓ 8 contacts processed",
      "✓ Previous list: Main",
      "✓ New list: VIP Subscribers",
    ],
    wait_1d: ["⏳ Waiting 1 day before next step"],
    wait_2d: ["⏳ Waiting 2 days before next step"],
    wait_3d: ["⏳ Waiting 3 days before next step"],
    send_reengagement: [
      "✓ Re-engagement email sent",
      "✓ Recipients: 42 inactive subscribers",
      "✓ Campaign: Re-engagement Wave 1",
    ],
  };

  return results[nodeType] || [
    `✓ Step ${stepIndex + 1} executed successfully`,
    "✓ No errors detected",
  ];
};

export const AutomationTester = ({
  steps,
  automationName,
}: AutomationTesterProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [showDetails, setShowDetails] = useState(true);
  const [testResults, setTestResults] = useState<Map<number, string[]>>(
    new Map()
  );

  const runTest = useCallback(async () => {
    if (steps.length === 0) return;

    setIsRunning(true);
    setCurrentStep(0);
    setExecutions([]);
    setTestResults(new Map());

    // Execute each step sequentially
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const execution: TestExecution = {
        id: `exec-${Date.now()}-${i}`,
        stepIndex: i,
        status: "running",
        timestamp: new Date(),
        duration: 0,
      };

      setExecutions((prev) => [...prev, execution]);
      setCurrentStep(i);

      // Simulate execution time
      const delay = step.type === "delay" ? 500 : Math.random() * 1000 + 500;
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Generate mock result
      const result = generateMockResult(step.nodeType, i);
      setTestResults((prev) => new Map([...prev, [i, result]]));

      // Update execution status
      setExecutions((prev) =>
        prev.map((ex) =>
          ex.stepIndex === i
            ? {
                ...ex,
                status: "completed",
                duration: delay,
                result: result.join("\n"),
              }
            : ex
        )
      );
    }

    setIsRunning(false);
    setCurrentStep(-1);
  }, [steps]);

  const resetTest = () => {
    setIsRunning(false);
    setExecutions([]);
    setCurrentStep(-1);
    setTestResults(new Map());
  };

  const exportResults = () => {
    const resultsText = executions
      .map((ex) => `Step ${ex.stepIndex + 1}: ${ex.result || "Pending"}`)
      .join("\n\n");

    const blob = new Blob([resultsText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automation-test-${automationName}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyResults = () => {
    const resultsText = executions
      .map((ex) => `Step ${ex.stepIndex + 1}: ${ex.result || "Pending"}`)
      .join("\n\n");

    navigator.clipboard.writeText(resultsText);
  };

  const overallStatus = executions.length > 0
    ? executions.every((ex) => ex.status === "completed")
      ? "success"
      : executions.some((ex) => ex.status === "error")
      ? "error"
      : "running"
    : "idle";

  const completedSteps = executions.filter(
    (ex) => ex.status === "completed"
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            Test Automation Flow
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Preview how your automation will execute without affecting real data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {executions.length > 0 && (
            <div className="text-right text-xs">
              <p className="font-medium">
                {completedSteps}/{steps.length} steps
              </p>
              <p className="text-muted-foreground">
                {overallStatus === "success" && "✓ Test passed"}
                {overallStatus === "running" && "⏳ Running..."}
                {overallStatus === "error" && "✗ Error detected"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={runTest}
          disabled={isRunning || steps.length === 0}
          className="gap-2 h-9"
          size="sm"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Test
            </>
          )}
        </Button>

        <Button
          onClick={resetTest}
          variant="outline"
          disabled={executions.length === 0}
          className="gap-2 h-9"
          size="sm"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>

        {executions.length > 0 && (
          <>
            <Button
              onClick={copyResults}
              variant="outline"
              className="gap-2 h-9"
              size="sm"
            >
              <Copy className="w-4 h-4" />
              Copy
            </Button>

            <Button
              onClick={exportResults}
              variant="outline"
              className="gap-2 h-9"
              size="sm"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="h-9 ml-auto"
        >
          {showDetails ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Test Results */}
      {steps.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              Add steps to your automation to start testing
            </p>
          </CardContent>
        </Card>
      ) : executions.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-6 text-center">
            <Zap className="w-8 h-8 mx-auto text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              Click "Run Test" to simulate your automation workflow
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Test Progress</span>
              <span className="text-muted-foreground">
                {completedSteps} of {steps.length} steps
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <motion.div
                className={cn(
                  "h-full transition-all duration-300",
                  overallStatus === "success" && "bg-emerald-500",
                  overallStatus === "running" && "bg-primary",
                  overallStatus === "error" && "bg-destructive"
                )}
                initial={{ width: 0 }}
                animate={{
                  width: `${(completedSteps / steps.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Step Results */}
          <AnimatePresence>
            {steps.map((step, idx) => {
              const execution = executions.find((ex) => ex.stepIndex === idx);
              const result = testResults.get(idx);
              const Icon = (iconMap[step.nodeType] as any) || Zap;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card
                    className={cn(
                      "glass transition-all duration-300",
                      execution?.status === "running" && "ring-2 ring-primary",
                      execution?.status === "completed" &&
                        "border-emerald-500/50 bg-emerald-500/5",
                      execution?.status === "error" &&
                        "border-destructive/50 bg-destructive/5"
                    )}
                  >
                    <CardContent className="p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            {execution?.status === "running" ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            ) : execution?.status === "completed" ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : execution?.status === "error" ? (
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            ) : (
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-medium text-sm">
                                Step {idx + 1}: {step.label}
                              </p>
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 capitalize"
                              >
                                {step.type}
                              </Badge>
                              {execution && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    execution.status === "completed" &&
                                      "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
                                    execution.status === "running" &&
                                      "border-primary/50 text-primary",
                                    execution.status === "error" &&
                                      "border-destructive/50 text-destructive"
                                  )}
                                >
                                  {execution.status === "running" &&
                                    "⏳ In Progress"}
                                  {execution.status === "completed" &&
                                    `✓ Completed (${execution.duration}ms)`}
                                  {execution.status === "error" && "✗ Error"}
                                  {execution.status === "pending" &&
                                    "⏳ Pending"}
                                </Badge>
                              )}
                            </div>
                            {showDetails && result && (
                              <div className="space-y-1 mt-2">
                                {result.map((line, lineIdx) => (
                                  <div
                                    key={lineIdx}
                                    className="text-xs text-muted-foreground font-mono px-2 py-1 rounded bg-muted/50"
                                  >
                                    {line}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Summary */}
          {overallStatus !== "running" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card
                className={cn(
                  "glass",
                  overallStatus === "success" &&
                    "border-emerald-500/30 bg-emerald-500/5",
                  overallStatus === "error" && "border-destructive/30 bg-destructive/5"
                )}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-2">
                    {overallStatus === "success" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {overallStatus === "success"
                          ? "✓ Test Passed!"
                          : "✗ Test Failed"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {completedSteps} of {steps.length} steps executed
                        successfully
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
