import { useState } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { 
  CalendarIcon, 
  Clock, 
  Zap, 
  Send,
  Timer,
  Settings2
} from "lucide-react";

interface SchedulingOptionsProps {
  scheduleType: "now" | "later";
  onScheduleTypeChange: (type: "now" | "later") => void;
  scheduledDate: Date | undefined;
  onScheduledDateChange: (date: Date | undefined) => void;
  scheduledTime: string;
  onScheduledTimeChange: (time: string) => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  batchSize: number;
  onBatchSizeChange: (size: number) => void;
  batchDelay: number;
  onBatchDelayChange: (delay: number) => void;
}

const timezones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const SchedulingOptions = ({
  scheduleType,
  onScheduleTypeChange,
  scheduledDate,
  onScheduledDateChange,
  scheduledTime,
  onScheduledTimeChange,
  timezone,
  onTimezoneChange,
  batchSize,
  onBatchSizeChange,
  batchDelay,
  onBatchDelayChange,
}: SchedulingOptionsProps) => {
  return (
    <div className="space-y-8">
      {/* Send Time */}
      <div className="space-y-4">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          When to Send
        </Label>

        <RadioGroup
          value={scheduleType}
          onValueChange={(v) => onScheduleTypeChange(v as "now" | "later")}
          className="grid grid-cols-2 gap-4"
        >
          <Label
            htmlFor="send-now"
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              scheduleType === "now"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <RadioGroupItem value="now" id="send-now" />
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Send Now</p>
                <p className="text-sm text-muted-foreground">Start sending immediately</p>
              </div>
            </div>
          </Label>

          <Label
            htmlFor="send-later"
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
              scheduleType === "later"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <RadioGroupItem value="later" id="send-later" />
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Schedule</p>
                <p className="text-sm text-muted-foreground">Pick a date & time</p>
              </div>
            </div>
          </Label>
        </RadioGroup>

        {scheduleType === "later" && (
          <div className="grid md:grid-cols-3 gap-4 pt-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={onScheduledDateChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => onScheduledTimeChange(e.target.value)}
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={onTimezoneChange}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Throttling Settings */}
      <div className="space-y-4">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          Delivery Settings
        </Label>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Batch Size</Label>
            <Select
              value={batchSize.toString()}
              onValueChange={(v) => onBatchSizeChange(parseInt(v))}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 emails per batch</SelectItem>
                <SelectItem value="25">25 emails per batch</SelectItem>
                <SelectItem value="50">50 emails per batch</SelectItem>
                <SelectItem value="100">100 emails per batch</SelectItem>
                <SelectItem value="250">250 emails per batch</SelectItem>
                <SelectItem value="500">500 emails per batch</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Number of emails to send in each batch
            </p>
          </div>

          <div className="space-y-2">
            <Label>Delay Between Batches</Label>
            <Select
              value={batchDelay.toString()}
              onValueChange={(v) => onBatchDelayChange(parseInt(v))}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No delay</SelectItem>
                <SelectItem value="30">30 seconds</SelectItem>
                <SelectItem value="60">1 minute</SelectItem>
                <SelectItem value="120">2 minutes</SelectItem>
                <SelectItem value="300">5 minutes</SelectItem>
                <SelectItem value="600">10 minutes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Wait time between sending batches
            </p>
          </div>
        </div>

        <div className="bg-secondary/30 rounded-lg p-4 border border-border">
          <div className="flex items-start gap-3">
            <Send className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Estimated Delivery</p>
              <p className="text-sm text-muted-foreground">
                With current settings, your campaign will be delivered in approximately{" "}
                <span className="text-foreground font-medium">
                  {batchDelay === 0 ? "a few minutes" : `${Math.ceil((batchSize * batchDelay) / 60)} minutes`}
                </span>{" "}
                for every 1,000 recipients.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulingOptions;
