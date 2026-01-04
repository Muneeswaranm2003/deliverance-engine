import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bold, 
  Italic, 
  Link, 
  Image, 
  Code, 
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye
} from "lucide-react";

interface EmailTemplateEditorProps {
  subject: string;
  onSubjectChange: (value: string) => void;
  content: string;
  onContentChange: (value: string) => void;
}

const EmailTemplateEditor = ({
  subject,
  onSubjectChange,
  content,
  onContentChange,
}: EmailTemplateEditorProps) => {
  const [activeTab, setActiveTab] = useState("edit");

  const insertTag = (tag: string) => {
    const textarea = document.getElementById("email-content") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + tag + content.slice(end);
      onContentChange(newContent);
    }
  };

  const toolbarButtons = [
    { icon: Bold, label: "Bold", action: () => insertTag("<b></b>") },
    { icon: Italic, label: "Italic", action: () => insertTag("<i></i>") },
    { icon: Link, label: "Link", action: () => insertTag('<a href="">Link</a>') },
    { icon: Image, label: "Image", action: () => insertTag('<img src="" alt="" />') },
    { icon: Code, label: "Code", action: () => insertTag("<code></code>") },
    { icon: List, label: "List", action: () => insertTag("<ul>\n  <li></li>\n</ul>") },
  ];

  const alignButtons = [
    { icon: AlignLeft, label: "Left", action: () => insertTag('<div style="text-align: left;"></div>') },
    { icon: AlignCenter, label: "Center", action: () => insertTag('<div style="text-align: center;"></div>') },
    { icon: AlignRight, label: "Right", action: () => insertTag('<div style="text-align: right;"></div>') },
  ];

  const personalizationTags = [
    { label: "First Name", tag: "{{first_name}}" },
    { label: "Last Name", tag: "{{last_name}}" },
    { label: "Email", tag: "{{email}}" },
    { label: "Company", tag: "{{company}}" },
    { label: "Unsubscribe Link", tag: "{{unsubscribe_link}}" },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="subject">Email Subject</Label>
        <Input
          id="subject"
          placeholder="Enter email subject line..."
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="bg-secondary/50"
        />
        <p className="text-xs text-muted-foreground">
          Use personalization tags like {"{{first_name}}"} for dynamic content
        </p>
      </div>

      <div className="space-y-2">
        <Label>Email Content</Label>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="edit" className="mt-4 space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-secondary/30 rounded-lg border border-border">
              {toolbarButtons.map((btn) => (
                <Button
                  key={btn.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={btn.action}
                  className="h-8 w-8 p-0"
                  title={btn.label}
                >
                  <btn.icon className="w-4 h-4" />
                </Button>
              ))}
              <div className="w-px h-6 bg-border mx-1" />
              {alignButtons.map((btn) => (
                <Button
                  key={btn.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={btn.action}
                  className="h-8 w-8 p-0"
                  title={btn.label}
                >
                  <btn.icon className="w-4 h-4" />
                </Button>
              ))}
              <div className="w-px h-6 bg-border mx-1" />
              <div className="flex flex-wrap gap-1">
                {personalizationTags.map((tag) => (
                  <Button
                    key={tag.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertTag(tag.tag)}
                    className="h-7 text-xs"
                  >
                    {tag.label}
                  </Button>
                ))}
              </div>
            </div>

            <Textarea
              id="email-content"
              placeholder="Write your email content here... You can use HTML and personalization tags."
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              className="min-h-[400px] bg-secondary/50 font-mono text-sm"
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="bg-secondary/30 rounded-lg border border-border p-6 min-h-[400px]">
              <div className="bg-background rounded-lg p-6 max-w-2xl mx-auto shadow-elevated">
                <div className="mb-4 pb-4 border-b border-border">
                  <p className="text-sm text-muted-foreground">Subject:</p>
                  <p className="font-medium">
                    {subject.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                      const previews: Record<string, string> = {
                        first_name: "John",
                        last_name: "Doe",
                        email: "john@example.com",
                        company: "Acme Inc",
                      };
                      return previews[key] || `{{${key}}}`;
                    }) || "No subject"}
                  </p>
                </div>
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                      const previews: Record<string, string> = {
                        first_name: "John",
                        last_name: "Doe",
                        email: "john@example.com",
                        company: "Acme Inc",
                        unsubscribe_link: "#unsubscribe",
                      };
                      return previews[key] || `{{${key}}}`;
                    }) || "<p class='text-muted-foreground'>Start writing your email content...</p>",
                  }}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EmailTemplateEditor;
