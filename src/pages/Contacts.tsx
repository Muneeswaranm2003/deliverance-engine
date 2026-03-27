import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  Users,
  Mail,
  Building,
  Trash2,
  Pencil,
  Upload,
  FileSpreadsheet,
  Globe,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries, timezoneOptions, getTimezoneForCountry } from "@/lib/countryTimezones";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

interface CSVContact {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  job_title?: string;
  country?: string;
  timezone?: string;
}

type Contact = Tables<"contacts">;

const Contacts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [engagementFilter, setEngagementFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [suppressedFilter, setSuppressedFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    company: "",
    job_title: "",
    country: "",
    timezone: "",
  });
  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Contact[];
    },
  });

  const analyzeEmails = async (emails: string[]) => {
    try {
      await supabase.functions.invoke("analyze-email-domain", {
        body: { emails },
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err) {
      console.error("Email analysis failed:", err);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error("You must be logged in to create a contact");
      const { error } = await supabase.from("contacts").insert({
        ...data,
        user_id: user.id,
      });
      if (error) throw error;
      return data.email;
    },
    onSuccess: (email) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Contact created successfully" });
      analyzeEmails([email]);
    },
    onError: (error) => {
      toast({ title: "Error creating contact", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("contacts")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setIsDialogOpen(false);
      setEditingContact(null);
      resetForm();
      toast({ title: "Contact updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error updating contact", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contact deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting contact", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (contacts: CSVContact[]) => {
      if (!user) throw new Error("You must be logged in to import contacts");
      const { error } = await supabase.from("contacts").insert(
        contacts.map((c) => ({
          email: c.email,
          first_name: c.first_name || null,
          last_name: c.last_name || null,
          company: c.company || null,
          job_title: c.job_title || null,
          country: c.country || null,
          timezone: c.timezone || (c.country ? getTimezoneForCountry(c.country) : null),
          user_id: user.id,
        }))
      );
      if (error) throw error;
      return contacts.map((c) => c.email);
    },
    onSuccess: (emails) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setIsImportDialogOpen(false);
      toast({ title: "Import successful", description: `Imported ${emails.length} contacts` });
      analyzeEmails(emails);
    },
    onError: (error) => {
      toast({ title: "Error importing contacts", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ email: "", first_name: "", last_name: "", company: "", job_title: "", country: "", timezone: "" });
  };

  const parseCSV = (text: string): CSVContact[] => {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return [];

    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const emailIndex = headers.findIndex((h) => h.includes("email"));
    const firstNameIndex = headers.findIndex((h) => h.includes("first") || h === "firstname" || h === "first_name");
    const lastNameIndex = headers.findIndex((h) => h.includes("last") || h === "lastname" || h === "last_name");
    const companyIndex = headers.findIndex((h) => h.includes("company") || h.includes("organization"));
    const jobTitleIndex = headers.findIndex((h) => h === "job_title" || h === "jobtitle" || h === "title" || h === "job title");
    const countryIndex = headers.findIndex((h) => h === "country" || h === "country_code");
    const timezoneIndex = headers.findIndex((h) => h === "timezone" || h === "tz" || h === "time_zone");

    if (emailIndex === -1) {
      toast({
        title: "Invalid CSV",
        description: "CSV must contain an 'email' column",
        variant: "destructive",
      });
      return [];
    }

    const parsed: CSVContact[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const email = values[emailIndex];
      if (email && email.includes("@")) {
        parsed.push({
          email,
          first_name: firstNameIndex !== -1 ? values[firstNameIndex] : undefined,
          last_name: lastNameIndex !== -1 ? values[lastNameIndex] : undefined,
          company: companyIndex !== -1 ? values[companyIndex] : undefined,
          job_title: jobTitleIndex !== -1 ? values[jobTitleIndex] : undefined,
          country: countryIndex !== -1 ? values[countryIndex]?.toUpperCase() : undefined,
          timezone: timezoneIndex !== -1 ? values[timezoneIndex] : undefined,
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
        importMutation.mutate(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
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

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      email: contact.email,
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      company: contact.company || "",
      job_title: (contact as any).job_title || "",
      country: (contact as any).country || "",
      timezone: (contact as any).timezone || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Get unique companies for filter
  const uniqueCompanies = Array.from(
    new Set(contacts?.map((c) => c.company).filter(Boolean) as string[])
  ).sort();

  const filteredContacts = contacts?.filter((contact) => {
    // Status filter
    if (statusFilter !== "all" && contact.status !== statusFilter) return false;
    // Engagement filter
    if (engagementFilter !== "all") {
      const score = contact.engagement_score || 0;
      if (engagementFilter === "high" && score < 70) return false;
      if (engagementFilter === "medium" && (score < 40 || score >= 70)) return false;
      if (engagementFilter === "low" && score >= 40) return false;
    }
    // Company filter
    if (companyFilter !== "all" && contact.company !== companyFilter) return false;
    // Suppressed filter
    if (suppressedFilter !== "all") {
      if (suppressedFilter === "yes" && !contact.suppressed) return false;
      if (suppressedFilter === "no" && contact.suppressed) return false;
    }
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        contact.email.toLowerCase().includes(q) ||
        contact.first_name?.toLowerCase().includes(q) ||
        contact.last_name?.toLowerCase().includes(q) ||
        contact.company?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  return (
    <AppLayout
      title="Contacts"
      description="Manage your email contacts and subscriber lists"
      action={
        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Contacts from CSV</DialogTitle>
              </DialogHeader>
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
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Select File"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  CSV should have columns: email (required), first_name, last_name, company, job_title, country, timezone
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingContact(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="hero" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingContact ? "Edit Contact" : "Add New Contact"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      placeholder="John"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      placeholder="Doe"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      placeholder="Acme Inc."
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job Title</Label>
                    <Input
                      id="job_title"
                      placeholder="Marketing Manager"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(val) => {
                        const autoTz = getTimezoneForCountry(val);
                        setFormData({ ...formData, country: val, timezone: autoTz || formData.timezone });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(val) => setFormData({ ...formData, timezone: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-detected" />
                      </SelectTrigger>
                      <SelectContent>
                        {timezoneOptions.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingContact(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="hero"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingContact ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1.5 px-3">
            <Users className="w-3.5 h-3.5" />
            {filteredContacts?.length || 0} / {contacts?.length || 0} contacts
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>

        <Select value={engagementFilter} onValueChange={setEngagementFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Engagement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engagement</SelectItem>
            <SelectItem value="high">High (70+)</SelectItem>
            <SelectItem value="medium">Medium (40-69)</SelectItem>
            <SelectItem value="low">Low (&lt;40)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {uniqueCompanies.map((company) => (
              <SelectItem key={company} value={company}>{company}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={suppressedFilter} onValueChange={setSuppressedFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Suppressed" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Suppressed</SelectItem>
            <SelectItem value="no">Not Suppressed</SelectItem>
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || engagementFilter !== "all" || companyFilter !== "all" || suppressedFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setEngagementFilter("all");
              setCompanyFilter("all");
              setSuppressedFilter("all");
            }}
            className="text-muted-foreground"
          >
            Clear filters
          </Button>
        )}
      ) : !filteredContacts || filteredContacts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-12 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-xl font-semibold mb-2">
            {searchQuery ? "No contacts found" : "No contacts yet"}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {searchQuery
              ? "Try adjusting your search terms"
              : "Add your first contact to start building your mailing list."}
          </p>
          {!searchQuery && (
            <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
              Add Your First Contact
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-muted-foreground">Contact</TableHead>
                <TableHead className="text-muted-foreground">Company</TableHead>
                <TableHead className="text-muted-foreground">Job Title</TableHead>
                <TableHead className="text-muted-foreground">Provider / SPF</TableHead>
                <TableHead className="text-muted-foreground">Country</TableHead>
                <TableHead className="text-muted-foreground">Added</TableHead>
                <TableHead className="text-muted-foreground w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact, index) => (
                <motion.tr
                  key={contact.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-border hover:bg-secondary/30"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {(contact.first_name?.[0] || contact.email[0]).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {contact.first_name || contact.last_name
                            ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                            : "—"}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.company ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Building className="w-3.5 h-3.5" />
                        {contact.company}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(contact as any).job_title ? (
                      <span className="text-muted-foreground">{(contact as any).job_title}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(contact as any).email_provider && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {(contact as any).email_provider}
                        </Badge>
                      )}
                      {(contact as any).spf_status && (
                        <Badge
                          variant={(contact as any).spf_status === "pass" ? "default" : "destructive"}
                          className="text-xs font-normal"
                        >
                          SPF: {(contact as any).spf_status}
                        </Badge>
                      )}
                      {!(contact as any).email_provider && !(contact as any).spf_status && (
                        <span className="text-muted-foreground text-xs">Analyzing…</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(contact as any).country ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-base leading-none">
                          {(contact as any).country
                            .toUpperCase()
                            .split("")
                            .map((c: string) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
                            .join("")}
                        </span>
                        {countries.find(c => c.code === (contact as any).country)?.name || (contact as any).country}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(contact.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(contact)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteMutation.mutate(contact.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}
    </AppLayout>
  );
};

export default Contacts;
