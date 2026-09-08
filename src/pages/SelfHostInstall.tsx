import { useMemo, useState } from "react";
import JSZip from "jszip";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Copy, Terminal, Server, HeartPulse, FileCog, CheckCircle2 } from "lucide-react";

const LICENSE_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/license-api`;

const CodeBlock = ({ children }: { children: string }) => (
  <div className="relative group">
    <pre className="rounded-lg bg-muted/60 border border-border/50 p-4 text-xs overflow-x-auto font-mono leading-relaxed">
      {children}
    </pre>
    <Button
      size="icon"
      variant="ghost"
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
      onClick={() => {
        navigator.clipboard.writeText(children);
        toast.success("Copied");
      }}
    >
      <Copy className="w-3.5 h-3.5" />
    </Button>
  </div>
);

const Step = ({
  n,
  title,
  icon: Icon,
  children,
}: {
  n: number;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) => (
  <Card className="glass border-border/50">
    <CardHeader className="pb-3">
      <CardTitle className="text-base font-semibold flex items-center gap-3">
        <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-sm flex items-center justify-center font-bold">
          {n}
        </span>
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 text-sm">{children}</CardContent>
  </Card>
);

const SelfHostInstall = () => {
  const [domain, setDomain] = useState("");
  const [building, setBuilding] = useState(false);

  const { data: licenses } = useQuery({
    queryKey: ["my_licenses_install"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const license = (licenses ?? [])[0];
  const keyPlaceholder = license
    ? `${license.key_prefix}-••••-••••-${license.key_last4}`
    : "LMTA-XXXX-XXXX-XXXX-XXXX";

  const [licenseKey, setLicenseKey] = useState("");

  const config = useMemo(
    () =>
      JSON.stringify(
        {
          license_key: licenseKey || "LMTA-XXXX-XXXX-XXXX-XXXX",
          license_endpoint: LICENSE_ENDPOINT,
          domain: domain || "mail.yourcompany.com",
          app_version: "1.0.0",
          database: { url: "postgres://mailer:change-me@db:5432/mailer" },
          smtp: {
            host: "email-smtp.us-east-1.amazonaws.com",
            port: 587,
            username: "",
            password: "",
            secure: "starttls",
          },
          app: {
            base_url: `https://${domain || "mail.yourcompany.com"}`,
            from_name: "Your Company",
            from_email: `noreply@${domain || "yourcompany.com"}`,
          },
        },
        null,
        2,
      ),
    [licenseKey, domain],
  );

  const downloadPackage = async () => {
    setBuilding(true);
    try {
      const files = [
        "license-client.js",
        "install.sh",
        "docker-compose.yml",
        "README.md",
        "mailer.config.example.json",
      ];
      const zip = new JSZip();
      const folder = zip.folder("mailer-self-host")!;
      await Promise.all(
        files.map(async (f) => {
          const res = await fetch(`/self-host/${f}`);
          folder.file(f, await res.text());
        }),
      );
      folder.file("mailer.config.json", config);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mailer-self-host.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Install package downloaded");
    } catch (e) {
      toast.error("Could not build the package. Please try again.");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <AppLayout
      title="Self-hosted install"
      description="Download the package, fill in the config file, and connect your server to the license heartbeat"
    >
      <div className="space-y-5 max-w-4xl">
        <Step n={1} title="Download the install package" icon={Download}>
          <p className="text-muted-foreground">
            The package contains the installer, a Docker setup, the license client, and your config file.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="key">License key</Label>
              <Input
                id="key"
                placeholder={keyPlaceholder}
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain">Production domain</Label>
              <Input
                id="domain"
                placeholder="mail.yourcompany.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
              />
            </div>
          </div>
          <Button onClick={downloadPackage} disabled={building} className="gap-2">
            <Download className="w-4 h-4" />
            {building ? "Preparing…" : "Download mailer-self-host.zip"}
          </Button>
          {license && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              {license.tier_name} — {license.install_limit ?? "unlimited"} production installation
              {license.install_limit === 1 ? "" : "s"}
            </p>
          )}
        </Step>

        <Step n={2} title="Unpack and run the installer" icon={Terminal}>
          <CodeBlock>{`scp mailer-self-host.zip you@your-server:~
ssh you@your-server
unzip mailer-self-host.zip && cd mailer-self-host
bash install.sh`}</CodeBlock>
          <p className="text-muted-foreground">
            The first run prepares <code className="font-mono">mailer.config.json</code>; run it again after you have
            filled it in. It then activates your license and installs the daily heartbeat.
          </p>
        </Step>

        <Step n={3} title="The config file" icon={FileCog}>
          <p className="text-muted-foreground">
            This is what ships inside your package, already pointed at the license server. Fill in your database and
            SMTP details.
          </p>
          <CodeBlock>{config}</CodeBlock>
        </Step>

        <Step n={4} title="Heartbeat and license commands" icon={HeartPulse}>
          <p className="text-muted-foreground">
            Your install checks in with the license server once a day. Endpoint:
          </p>
          <CodeBlock>{LICENSE_ENDPOINT}</CodeBlock>
          <CodeBlock>{`node license-client.js activate     # claim an installation slot
node license-client.js heartbeat    # daily check-in (installed as cron)
node license-client.js deactivate   # free the slot before moving servers`}</CodeBlock>
          <Separator />
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex gap-2">
              <Badge variant="outline" className="shrink-0">1 slot</Badge>
              One production domain per installation slot.
            </li>
            <li className="flex gap-2">
              <Badge variant="outline" className="shrink-0">Free</Badge>
              localhost, .test, .local and staging/dev/test hosts never use a slot.
            </li>
            <li className="flex gap-2">
              <Badge variant="outline" className="shrink-0">14 days</Badge>
              If the license server is unreachable, the install keeps running on a grace period.
            </li>
          </ul>
        </Step>

        <Step n={5} title="Start the platform" icon={Server}>
          <CodeBlock>{`docker compose up -d
# then open https://your-domain`}</CodeBlock>
          <p className="text-muted-foreground">
            Point your domain's DNS at the server and put it behind HTTPS (Caddy, Nginx or your load balancer).
          </p>
        </Step>
      </div>
    </AppLayout>
  );
};

export default SelfHostInstall;
