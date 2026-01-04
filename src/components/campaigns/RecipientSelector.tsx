import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Users, 
  FileSpreadsheet, 
  X, 
  Check,
  AlertCircle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Recipient {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

interface RecipientSelectorProps {
  recipients: Recipient[];
  onRecipientsChange: (recipients: Recipient[]) => void;
}

const RecipientSelector = ({ recipients, onRecipientsChange }: RecipientSelectorProps) => {
  const [activeTab, setActiveTab] = useState("upload");
  const [manualEmails, setManualEmails] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseCSV = (text: string): Recipient[] => {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return [];

    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const emailIndex = headers.findIndex((h) => h.includes("email"));
    const firstNameIndex = headers.findIndex((h) => h.includes("first") || h === "firstname");
    const lastNameIndex = headers.findIndex((h) => h.includes("last") || h === "lastname");
    const companyIndex = headers.findIndex((h) => h.includes("company") || h.includes("organization"));

    if (emailIndex === -1) {
      toast({
        title: "Invalid CSV",
        description: "CSV must contain an 'email' column",
        variant: "destructive",
      });
      return [];
    }

    const parsed: Recipient[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const email = values[emailIndex];
      if (email && email.includes("@")) {
        parsed.push({
          email,
          firstName: firstNameIndex !== -1 ? values[firstNameIndex] : undefined,
          lastName: lastNameIndex !== -1 ? values[lastNameIndex] : undefined,
          company: companyIndex !== -1 ? values[companyIndex] : undefined,
        });
      }
    }
    return parsed;
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        onRecipientsChange([...recipients, ...parsed]);
        toast({
          title: "Recipients imported",
          description: `Successfully imported ${parsed.length} recipients`,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleManualAdd = () => {
    const emails = manualEmails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) {
      toast({
        title: "No valid emails",
        description: "Please enter valid email addresses",
        variant: "destructive",
      });
      return;
    }

    const newRecipients = emails.map((email) => ({ email }));
    onRecipientsChange([...recipients, ...newRecipients]);
    setManualEmails("");
    toast({
      title: "Recipients added",
      description: `Added ${emails.length} recipients`,
    });
  };

  const removeRecipient = (email: string) => {
    onRecipientsChange(recipients.filter((r) => r.email !== email));
  };

  const clearAll = () => {
    onRecipientsChange([]);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="w-4 h-4" />
            Upload CSV
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Users className="w-4 h-4" />
            Manual Entry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">
              Drag and drop your CSV file here
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              or click to browse
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Select File
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              CSV should have columns: email (required), first_name, last_name, company
            </p>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Email Addresses</Label>
            <Textarea
              placeholder="Enter email addresses (one per line, or separated by commas)"
              value={manualEmails}
              onChange={(e) => setManualEmails(e.target.value)}
              className="min-h-[150px] bg-secondary/50"
            />
          </div>
          <Button type="button" onClick={handleManualAdd}>
            Add Recipients
          </Button>
        </TabsContent>
      </Tabs>

      {/* Recipients List */}
      {recipients.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="font-medium">{recipients.length} Recipients</span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>

          <div className="bg-secondary/30 rounded-lg border border-border p-4 max-h-[300px] overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {recipients.slice(0, 50).map((recipient) => (
                <Badge
                  key={recipient.email}
                  variant="secondary"
                  className="flex items-center gap-1 py-1.5 px-3"
                >
                  {recipient.firstName || recipient.email}
                  <button
                    type="button"
                    onClick={() => removeRecipient(recipient.email)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {recipients.length > 50 && (
                <Badge variant="outline" className="py-1.5 px-3">
                  +{recipients.length - 50} more
                </Badge>
              )}
            </div>
          </div>

          {recipients.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-500" />
              <span>All recipients validated</span>
            </div>
          )}
        </div>
      )}

      {recipients.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4" />
          <span>No recipients added yet</span>
        </div>
      )}
    </div>
  );
};

export default RecipientSelector;
