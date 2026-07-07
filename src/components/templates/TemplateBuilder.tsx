import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Underline,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Minus,
  MousePointer2,
  User,
  Sparkles,
  Eye,
  Code2,
  Copy,
  Monitor,
  Smartphone,
  Undo2,
  Redo2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface TemplateDraft {
  name: string;
  subject: string;
  preheader?: string;
  content: string;
  category: string;
}

interface TemplateBuilderProps {
  value: TemplateDraft;
  onChange: (patch: Partial<TemplateDraft>) => void;
  categories: string[];
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

const TAGS = [
  { label: "First Name", tag: "{{firstName}}", sample: "John" },
  { label: "Last Name", tag: "{{lastName}}", sample: "Doe" },
  { label: "Email", tag: "{{email}}", sample: "john@example.com" },
  { label: "Company", tag: "{{company}}", sample: "Acme Inc" },
  { label: "Unsubscribe", tag: "{{unsubscribe_link}}", sample: "#unsubscribe" },
];

const BLOCKS: { id: string; label: string; snippet: string }[] = [
  { id: "heading", label: "Heading", snippet: '<h2 style="font-family:sans-serif;font-size:22px;margin:16px 0;">Your heading</h2>\n' },
  { id: "paragraph", label: "Paragraph", snippet: '<p style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#334155;">Write something engaging…</p>\n' },
  { id: "button", label: "Button", snippet: '<p><a href="https://example.com" style="display:inline-block;padding:12px 22px;background:#3B82F6;color:#fff;border-radius:8px;text-decoration:none;font-family:sans-serif;font-weight:600;">Call to action</a></p>\n' },
  { id: "image", label: "Image", snippet: '<p><img src="https://placehold.co/600x240" alt="" style="max-width:100%;border-radius:8px;" /></p>\n' },
  { id: "divider", label: "Divider", snippet: '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />\n' },
  { id: "spacer", label: "Spacer", snippet: '<div style="height:24px;"></div>\n' },
  { id: "quote", label: "Quote", snippet: '<blockquote style="border-left:3px solid #3B82F6;padding:8px 14px;color:#475569;font-style:italic;margin:16px 0;">A short customer quote here.</blockquote>\n' },
  { id: "signature", label: "Signature", snippet: '<p style="font-family:sans-serif;font-size:14px;color:#475569;">Cheers,<br/>The {{company}} team</p>\n' },
];

const renderPreview = (html: string) =>
  html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const t = TAGS.find((x) => x.tag === `{{${key}}}`);
    return t?.sample ?? `{{${key}}}`;
  });

export const TemplateBuilder = ({
  value,
  onChange,
  categories,
  onSubmit,
  onCancel,
  submitLabel,
}: TemplateBuilderProps) => {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [view, setView] = useState<"split" | "code" | "preview">("split");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const historyRef = useRef<{ stack: string[]; index: number }>({ stack: [value.content], index: 0 });

  useEffect(() => {
    const h = historyRef.current;
    if (h.stack[h.index] !== value.content) {
      h.stack = [...h.stack.slice(0, h.index + 1), value.content].slice(-50);
      h.index = h.stack.length - 1;
    }
  }, [value.content]);

  const insertAtCursor = (text: string, wrap = false) => {
    const ta = textareaRef.current;
    const current = value.content;
    if (!ta) {
      onChange({ content: current + text });
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    let next: string;
    let caret: number;
    if (wrap && start !== end) {
      const [open, close] = text.split("|");
      next = current.slice(0, start) + open + current.slice(start, end) + close + current.slice(end);
      caret = end + open.length + close.length;
    } else {
      const clean = text.replace("|", "");
      next = current.slice(0, start) + clean + current.slice(end);
      caret = start + clean.length;
    }
    onChange({ content: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  };

  const undo = () => {
    const h = historyRef.current;
    if (h.index > 0) {
      h.index -= 1;
      onChange({ content: h.stack[h.index] });
    }
  };
  const redo = () => {
    const h = historyRef.current;
    if (h.index < h.stack.length - 1) {
      h.index += 1;
      onChange({ content: h.stack[h.index] });
    }
  };

  const previewHtml = useMemo(() => renderPreview(value.content), [value.content]);
  const previewSubject = useMemo(() => renderPreview(value.subject), [value.subject]);
  const previewPreheader = useMemo(() => renderPreview(value.preheader ?? ""), [value.preheader]);

  const copyHtml = async () => {
    await navigator.clipboard.writeText(value.content);
    toast({ title: "HTML copied to clipboard" });
  };

  const toolBtn = (icon: React.ReactNode, label: string, onClick: () => void) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-8 w-8 p-0"
      title={label}
    >
      {icon}
    </Button>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col h-full min-h-0"
    >
      {/* Meta bar */}
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_180px] p-4 border-b border-border/60 bg-background/50">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name" className="text-xs">Template name</Label>
          <Input
            id="tpl-name"
            placeholder="e.g. Welcome email"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-subject" className="text-xs">Subject line</Label>
          <Input
            id="tpl-subject"
            placeholder="Welcome to {{company}}!"
            value={value.subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={value.category} onValueChange={(v) => onChange({ category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <Label htmlFor="tpl-preheader" className="text-xs">
            Preheader <span className="text-muted-foreground font-normal">— preview text shown in inbox</span>
          </Label>
          <Input
            id="tpl-preheader"
            placeholder="A short teaser that appears next to the subject line"
            value={value.preheader ?? ""}
            onChange={(e) => onChange({ preheader: e.target.value })}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border/60 bg-secondary/30">
        {toolBtn(<Bold className="w-4 h-4" />, "Bold", () => insertAtCursor("<strong>|</strong>", true))}
        {toolBtn(<Italic className="w-4 h-4" />, "Italic", () => insertAtCursor("<em>|</em>", true))}
        {toolBtn(<Underline className="w-4 h-4" />, "Underline", () => insertAtCursor("<u>|</u>", true))}
        {toolBtn(<Heading1 className="w-4 h-4" />, "Heading 1", () => insertAtCursor('<h1 style="font-family:sans-serif;">|</h1>', true))}
        {toolBtn(<Heading2 className="w-4 h-4" />, "Heading 2", () => insertAtCursor('<h2 style="font-family:sans-serif;">|</h2>', true))}
        {toolBtn(<LinkIcon className="w-4 h-4" />, "Link", () => insertAtCursor('<a href="https://">|</a>', true))}
        {toolBtn(<List className="w-4 h-4" />, "Bulleted list", () => insertAtCursor("<ul>\n  <li>Item</li>\n</ul>\n"))}
        {toolBtn(<ListOrdered className="w-4 h-4" />, "Numbered list", () => insertAtCursor("<ol>\n  <li>Item</li>\n</ol>\n"))}
        {toolBtn(<Quote className="w-4 h-4" />, "Quote", () => insertAtCursor(BLOCKS.find(b => b.id === "quote")!.snippet))}
        {toolBtn(<Minus className="w-4 h-4" />, "Divider", () => insertAtCursor(BLOCKS.find(b => b.id === "divider")!.snippet))}
        {toolBtn(<ImageIcon className="w-4 h-4" />, "Image", () => insertAtCursor(BLOCKS.find(b => b.id === "image")!.snippet))}
        {toolBtn(<MousePointer2 className="w-4 h-4" />, "Button", () => insertAtCursor(BLOCKS.find(b => b.id === "button")!.snippet))}

        <div className="w-px h-6 bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs">Blocks</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Insert block</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {BLOCKS.map((b) => (
              <DropdownMenuItem key={b.id} onClick={() => insertAtCursor(b.snippet)}>
                {b.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5">
              <User className="w-4 h-4" />
              <span className="text-xs">Personalize</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Merge tags</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TAGS.map((t) => (
              <DropdownMenuItem key={t.tag} onClick={() => insertAtCursor(t.tag)}>
                <span className="flex-1">{t.label}</span>
                <code className="text-[10px] text-muted-foreground">{t.tag}</code>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border mx-1" />
        {toolBtn(<Undo2 className="w-4 h-4" />, "Undo", undo)}
        {toolBtn(<Redo2 className="w-4 h-4" />, "Redo", redo)}

        <div className="ml-auto flex items-center gap-1">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList className="h-8">
              <TabsTrigger value="split" className="h-6 px-2 text-xs gap-1">
                <Code2 className="w-3.5 h-3.5" /> Split
              </TabsTrigger>
              <TabsTrigger value="code" className="h-6 px-2 text-xs gap-1">
                <Code2 className="w-3.5 h-3.5" /> Code
              </TabsTrigger>
              <TabsTrigger value="preview" className="h-6 px-2 text-xs gap-1">
                <Eye className="w-3.5 h-3.5" /> Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex rounded-md border border-border overflow-hidden ml-1">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={cn("p-1.5", device === "desktop" ? "bg-primary/20 text-primary" : "text-muted-foreground")}
              title="Desktop preview"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={cn("p-1.5", device === "mobile" ? "bg-primary/20 text-primary" : "text-muted-foreground")}
              title="Mobile preview"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={copyHtml} className="h-8 gap-1.5" title="Copy HTML">
            <Copy className="w-3.5 h-3.5" />
            <span className="text-xs">HTML</span>
          </Button>
        </div>
      </div>

      {/* Editor / preview */}
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: view === "split" ? "1fr 1fr" : "1fr" }}>
        {view !== "preview" && (
          <div className="border-r border-border/60 flex flex-col min-h-0">
            <Textarea
              ref={textareaRef}
              value={value.content}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="Write HTML, or use the toolbar to insert blocks…"
              className="flex-1 min-h-[420px] rounded-none border-0 font-mono text-xs resize-none focus-visible:ring-0"
              required
            />
          </div>
        )}
        {view !== "code" && (
          <div className="bg-muted/30 overflow-auto p-6 flex justify-center">
            <div
              className={cn(
                "bg-white text-slate-900 shadow-elevated rounded-lg w-full transition-all",
                device === "mobile" ? "max-w-[380px]" : "max-w-[640px]"
              )}
            >
              <div className="border-b border-slate-200 px-5 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Subject</p>
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {previewSubject || "Untitled subject"}
                </p>
                {previewPreheader && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{previewPreheader}</p>
                )}
              </div>
              <div
                className="p-6 text-sm leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
                dangerouslySetInnerHTML={{
                  __html:
                    previewHtml ||
                    '<p class="text-slate-400">Your email will appear here as you type…</p>',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 p-3 border-t border-border/60 bg-background/60">
        <div className="text-xs text-muted-foreground">
          <Badge variant="outline" className="mr-2">{value.content.length} chars</Badge>
          <span>Tip: use merge tags for personalization.</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="hero">{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
};

export default TemplateBuilder;