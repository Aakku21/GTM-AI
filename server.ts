import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { store } from './server/store';
import {
  createProspectOutreachDrafts,
  createTeamEmailDraft,
  processChatMessage,
  resumeWorkflowRun,
  runEventBus,
} from './server/worker';
import {
  generateExportArtifact,
  parseUploadedSpreadsheet,
} from './server/exporters';
import {
  dispatchEmailDraft,
  syncLeadsToHubSpot,
  testProviderCapability,
} from './server/adapters';
import {
  handleBuiltInMcpRequest,
  probeCustomApiEndpoint,
  probeMcpServer,
} from './server/mcpBridge';
import {
  assignTerritoryOwner,
  deduplicateLeads,
  isLeadSuppressed,
  normalizeDomain,
  normalizeEmail,
  scoreLead,
  SUPPORTED_EXPORT_FORMATS,
} from './src/lib/workflowEngine';
import type {
  ExportFormat,
  IntegrationConnection,
  LeadRecord,
  Workspace,
} from './src/types/gtm';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      availableModels: store.getAvailableModels(),
    });
  });

  // Full workspace-isolated state snapshot
  app.get('/api/state', (req, res) => {
    const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
    res.json(store.getSnapshot(workspaceId));
  });

  app.post('/api/workspaces/reset', (_req, res) => {
    store.reset();
    res.json(store.getSnapshot());
  });

  app.patch('/api/workspaces/:workspaceId', (req, res) => {
    const ws = store.db.workspaces.find((w) => w.id === req.params.workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });

    const patch = req.body as Partial<Workspace>;
    const allowedFields: (keyof Workspace)[] = [
      'name',
      'currency',
      'timeZone',
      'creditBudget',
      'retentionDays',
      'aiProvider',
      'aiModel',
      'products',
      'icps',
      'customFields',
      'territories',
      'leadStages',
      'scoringRules',
      'suppressions',
    ];
    for (const key of allowedFields) {
      if (patch[key] !== undefined) {
        (ws as unknown as Record<string, unknown>)[key] = patch[key];
      }
    }

    // Re-score leads in this workspace if scoringRules changed
    if (patch.scoringRules) {
      for (const lead of store.db.leads.filter((l) => l.workspaceId === ws.id)) {
        const cmp = store.db.campaigns.find((c) => c.id === lead.campaignId);
        if (cmp) {
          const rescored = scoreLead(lead, cmp.filters, ws.scoringRules, '2026-11-18');
          lead.scoreTotal = rescored.scoreTotal;
          lead.scoreBreakdown = rescored.scoreBreakdown;
          lead.qualificationLabel = rescored.qualificationLabel;
          lead.dataCoveragePct = rescored.dataCoveragePct;
        }
      }
    }

    store.recordAudit(ws.id, 'Workspace Admin', 'settings', `Updated workspace configuration for "${ws.name}".`);
    res.json(store.getSnapshot(ws.id));
  });

  // Threads
  app.post('/api/threads', (req, res) => {
    const { workspaceId, campaignId, title } = req.body as {
      workspaceId: string;
      campaignId?: string;
      title?: string;
    };
    const ws = store.getWorkspace(workspaceId);
    const defaultCampaign =
      store.db.campaigns.find((c) => c.id === campaignId && c.workspaceId === ws.id) ??
      store.db.campaigns.find((c) => c.workspaceId === ws.id)!;

    const thread = {
      id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      workspaceId: ws.id,
      campaignId: defaultCampaign.id,
      title: title || 'New Lead Search',
      messages: [],
      selectedLeadIds: [],
      activeLeadId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.db.threads.unshift(thread);
    store.save();
    res.json({ thread, snapshot: store.getSnapshot(ws.id) });
  });

  app.patch('/api/threads/:threadId', (req, res) => {
    const thread = store.db.threads.find((t) => t.id === req.params.threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    const { selectedLeadIds, activeLeadId, campaignId, title } = req.body ?? {};
    if (Array.isArray(selectedLeadIds)) thread.selectedLeadIds = selectedLeadIds;
    if (activeLeadId !== undefined) thread.activeLeadId = activeLeadId;
    if (typeof campaignId === 'string') thread.campaignId = campaignId;
    if (typeof title === 'string') thread.title = title;
    thread.updatedAt = new Date().toISOString();
    store.save();
    res.json({ thread });
  });

  // Chat -> Workflow execution
  app.post('/api/chat/send', async (req, res) => {
    const { workspaceId, threadId, campaignId, prompt, selectedLeadIds, modelLabel } =
      req.body ?? {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Please enter a lead search or workflow instruction.' });
    }
    try {
      const result = await processChatMessage({
        workspaceId: workspaceId || store.db.workspaces[0].id,
        threadId,
        campaignId,
        prompt: prompt.trim(),
        selectedLeadIds: Array.isArray(selectedLeadIds) ? selectedLeadIds : undefined,
        modelLabel,
        fastMode: false,
      });
      res.json({
        ...result,
        snapshot: store.getSnapshot(result.thread.workspaceId),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Workflow execution failed.',
      });
    }
  });

  // SSE stream for live workflow step progress
  app.get('/api/runs/:runId/stream', (req, res) => {
    const run = store.db.runs.find((r) => r.id === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send({ run });

    const listener = (evt: { run: unknown }) => {
      send(evt);
      if (run.status === 'completed' || run.status === 'cancelled' || run.status === 'failed') {
        cleanup();
        res.end();
      }
    };

    const cleanup = () => {
      runEventBus.off(`run:${run.id}`, listener);
    };

    runEventBus.on(`run:${run.id}`, listener);
    req.on('close', cleanup);
  });

  // Pause / Cancel / Resume durable workflow run
  app.post('/api/runs/:runId/control', async (req, res) => {
    const run = store.db.runs.find((r) => r.id === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    const action = req.body?.action as 'pause' | 'cancel' | 'resume';

    if (action === 'pause') {
      run.status = 'paused';
      store.save();
    } else if (action === 'cancel') {
      run.status = 'cancelled';
      store.save();
    } else if (action === 'resume') {
      await resumeWorkflowRun(run.id);
    } else {
      return res.status(400).json({ error: 'Invalid run control action.' });
    }

    res.json({ run, snapshot: store.getSnapshot(run.workspaceId) });
  });

  // Campaigns
  app.post('/api/campaigns', (req, res) => {
    const { workspaceId, name, mode, goal, filters, productId } = req.body ?? {};
    const ws = store.getWorkspace(workspaceId);
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Campaign name is required.' });
    }
    const baseCmp = store.db.campaigns.find((c) => c.workspaceId === ws.id);
    const campaign = {
      id: `cmp-${Date.now()}`,
      workspaceId: ws.id,
      name: String(name).trim(),
      mode: mode === 'inbound' ? ('inbound' as const) : ('outbound' as const),
      productId: productId || ws.products[0]?.id || 'prod-default',
      goal: goal || 'Discover and qualify target accounts',
      status: 'Active' as const,
      filters: {
        ...(baseCmp?.filters ?? {
          product: ws.products[0]?.name || '',
          campaignGoal: goal || '',
          icpName: name,
          industry: '',
          companyHqLocation: '',
          contactLocation: '',
          minEmployees: null,
          maxEmployees: null,
          buyerRoles: [],
          exclusions: [],
          buyingSignalKeywords: [],
          signalWindowDays: 90,
          targetCount: 25,
          requestedOutput: null,
          verifiedEmailOnly: false,
          excludeHubSpotCustomers: false,
          cityFilter: null,
        }),
        ...(filters ?? {}),
      },
      leadIds: [],
      refreshSchedule: 'Manual' as const,
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    store.db.campaigns.unshift(campaign);
    store.save();
    res.json({ campaign, snapshot: store.getSnapshot(ws.id) });
  });

  app.patch('/api/campaigns/:campaignId', (req, res) => {
    const cmp = store.db.campaigns.find((c) => c.id === req.params.campaignId);
    if (!cmp) return res.status(404).json({ error: 'Campaign not found' });
    if (req.body.filters) cmp.filters = { ...cmp.filters, ...req.body.filters };
    if (req.body.status) cmp.status = req.body.status;
    if (req.body.refreshSchedule) cmp.refreshSchedule = req.body.refreshSchedule;
    cmp.updatedAt = new Date().toISOString().slice(0, 10);
    store.save();
    res.json({ campaign: cmp, snapshot: store.getSnapshot(cmp.workspaceId) });
  });

  // Upload CSV / XLSX spreadsheet (works with 0 external integrations!)
  app.post('/api/uploads/import', upload.single('file'), (req, res) => {
    const workspaceId = String(req.body.workspaceId || store.db.workspaces[0].id);
    const campaignId = String(req.body.campaignId || '');
    const threadId = String(req.body.threadId || '');
    const ws = store.getWorkspace(workspaceId);
    const cmp =
      store.db.campaigns.find((c) => c.id === campaignId && c.workspaceId === ws.id) ??
      store.db.campaigns.find((c) => c.workspaceId === ws.id)!;

    if (!req.file) {
      return res.status(400).json({ error: 'Attach a .csv or .xlsx spreadsheet file.' });
    }

    const rows = parseUploadedSpreadsheet(req.file.buffer, req.file.originalname);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Uploaded spreadsheet contained no rows.' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const importedRaw: LeadRecord[] = rows.map((row, idx) => {
      const email = normalizeEmail(row.email || row.work_email || '');
      const domain =
        normalizeDomain(row.domain || row.company_domain || row.website || '') ||
        (email.includes('@') ? email.split('@')[1] : '');
      const city = row.city || row.hq_city || row.location || 'Unknown';
      const state = row.state || row.hq_state || '';
      const company = row.company || row.company_name || row.organization || `Imported Account ${idx + 1}`;
      const contact = row.name || row.contact_name || row.full_name || 'Imported Contact';
      const title = row.title || row.job_title || row.role || 'Decision Maker';
      const source = row.source || row.acquisition_source || `Uploaded File (${req.file!.originalname})`;
      const empNum = Number(row.employees || row.employee_count || 0);

      const base: LeadRecord = {
        id: `imp-${Date.now()}-${idx}`,
        workspaceId: ws.id,
        campaignId: cmp.id,
        companyId: `comp-imp-${Date.now()}-${idx}`,
        companyName: company,
        companyDomain: domain,
        companyHqCity: city,
        companyHqState: state,
        companyHqCountry: row.country || 'India',
        industry: row.industry || cmp.filters.industry || 'General B2B',
        employeeCount: empNum > 0 ? empNum : null,
        contactName: contact,
        contactTitle: title,
        contactLocation: state ? `${city}, ${state}` : city,
        workEmail: email,
        emailStatus: email ? 'valid' : 'unknown',
        emailProvider: 'File Import',
        emailVerifiedAt: today,
        acquisitionSource: source,
        sources: [{ provider: source, recordId: `${req.file!.originalname}#row${idx + 2}`, fetchedAt: new Date().toISOString() }],
        signals: [
          {
            id: `sig-imp-${Date.now()}-${idx}`,
            type: 'Inbound',
            title: row.signal || `Imported opted-in record from ${req.file!.originalname}`,
            summary: row.notes || `Row ${idx + 2} from ${req.file!.originalname}`,
            sourceName: source,
            sourceUrlOrId: `${req.file!.originalname}#row${idx + 2}`,
            eventDate: row.date || today,
            observedAt: new Date().toISOString(),
          },
        ],
        companyBrief: `${company} (${city}) imported via ${req.file!.originalname}.`,
        conversationOpener: `Thanks for connecting via ${source} — happy to share next steps for ${company}.`,
        scoreTotal: 0,
        scoreBreakdown: { companyFit: 0, roleFit: 0, buyingSignals: 0, engagement: 0, total: 0, factors: [] },
        dataCoveragePct: 0,
        qualificationLabel: 'Needs review',
        ambiguousIdentityFlag: false,
        owner: 'Unassigned',
        territory: city,
        crmStage: 'New',
        crmRecordId: null,
        crmRecordUrl: null,
        crmSyncedAt: null,
        customFieldValues: {},
        engagementEvents: [],
        activityLog: [{ timestamp: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', summary: `Imported from ${req.file!.originalname}` }],
        discoveredAt: today,
      };
      return base;
    });

    const { deduplicated, duplicatesMerged } = deduplicateLeads(importedRaw);
    const scored = deduplicated.map((lead, idx) => {
      const terr = assignTerritoryOwner(lead, ws.territories, idx);
      const s = scoreLead(lead, cmp.filters, ws.scoringRules, today);
      return { ...lead, owner: terr.owner, territory: terr.territory, ...s };
    });

    store.db.leads = [...scored, ...store.db.leads];
    cmp.leadIds = [...scored.map((l) => l.id), ...cmp.leadIds];

    const cityMap = new Map<string, { city: string; count: number; owner: string }>();
    for (const l of scored) {
      const c = cityMap.get(l.companyHqCity) ?? { city: l.companyHqCity, count: 0, owner: l.owner };
      c.count += 1;
      cityMap.set(l.companyHqCity, c);
    }

    const thread = store.db.threads.find((t) => t.id === threadId && t.workspaceId === ws.id);
    if (thread) {
      thread.messages.push({
        id: `msg-${Date.now()}-imp`,
        role: 'assistant',
        content: `Imported ${rows.length} rows from "${req.file.originalname}", merged ${duplicatesMerged} duplicate submissions (${scored.length} unique leads), assigned territory owners by city, and scored all leads.`,
        timestamp: new Date().toISOString(),
        leadIds: scored.map((l) => l.id),
        inboundSummary: {
          rawCount: rows.length,
          deduplicatedCount: scored.length,
          duplicatesMerged,
          cityCounts: Array.from(cityMap.values()),
        },
      });
    }

    store.recordAudit(
      ws.id,
      'Workspace User',
      'workflow',
      `Imported ${req.file.originalname}: ${rows.length} raw rows → ${scored.length} unique leads (${duplicatesMerged} duplicates merged).`
    );

    res.json({
      importedCount: scored.length,
      duplicatesMerged,
      snapshot: store.getSnapshot(ws.id),
    });
  });

  // Export generation (xlsx, csv, json, parquet, pdf, google_sheet)
  app.post('/api/exports', async (req, res) => {
    const { workspaceId, campaignId, format, leadIds, columns, runId, threadId } = req.body ?? {};
    const ws = store.getWorkspace(workspaceId);
    const cmp =
      store.db.campaigns.find((c) => c.id === campaignId && c.workspaceId === ws.id) ??
      store.db.campaigns.find((c) => c.workspaceId === ws.id)!;

    if (!SUPPORTED_EXPORT_FORMATS.includes(format as ExportFormat)) {
      return res.status(400).json({
        error: `Unsupported export format "${format}".`,
        alternatives: SUPPORTED_EXPORT_FORMATS,
      });
    }

    const campaignLeads = store.db.leads.filter(
      (l) => l.workspaceId === ws.id && l.campaignId === cmp.id
    );
    const orderedLeads =
      Array.isArray(leadIds) && leadIds.length > 0
        ? (leadIds as string[])
            .map((id) => campaignLeads.find((l) => l.id === id))
            .filter((x): x is LeadRecord => Boolean(x))
        : cmp.leadIds
            .map((id) => campaignLeads.find((l) => l.id === id))
            .filter((x): x is LeadRecord => Boolean(x));

    try {
      const { artifact, filePath } = await generateExportArtifact({
        workspaceId: ws.id,
        campaign: cmp,
        runId: runId || null,
        leads: orderedLeads,
        format: format as ExportFormat,
        columns: Array.isArray(columns) ? columns : undefined,
        filters: cmp.filters,
      });

      store.db.exports.unshift(artifact);
      if (filePath) store.db.exportFiles[artifact.id] = filePath;

      if (threadId) {
        const thread = store.db.threads.find((t) => t.id === threadId && t.workspaceId === ws.id);
        if (thread) {
          thread.messages.push({
            id: `msg-${Date.now()}-exp`,
            role: 'assistant',
            content: `Generated ${artifact.fileName} (${artifact.rowCount} rows) from your exact selection.`,
            timestamp: new Date().toISOString(),
            exportArtifactId: artifact.id,
          });
        }
      }

      store.recordAudit(
        ws.id,
        'Workspace User',
        'export',
        `Exported ${artifact.rowCount} rows to ${artifact.fileName} (${artifact.format.toUpperCase()}).`
      );

      res.json({ artifact, snapshot: store.getSnapshot(ws.id) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Export failed.' });
    }
  });

  // Workspace-scoped export download
  app.get('/api/exports/:exportId/download', (req, res) => {
    const artifact = store.db.exports.find((e) => e.id === req.params.exportId);
    const filePath = store.db.exportFiles[req.params.exportId];
    if (!artifact || !filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Export file not found.' });
    }
    const downloadName = artifact.fileName.endsWith('.csv') || artifact.fileName.includes('.')
      ? artifact.fileName
      : `${artifact.fileName}.csv`;
    res.download(filePath, downloadName);
  });

  // Drafts: create team report or prospect outreach, edit, send
  app.post('/api/drafts/team', (req, res) => {
    const { workspaceId, campaignId, recipients, exportArtifactId, leadIds, threadId } = req.body ?? {};
    const ws = store.getWorkspace(workspaceId);
    const cmp =
      store.db.campaigns.find((c) => c.id === campaignId && c.workspaceId === ws.id) ??
      store.db.campaigns.find((c) => c.workspaceId === ws.id)!;
    const artifact = store.db.exports.find((e) => e.id === exportArtifactId) ?? null;
    const leads = store.db.leads.filter(
      (l) => l.workspaceId === ws.id && (Array.isArray(leadIds) && leadIds.length > 0 ? leadIds.includes(l.id) : cmp.leadIds.includes(l.id))
    );
    const draft = createTeamEmailDraft({
      workspaceId: ws.id,
      campaignId: cmp.id,
      recipients: Array.isArray(recipients) && recipients.length > 0 ? recipients : ['sales@example.com'],
      exportArtifact: artifact,
      leads,
      campaignName: cmp.name,
    });
    if (threadId) {
      const thread = store.db.threads.find((t) => t.id === threadId && t.workspaceId === ws.id);
      thread?.messages.push({
        id: `msg-${Date.now()}-td`,
        role: 'assistant',
        content: `Created editable team report email to ${draft.recipients.join(', ')}${draft.attachmentFileName ? ` with ${draft.attachmentFileName} attached` : ''}.`,
        timestamp: new Date().toISOString(),
        draftIds: [draft.id],
      });
      store.save();
    }
    res.json({ draft, snapshot: store.getSnapshot(ws.id) });
  });

  app.post('/api/drafts/prospects', (req, res) => {
    const { workspaceId, campaignId, leadIds, threadId } = req.body ?? {};
    const ws = store.getWorkspace(workspaceId);
    const cmp =
      store.db.campaigns.find((c) => c.id === campaignId && c.workspaceId === ws.id) ??
      store.db.campaigns.find((c) => c.workspaceId === ws.id)!;
    const leads = store.db.leads.filter(
      (l) => l.workspaceId === ws.id && (Array.isArray(leadIds) && leadIds.length > 0 ? leadIds.includes(l.id) : cmp.leadIds.includes(l.id))
    );
    const drafts = createProspectOutreachDrafts({ workspace: ws, campaignId: cmp.id, leads: leads.slice(0, 10) });
    if (threadId) {
      const thread = store.db.threads.find((t) => t.id === threadId && t.workspaceId === ws.id);
      thread?.messages.push({
        id: `msg-${Date.now()}-pd`,
        role: 'assistant',
        content: `Prepared ${drafts.length} evidence-grounded individual outreach drafts for your review.`,
        timestamp: new Date().toISOString(),
        draftIds: drafts.map((d) => d.id),
      });
      store.save();
    }
    res.json({ drafts, snapshot: store.getSnapshot(ws.id) });
  });

  app.patch('/api/drafts/:draftId', (req, res) => {
    const draft = store.db.drafts.find((d) => d.id === req.params.draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    const { subject, body, recipients, mailboxAccount, provider } = req.body ?? {};
    if (typeof subject === 'string') draft.subject = subject;
    if (typeof body === 'string') draft.body = body;
    if (Array.isArray(recipients)) draft.recipients = recipients;
    if (typeof mailboxAccount === 'string') draft.mailboxAccount = mailboxAccount;
    if (typeof provider === 'string') draft.provider = provider as typeof draft.provider;
    store.save();
    res.json({ draft });
  });

  app.post('/api/drafts/:draftId/send', async (req, res) => {
    const draft = store.db.drafts.find((d) => d.id === req.params.draftId);
    if (!draft) return res.status(404).json({ error: 'Draft not found' });
    const ws = store.getWorkspace(draft.workspaceId);

    if (draft.kind === 'prospect_outreach' && draft.leadId) {
      const lead = store.db.leads.find((l) => l.id === draft.leadId);
      if (lead) {
        const sup = isLeadSuppressed(lead, ws.suppressions);
        if (sup.suppressed) {
          draft.status = 'blocked_suppressed';
          store.save();
          return res.status(400).json({ error: `Send blocked: ${sup.reason}` });
        }
      }
    }

    const result = await dispatchEmailDraft({ workspace: ws, draft });
    draft.status = 'sent';
    draft.providerResponseId = result.providerResponseId;
    draft.sentAt = result.sentAt;

    // Record observed 'contacted' event ONLY for prospect outreach (never team report emails!)
    if (draft.kind === 'prospect_outreach' && draft.leadId) {
      const lead = store.db.leads.find((l) => l.id === draft.leadId);
      if (lead) {
        lead.engagementEvents.push({
          id: `eng-${Date.now()}`,
          type: 'contacted',
          date: result.sentAt.slice(0, 10),
          channel: 'email',
          note: `Sent approved email (${result.providerResponseId})`,
        });
        if (lead.crmStage === 'New' || lead.crmStage === 'Qualified') {
          lead.crmStage = 'Contacted';
        }
      }
    }

    store.recordAudit(
      ws.id,
      draft.mailboxAccount,
      'email',
      `Sent ${draft.kind === 'team_report' ? 'team report' : 'prospect email'} to ${draft.recipients.join(', ')} (${result.providerResponseId}).`
    );

    res.json({ result, draft, snapshot: store.getSnapshot(ws.id) });
  });

  // CRM Sync
  app.post('/api/crm/sync', async (req, res) => {
    const { workspaceId, campaignId, leadIds, threadId } = req.body ?? {};
    const ws = store.getWorkspace(workspaceId);
    const cmp =
      store.db.campaigns.find((c) => c.id === campaignId && c.workspaceId === ws.id) ??
      store.db.campaigns.find((c) => c.workspaceId === ws.id)!;
    const targetLeads = store.db.leads.filter(
      (l) =>
        l.workspaceId === ws.id &&
        (Array.isArray(leadIds) && leadIds.length > 0
          ? leadIds.includes(l.id)
          : cmp.leadIds.includes(l.id))
    );

    const crmSyncSummary = await syncLeadsToHubSpot({ workspace: ws, leads: targetLeads });

    // Auto-create follow-up handoff tasks for synced leads
    for (const rec of crmSyncSummary.records.slice(0, 5)) {
      if (!store.db.tasks.some((t) => t.leadId === rec.leadId && t.workspaceId === ws.id)) {
        store.db.tasks.unshift({
          id: `task-${Date.now()}-${rec.leadId.slice(-4)}`,
          workspaceId: ws.id,
          campaignId: cmp.id,
          leadId: rec.leadId,
          title: `Follow up with ${rec.contactName} (${rec.companyName})`,
          owner: rec.owner,
          dueDate: '2026-11-24',
          status: 'Open',
          crmTaskId: `hs_task_${rec.crmRecordId.slice(-5)}`,
          createdAt: new Date().toISOString().slice(0, 10),
        });
      }
    }

    if (threadId) {
      const thread = store.db.threads.find((t) => t.id === threadId && t.workspaceId === ws.id);
      thread?.messages.push({
        id: `msg-${Date.now()}-crm`,
        role: 'assistant',
        content: `Synced ${crmSyncSummary.syncedCount} eligible records to ${crmSyncSummary.provider} (${crmSyncSummary.createdCount} created, ${crmSyncSummary.updatedCount} updated, preserving assigned owners).`,
        timestamp: new Date().toISOString(),
        crmSyncSummary,
      });
    }

    store.recordAudit(
      ws.id,
      'Workspace User',
      'crm',
      `HubSpot sync completed for "${cmp.name}": ${crmSyncSummary.syncedCount} synced, ${crmSyncSummary.skippedCount} skipped.`
    );

    res.json({ crmSyncSummary, snapshot: store.getSnapshot(ws.id) });
  });

  // Update Lead record (owner, stage, custom fields, engagement events)
  app.patch('/api/leads/:leadId', (req, res) => {
    const lead = store.db.leads.find((l) => l.id === req.params.leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const { owner, crmStage, customFieldValues, newEngagementEvent } = req.body ?? {};
    if (typeof owner === 'string') lead.owner = owner;
    if (typeof crmStage === 'string') lead.crmStage = crmStage;
    if (customFieldValues && typeof customFieldValues === 'object') {
      lead.customFieldValues = { ...lead.customFieldValues, ...customFieldValues };
    }
    if (newEngagementEvent) {
      lead.engagementEvents.push({
        id: `eng-${Date.now()}`,
        ...newEngagementEvent,
      });
      if (newEngagementEvent.type === 'unsubscribed' || newEngagementEvent.type === 'bounced') {
        // Automatically stop active sequences for this lead
        for (const seq of store.db.sequences.filter((s) => s.workspaceId === lead.workspaceId)) {
          if (seq.enrolledLeadIds.includes(lead.id) && !seq.stoppedLeadIds.includes(lead.id)) {
            seq.stoppedLeadIds.push(lead.id);
          }
        }
      }
    }
    const ws = store.getWorkspace(lead.workspaceId);
    const cmp = store.db.campaigns.find((c) => c.id === lead.campaignId);
    if (cmp) {
      const rescored = scoreLead(lead, cmp.filters, ws.scoringRules, '2026-11-18');
      lead.scoreTotal = rescored.scoreTotal;
      lead.scoreBreakdown = rescored.scoreBreakdown;
      lead.qualificationLabel = rescored.qualificationLabel;
      lead.dataCoveragePct = rescored.dataCoveragePct;
    }
    store.save();
    res.json({ lead, snapshot: store.getSnapshot(lead.workspaceId) });
  });

  // Integrations connect/disconnect/test/add_mailbox + custom REST/webhook
  app.post('/api/integrations/:integrationId/action', async (req, res) => {
    const conn = store.db.integrations.find((i) => i.id === req.params.integrationId);
    if (!conn) return res.status(404).json({ error: 'Integration not found' });
    const ws = store.getWorkspace(conn.workspaceId);
    const action = req.body?.action as 'connect' | 'disconnect' | 'reconnect' | 'test' | 'add_mailbox';

    let message = '';
    if (action === 'disconnect') {
      conn.status = 'disconnected';
      conn.owner = 'Not connected';
      conn.mailboxes = [];
      message = `Disconnected ${conn.name}.`;
    } else if (action === 'connect' || action === 'reconnect') {
      const check = await testProviderCapability(ws, { ...conn, status: conn.status === 'approval_required' ? 'approval_required' : 'connected' });
      if (!check.ok) {
        return res.status(400).json({ error: check.message, snapshot: store.getSnapshot(ws.id) });
      }
      conn.status = 'connected';
      conn.owner = ws.mode === 'demo' ? 'aakash@signalstack-demo.example' : 'workspace-admin@org.example';
      conn.lastSuccessfulRun = check.checkedAt;
      if ((conn.providerId === 'gmail' || conn.providerId === 'outlook') && conn.mailboxes.length === 0) {
        conn.mailboxes.push({
          id: `mb-${Date.now()}`,
          email: conn.providerId === 'gmail' ? 'aakash.gtm@signalstack-demo.example' : 'sales.ops@signalstack-demo.example',
          label: conn.providerId === 'gmail' ? 'Primary Gmail Mailbox' : 'Primary Outlook Mailbox',
          provider: conn.providerId,
          dailyLimit: 250,
          sentToday: 0,
        });
      }
      message = check.message;
    } else if (action === 'test') {
      if (conn.protocol === 'mcp' && conn.mcpConfig) {
        const probe = await probeMcpServer({
          transport: conn.mcpConfig.transport,
          endpointUrl: conn.mcpConfig.endpointUrl,
          command: conn.mcpConfig.command,
          envVarName: conn.mcpConfig.envVarName,
          authMode: conn.mcpConfig.authMode,
          declaredTools: conn.mcpConfig.discoveredTools,
        });
        if (probe.ok) {
          conn.lastSuccessfulRun = new Date().toISOString();
          conn.mcpConfig.protocolVersion = probe.protocolVersion;
          if (probe.tools.length > 0) {
            conn.mcpConfig.discoveredTools = probe.tools;
            conn.allowedActions = probe.tools.map((t) => t.name);
          }
        }
        message = probe.message;
        if (!probe.ok) {
          return res.status(400).json({ error: probe.message, snapshot: store.getSnapshot(ws.id) });
        }
      } else if (conn.protocol === 'api' && conn.customConfig) {
        const probe = await probeCustomApiEndpoint({
          baseUrl: conn.customConfig.baseUrl,
          authType: conn.customConfig.authType,
          envVarName: conn.customConfig.envVarName,
        });
        if (probe.ok) {
          conn.lastSuccessfulRun = new Date().toISOString();
        }
        message = probe.message;
        if (!probe.ok) {
          return res.status(400).json({ error: probe.message, snapshot: store.getSnapshot(ws.id) });
        }
      } else {
        const check = await testProviderCapability(ws, conn);
        if (check.ok && conn.status === 'connected') {
          conn.lastSuccessfulRun = check.checkedAt;
        }
        message = check.message;
      }
    } else if (action === 'add_mailbox') {
      const email = String(req.body?.email || '').trim();
      const label = String(req.body?.label || email).trim();
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid mailbox email address is required.' });
      }
      conn.mailboxes.push({
        id: `mb-${Date.now()}`,
        email,
        label,
        provider: conn.providerId === 'outlook' ? 'outlook' : 'gmail',
        dailyLimit: 250,
        sentToday: 0,
      });
      conn.status = 'connected';
      message = `Added mailbox ${email} to ${conn.name} (still counted as 1 ${conn.name} tool with ${conn.mailboxes.length} mailboxes).`;
    }

    store.recordAudit(ws.id, 'Workspace Admin', 'integration', `${conn.name}: ${message}`);
    res.json({ message, integration: conn, snapshot: store.getSnapshot(ws.id) });
  });

  // Built-in JSON-RPC 2.0 MCP Server endpoint (for external MCP clients or in-app live probe)
  app.post('/api/mcp', (req, res) => {
    const response = handleBuiltInMcpRequest(req.body ?? {});
    res.json(response);
  });

  // Live MCP capability & tools/list discovery probe
  app.post('/api/integrations/mcp/probe', async (req, res) => {
    const { transport, endpointUrl, command, envVarName, authMode, declaredTools } = req.body ?? {};
    const result = await probeMcpServer({
      transport: transport || 'streamable_http',
      endpointUrl,
      command,
      envVarName,
      authMode,
      declaredTools,
    });
    res.json(result);
  });

  // Unified Connect Tool endpoint supporting Plugins, MCP Servers, and Custom REST / Webhook APIs
  app.post('/api/integrations/connect-tool', async (req, res) => {
    const {
      workspaceId,
      protocol,
      name,
      description,
      // Plugin fields
      packageId,
      version,
      category,
      capabilities,
      // MCP fields
      transport,
      endpointUrl,
      command,
      authMode,
      envVarName,
      discoveredTools,
      // API fields
      baseUrl,
      authType,
      operations,
      fieldMappings,
    } = req.body ?? {};

    const ws = store.getWorkspace(workspaceId);
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Tool name is required.' });
    }

    const cleanName = String(name).trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    if (protocol === 'mcp') {
      const mcpTransport = (transport || 'streamable_http') as 'streamable_http' | 'sse' | 'stdio';
      const declared = Array.isArray(discoveredTools) ? discoveredTools : [];
      const probe = await probeMcpServer({
        transport: mcpTransport,
        endpointUrl,
        command,
        envVarName,
        authMode,
        declaredTools: declared,
      });

      const tools =
        probe.tools.length > 0
          ? probe.tools
          : declared.length > 0
          ? declared
          : [{ name: 'invoke_tool', description: `MCP tool exposed by ${cleanName}` }];

      const newConn = {
        id: `${ws.id}-mcp-${Date.now()}`,
        workspaceId: ws.id,
        providerId: `mcp_${slug}`,
        name: cleanName,
        protocol: 'mcp' as const,
        area: 'MCP Servers' as const,
        isCore: false,
        status: 'connected' as const,
        owner: 'Workspace Admin',
        description:
          description ||
          `MCP Server (${mcpTransport}) — ${endpointUrl || command || 'custom transport'}.`,
        allowedActions: tools.map((t: { name: string }) => t.name),
        lastSuccessfulRun: new Date().toISOString(),
        creditsRemaining: null,
        creditLimit: null,
        mailboxes: [],
        mcpConfig: {
          transport: mcpTransport,
          endpointUrl: endpointUrl ? String(endpointUrl).trim() : undefined,
          command: command ? String(command).trim() : undefined,
          authMode: (authMode || 'none') as 'none' | 'bearer_env' | 'header_env' | 'oauth',
          envVarName: envVarName ? String(envVarName).trim() : undefined,
          protocolVersion: probe.protocolVersion,
          discoveredTools: tools,
        },
      };

      store.db.integrations.push(newConn);
      store.recordAudit(
        ws.id,
        'Workspace Admin',
        'integration',
        `Connected MCP server "${newConn.name}" (${mcpTransport}, ${tools.length} tools).`
      );
      return res.json({
        integration: newConn,
        probeMessage: probe.message,
        liveVerified: probe.liveVerified,
        snapshot: store.getSnapshot(ws.id),
      });
    }

    if (protocol === 'plugin') {
      const caps =
        Array.isArray(capabilities) && capabilities.length > 0
          ? capabilities
          : ['enrich_company', 'capture_signals'];
      const newConn = {
        id: `${ws.id}-plugin-${Date.now()}`,
        workspaceId: ws.id,
        providerId: `plugin_${slug}`,
        name: cleanName,
        protocol: 'plugin' as const,
        area: (category || 'Prospect data & enrichment') as IntegrationConnection['area'],
        isCore: false,
        status: 'connected' as const,
        owner: 'Workspace Admin',
        description:
          description || `Installed GTM Plugin (${packageId || `@gtm-plugins/${slug}`}).`,
        allowedActions: caps,
        lastSuccessfulRun: new Date().toISOString(),
        creditsRemaining: null,
        creditLimit: null,
        mailboxes: [],
        pluginConfig: {
          packageId: String(packageId || `@gtm-plugins/${slug}`),
          version: String(version || '1.0.0'),
          category: String(category || 'Prospect data & enrichment'),
          capabilities: caps,
          envVarName: envVarName ? String(envVarName).trim() : undefined,
        },
      };

      store.db.integrations.push(newConn);
      store.recordAudit(
        ws.id,
        'Workspace Admin',
        'integration',
        `Installed plugin "${newConn.name}" (${newConn.pluginConfig.packageId}).`
      );
      return res.json({
        integration: newConn,
        probeMessage: `Installed plugin ${newConn.name} (${newConn.pluginConfig.packageId}) with ${caps.length} capabilities.`,
        snapshot: store.getSnapshot(ws.id),
      });
    }

    // Default: Direct REST / GraphQL / Webhook API
    if (!baseUrl) {
      return res.status(400).json({ error: 'API Base URL or Webhook URL is required.' });
    }
    const ops =
      Array.isArray(operations) && operations.length > 0 ? operations : ['POST /webhook'];
    const newConn = {
      id: `${ws.id}-api-${Date.now()}`,
      workspaceId: ws.id,
      providerId: `api_${slug}`,
      name: cleanName,
      protocol: 'api' as const,
      area: 'Custom REST / Webhook' as const,
      isCore: false,
      status: 'connected' as const,
      owner: 'Workspace Admin',
      description:
        description || `Direct ${authType || 'signed_webhook'} API connector to ${baseUrl}.`,
      allowedActions: ops,
      lastSuccessfulRun: new Date().toISOString(),
      creditsRemaining: null,
      creditLimit: null,
      mailboxes: [],
      customConfig: {
        baseUrl: String(baseUrl).trim(),
        authType: (authType || 'signed_webhook') as
          | 'bearer'
          | 'api_key'
          | 'signed_webhook'
          | 'oauth'
          | 'none',
        envVarName: envVarName ? String(envVarName).trim() : undefined,
        operations: ops,
        fieldMappings:
          fieldMappings && typeof fieldMappings === 'object'
            ? fieldMappings
            : { workEmail: 'email', companyName: 'account_name' },
      },
    };
    store.db.integrations.push(newConn);
    store.recordAudit(
      ws.id,
      'Workspace Admin',
      'integration',
      `Registered API connector "${newConn.name}" (${baseUrl}).`
    );
    return res.json({
      integration: newConn,
      probeMessage: `Registered REST/Webhook API connector "${newConn.name}".`,
      snapshot: store.getSnapshot(ws.id),
    });
  });

  app.post('/api/integrations/custom', (req, res) => {
    const { workspaceId, name, baseUrl, authType, operations, fieldMappings } = req.body ?? {};
    const ws = store.getWorkspace(workspaceId);
    if (!name || !baseUrl) {
      return res.status(400).json({ error: 'Connector name and endpoint URL are required.' });
    }
    const newConn = {
      id: `${ws.id}-custom-${Date.now()}`,
      workspaceId: ws.id,
      providerId: `custom_${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name: String(name).trim(),
      protocol: 'api' as const,
      area: 'Custom REST / Webhook' as const,
      isCore: false,
      status: 'connected' as const,
      owner: 'Workspace Admin',
      description: `Admin-configured ${authType || 'signed_webhook'} connector to ${baseUrl}.`,
      allowedActions: Array.isArray(operations) && operations.length > 0 ? operations : ['POST /webhook'],
      lastSuccessfulRun: new Date().toISOString(),
      creditsRemaining: null,
      creditLimit: null,
      mailboxes: [],
      customConfig: {
        baseUrl: String(baseUrl).trim(),
        authType: (authType || 'signed_webhook') as 'bearer' | 'api_key' | 'signed_webhook',
        operations: Array.isArray(operations) ? operations : ['POST /webhook'],
        fieldMappings: fieldMappings && typeof fieldMappings === 'object' ? fieldMappings : { workEmail: 'email', companyName: 'account_name' },
      },
    };
    store.db.integrations.push(newConn);
    store.recordAudit(ws.id, 'Workspace Admin', 'integration', `Registered custom connector "${newConn.name}" (${baseUrl}).`);
    res.json({ integration: newConn, snapshot: store.getSnapshot(ws.id) });
  });

  // Tasks, Saved Searches, Sequences
  app.post('/api/tasks', (req, res) => {
    const { workspaceId, campaignId, leadId, title, owner, dueDate } = req.body ?? {};
    const ws = store.getWorkspace(workspaceId);
    if (!title) return res.status(400).json({ error: 'Task title is required.' });
    const task = {
      id: `task-${Date.now()}`,
      workspaceId: ws.id,
      campaignId: campaignId || store.db.campaigns.find((c) => c.workspaceId === ws.id)!.id,
      leadId: leadId || null,
      title: String(title).trim(),
      owner: owner || 'Rohan Kulkarni',
      dueDate: dueDate || '2026-11-25',
      status: 'Open' as const,
      crmTaskId: null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    store.db.tasks.unshift(task);
    store.save();
    res.json({ task, snapshot: store.getSnapshot(ws.id) });
  });

  app.patch('/api/tasks/:taskId', (req, res) => {
    const task = store.db.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (req.body.status) task.status = req.body.status;
    if (req.body.owner) task.owner = req.body.owner;
    if (req.body.dueDate) task.dueDate = req.body.dueDate;
    store.save();
    res.json({ task, snapshot: store.getSnapshot(task.workspaceId) });
  });

  app.post('/api/saved-searches', (req, res) => {
    const { workspaceId, campaignId, name, prompt, filters, schedule } = req.body ?? {};
    const ws = store.getWorkspace(workspaceId);
    const ss = {
      id: `ss-${Date.now()}`,
      workspaceId: ws.id,
      campaignId,
      name: name || 'Saved Lead Search',
      prompt: prompt || '',
      filters,
      schedule: schedule || 'Weekly',
      lastRefreshedAt: new Date().toISOString(),
      lastMatchCount: store.db.leads.filter((l) => l.workspaceId === ws.id && l.campaignId === campaignId).length,
      newlyQualifyingCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    store.db.savedSearches.unshift(ss);
    store.save();
    res.json({ savedSearch: ss, snapshot: store.getSnapshot(ws.id) });
  });

  app.post('/api/saved-searches/:id/refresh', (req, res) => {
    const ss = store.db.savedSearches.find((s) => s.id === req.params.id);
    if (!ss) return res.status(404).json({ error: 'Saved search not found' });
    ss.lastRefreshedAt = new Date().toISOString();
    ss.newlyQualifyingCount = ss.newlyQualifyingCount + 1;
    store.save();
    res.json({ savedSearch: ss, snapshot: store.getSnapshot(ss.workspaceId) });
  });

  app.post('/api/sequences/:id/activate', (req, res) => {
    const seq = store.db.sequences.find((s) => s.id === req.params.id);
    if (!seq) return res.status(404).json({ error: 'Sequence not found' });
    if (!seq.replyStopSupported) {
      seq.status = 'paused_no_reply_signal';
      store.save();
      return res.status(400).json({
        error: `Automated follow-ups remain paused for "${seq.name}" because ${seq.channel} cannot report automatic reply stop signals.`,
        snapshot: store.getSnapshot(seq.workspaceId),
      });
    }
    const leadIds = Array.isArray(req.body?.leadIds) ? (req.body.leadIds as string[]) : [];
    const ws = store.getWorkspace(seq.workspaceId);
    const eligible = leadIds.filter((id) => {
      const lead = store.db.leads.find((l) => l.id === id);
      return lead && !isLeadSuppressed(lead, ws.suppressions).suppressed;
    });
    seq.status = 'active';
    seq.enrolledLeadIds = Array.from(new Set([...seq.enrolledLeadIds, ...eligible]));
    store.recordAudit(ws.id, 'Workspace User', 'email', `Activated sequence "${seq.name}" with ${seq.enrolledLeadIds.length} eligible leads (reply/unsubscribe/bounce stop enabled).`);
    res.json({ sequence: seq, snapshot: store.getSnapshot(ws.id) });
  });

  // Dev Vite middleware or production dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SignalStack GTM server listening on http://localhost:${PORT}`);
  });
}

startServer();
