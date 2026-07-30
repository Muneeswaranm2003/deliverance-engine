import * as React from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

export type AnalyticsRange = {
  from: Date;
  to: Date;
  /** number of days spanned, inclusive */
  days: number;
  label: string;
};

export const makePresetRange = (days: number, label: string): AnalyticsRange => ({
  from: startOfDay(subDays(new Date(), days - 1)),
  to: endOfDay(new Date()),
  days,
  label,
});

const PRESETS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

interface DateRangeFilterProps {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
  className?: string;
}

export const DateRangeFilter = ({ value, onChange, className }: DateRangeFilterProps) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>({ from: value.from, to: value.to });

  const isCustom = !PRESETS.some((p) => p.label === value.label);

  const applyDraft = (range: DateRange | undefined) => {
    setDraft(range);
    if (!range?.from || !range?.to) return;
    const from = startOfDay(range.from);
    const to = endOfDay(range.to);
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
    onChange({
      from,
      to,
      days,
      label: `${format(from, "MMM d")} – ${format(to, "MMM d")}`,
    });
    setOpen(false);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {PRESETS.map((p) => (
        <Button
          key={p.label}
          size="sm"
          variant={value.label === p.label ? "default" : "outline"}
          className="h-8 px-3 text-xs"
          onClick={() => onChange(makePresetRange(p.days, p.label))}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={isCustom ? "default" : "outline"}
            className="h-8 px-3 text-xs gap-1.5"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {isCustom ? value.label : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={applyDraft}
            numberOfMonths={1}
            disabled={{ after: new Date() }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};