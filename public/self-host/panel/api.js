"use strict";
/**
 * Control-panel API. Mounted by server.js under /api/panel/*.
 *
 *   GET/POST/PATCH/DELETE  /api/panel/domains
 *   GET/POST/PATCH/DELETE  /api/panel/senders
 *   GET/POST/PATCH/DELETE  /api/panel/lists
 *   GET/POST/PATCH/DELETE  /api/panel/campaigns
 *   POST                   /api/panel/campaigns/:id/send
 *   GET                    /api/panel/overview
 *   GET                    /api/panel/dns/:domainId     suggested SPF/DKIM/DMARC records
 */
const dns = require("dns").promises;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const COLLECTIONS = ["domains", "senders", "lists", "campaigns"];

function parseEmails(input) {
  return [
    ...new Set(
      String(input || "")
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e)),
    ),
  ];
}

function validate(collection, body, store) {
  if (collection === "domains") {
    if (!body.name || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(body.name)) return "Enter a valid domain name";
  }
  if (collection === "senders") {
    if (!body.from_email || !EMAIL_RE.test(body.from_email)) return "Enter a valid sender email address";
    if (!body.from_name) return "Sender name is required";
    if (body.domain_id && !store.find("domains", body.domain_id)) return "Unknown domain";
  }
  if (collection === "lists") {
    if (!body.name) return "List name is required";
  }
  if (collection === "campaigns") {
    if (!body.name) return "Campaign name is required";
    if (!body.subject) return "Subject is required";
    if (!body.html && !body.text) return "Add HTML or text content";
    if (body.sender_id && !store.find("senders", body.sender_id)) return "Unknown sender";
    if (body.list_id && !store.find("lists", body.list_id)) return "Unknown list";
  }
  return null;
}

function shape(collection, body) {
  if (collection === "lists") {
    const contacts = Array.isArray(body.contacts) ? body.contacts : parseEmails(body.contacts);
    return { name: body.name, description: body.description || "", contacts };
  }
  if (collection === "campaigns") {
    return {
      name: body.name,
      subject: body.subject,
      html: body.html || "",
      text: body.text || "",
      sender_id: body.sender_id || null,
      list_id: body.list_id || null,
      tag: body.tag || "",
      status: body.status || "draft",
      job_ids: body.job_ids || [],
      sent_at: body.sent_at || null,
    };
  }
  if (collection === "domains") {
    return {
      name: String(body.name).toLowerCase(),
      dkim_selector: body.dkim_selector || "mail",
      dmarc_policy: body.dmarc_policy || "none",
      verified: body.verified === true,
      last_checked_at: body.last_checked_at || null,
      checks: body.checks || null,
    };
  }
  return {
    from_name: body.from_name,
    from_email: String(body.from_email).toLowerCase(),
    domain_id: body.domain_id || null,
    route: body.route || "",
    enabled: body.enabled !== false,
  };
}

/** Live counts for a campaign, read straight from the delivery queue. */
function campaignStats(campaign, mta) {
  const counts = { total: (campaign.job_ids || []).length, sent: 0, failed: 0, pending: 0 };
  for (const id of campaign.job_ids || []) {
    const job = mta.queue.get(id);
    if (!job) continue;
    if (job.status === "sent") counts.sent += 1;
    else if (job.status === "failed") counts.failed += 1;
    else counts.pending += 1;
  }
  return counts;
}

async function checkDomain(domain) {
  const out = { spf: null, dkim: null, dmarc: null };
  const first = async (name, type, test) => {
    try {
      const records = (await dns.resolveTxt(name)).map((r) => r.join(""));
      return records.find(test) || null;
    } catch {
      return null;
    }
  };
  out.spf = await first(domain.name, "TXT", (r) => /^v=spf1/i.test(r));
  out.dkim = await first(`${domain.dkim_selector}._domainkey.${domain.name}`, "TXT", (r) => /p=/i.test(r));
  out.dmarc = await first(`_dmarc.${domain.name}`, "TXT", (r) => /^v=DMARC1/i.test(r));
  return out;
}

function suggestedRecords(domain, config) {
  const selector = domain.dkim_selector || "mail";
  const dkimKey = config.mta?.dkim?.public_key || "<your-dkim-public-key>";
  return [
    { type: "TXT", host: "@", value: "v=spf1 include:amazonses.com ~all", purpose: "SPF" },
    { type: "TXT", host: `${selector}._domainkey`, value: `v=DKIM1; k=rsa; p=${dkimKey}`, purpose: "DKIM" },
    {
      type: "TXT",
      host: "_dmarc",
      value: `v=DMARC1; p=${domain.dmarc_policy || "none"}; rua=mailto:dmarc@${domain.name}`,
      purpose: "DMARC",
    },
  ];
}

/**
 * @returns {Promise<boolean>} true when the request was handled here.
 */
async function handlePanelApi(req, res, ctx) {
  const { url, json, readBody, store, mta, config } = ctx;
  if (!url.pathname.startsWith("/api/panel/")) return false;

  const parts = url.pathname.replace("/api/panel/", "").split("/").filter(Boolean);
  const [head, id, action] = parts;

  if (head === "overview" && req.method === "GET") {
    const campaigns = store.all("campaigns").map((c) => ({ ...c, stats: campaignStats(c, mta) }));
    json(res, 200, {
      domains: store.all("domains").length,
      senders: store.all("senders").length,
      contacts: store.all("lists").reduce((n, l) => n + (l.contacts?.length || 0), 0),
      campaigns: campaigns.length,
      mta: mta.snapshot(),
      recent_campaigns: campaigns.slice(-5).reverse(),
    });
    return true;
  }

  if (head === "dns" && req.method === "GET" && id) {
    const domain = store.find("domains", id);
    if (!domain) return json(res, 404, { error: "Domain not found" }), true;
    const checks = await checkDomain(domain);
    const verified = Boolean(checks.spf && checks.dkim && checks.dmarc);
    store.update("domains", id, { checks, verified, last_checked_at: new Date().toISOString() });
    json(res, 200, { checks, verified, records: suggestedRecords(domain, config) });
    return true;
  }

  if (!COLLECTIONS.includes(head)) return false;

  if (req.method === "GET" && !id) {
    const rows = store.all(head);
    json(res, 200, {
      [head]: head === "campaigns" ? rows.map((c) => ({ ...c, stats: campaignStats(c, mta) })) : rows,
    });
    return true;
  }

  if (req.method === "POST" && !id) {
    const body = await readBody(req);
    const error = validate(head, body, store);
    if (error) return json(res, 400, { error }), true;
    json(res, 201, store.insert(head, shape(head, body)));
    return true;
  }

  if (req.method === "PATCH" && id) {
    const existing = store.find(head, id);
    if (!existing) return json(res, 404, { error: "Not found" }), true;
    const body = await readBody(req);
    const merged = { ...existing, ...body };
    const error = validate(head, merged, store);
    if (error) return json(res, 400, { error }), true;
    json(res, 200, store.update(head, id, shape(head, merged)));
    return true;
  }

  if (req.method === "DELETE" && id) {
    if (!store.remove(head, id)) return json(res, 404, { error: "Not found" }), true;
    json(res, 200, { deleted: id });
    return true;
  }

  // POST /api/panel/campaigns/:id/send
  if (head === "campaigns" && action === "send" && req.method === "POST") {
    const campaign = store.find("campaigns", id);
    if (!campaign) return json(res, 404, { error: "Campaign not found" }), true;
    if (campaign.status === "sending") return json(res, 409, { error: "Campaign is already sending" }), true;

    const sender = campaign.sender_id ? store.find("senders", campaign.sender_id) : null;
    if (!sender) return json(res, 400, { error: "Pick a sender before sending" }), true;
    if (sender.enabled === false) return json(res, 400, { error: "That sender is disabled" }), true;

    const list = campaign.list_id ? store.find("lists", campaign.list_id) : null;
    const recipients = list?.contacts || [];
    if (!recipients.length) return json(res, 400, { error: "The selected list has no contacts" }), true;

    const jobs = [];
    const skipped = [];
    for (const contact of recipients) {
      const to = typeof contact === "string" ? contact : contact.email;
      if (!to || !EMAIL_RE.test(to)) continue;
      if (mta.isSuppressed(to)) {
        skipped.push(to);
        continue;
      }
      try {
        jobs.push(
          ...mta.enqueue({
            to,
            subject: campaign.subject,
            html: campaign.html,
            text: campaign.text,
            from: sender.from_email,
            from_name: sender.from_name,
            tag: campaign.tag || campaign.name,
            merge_data: typeof contact === "object" ? contact : { email: to },
          }),
        );
      } catch (err) {
        skipped.push(to);
      }
    }

    const updated = store.update("campaigns", id, {
      status: "sending",
      sent_at: new Date().toISOString(),
      job_ids: [...(campaign.job_ids || []), ...jobs.map((j) => j.id)],
    });
    json(res, 202, { queued: jobs.length, skipped: skipped.length, campaign: updated });
    return true;
  }

  return false;
}

module.exports = { handlePanelApi, campaignStats, parseEmails };
