import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import * as XLSX from 'xlsx';
import {
  assignTerritoryOwner,
  computeConversionFunnel,
  countConnectedTools,
  deduplicateLeads,
  DEFAULT_SCORING_RULES,
  explainLeadRanking,
  isLeadSuppressed,
  isSignalWithinWindow,
  normalizeDomain,
  normalizeEmail,
  parseChatCommand,
  scoreLead,
} from './workflowEngine';
import { store } from '../../server/store';
import { processChatMessage, resumeWorkflowRun } from '../../server/worker';
import {
  DEMO_WORKSPACE_ID,
  LIVE_WORKSPACE_ID,
} from '../../server/demoFixtures';

test('domain and email normalization cleans protocols, www, paths, and whitespace', () => {
  assert.equal(normalizeDomain('https://www.SahyadriFlexiPack.example/careers'), 'sahyadriflexipack.example');
  assert.equal(normalizeEmail('  Ananya.Deshmukh@SahyadriFlexiPack.example '), 'ananya.deshmukh@sahyadriflexipack.example');
});

test('90-day signal window filters strictly on eventDate, never observedAt', () => {
  const recent = {
    id: 's1',
    type: 'Hiring' as const,
    title: 'Production Shift Supervisor',
    summary: 'Hiring',
    sourceName: 'Careers',
    sourceUrlOrId: 'https://example.com/jobs/1',
    eventDate: '2026-10-15',
    observedAt: '2026-11-18T10:00:00Z',
  };
  const stale = {
    ...recent,
    id: 's2',
    eventDate: '2026-06-15', // >90 days before 2026-11-18 even though observedAt is today!
  };
  assert.equal(isSignalWithinWindow(recent, 90, '2026-11-18'), true);
  assert.equal(isSignalWithinWindow(stale, 90, '2026-11-18'), false);
});

test('connected tools rule: fresh live workspace starts at 0; 2 Gmail mailboxes = 1 tool; Gmail + Sheets = 2 tools', () => {
  store.reset();
  const liveSnap = store.getSnapshot(LIVE_WORKSPACE_ID);
  assert.equal(liveSnap.connectedToolCount, 0);

  const gmail = liveSnap.integrations.find((i) => i.providerId === 'gmail')!;
  const sheets = liveSnap.integrations.find((i) => i.providerId === 'google_sheets')!;
  gmail.status = 'connected';
  gmail.mailboxes = [
    { id: 'm1', email: 'a@org.example', label: 'A', provider: 'gmail', dailyLimit: 250, sentToday: 0 },
    { id: 'm2', email: 'b@org.example', label: 'B', provider: 'gmail', dailyLimit: 250, sentToday: 0 },
  ];
  assert.equal(countConnectedTools(liveSnap.integrations), 1);

  sheets.status = 'connected';
  assert.equal(countConnectedTools(liveSnap.integrations), 2);
});

test('Maharashtra two-turn acceptance test: discovery, Pune verified filter, reconciled score explanation, 3-sheet Excel top 10, 1 team draft & 0 prospect messages', async () => {
  store.reset();
  const snap0 = store.getSnapshot(DEMO_WORKSPACE_ID);
  const thread = snap0.threads[0];
  const outboundCmp = snap0.campaigns.find((c) => c.id === 'cmp-mh-packaging')!;
  const inboundCmpBefore = JSON.stringify(
    snap0.campaigns.find((c) => c.id === 'cmp-inbound-franchise')!.filters
  );

  // Turn 1: Maharashtra packaging search excluding HubSpot customers
  const turn1 = await processChatMessage({
    workspaceId: DEMO_WORKSPACE_ID,
    threadId: thread.id,
    campaignId: outboundCmp.id,
    prompt:
      'Find up to 25 heads of operations at packaging manufacturers headquartered in Maharashtra with 50–500 employees. Prioritize companies that posted a production hiring notice in the last 90 days. Exclude our existing HubSpot customers.',
    fastMode: true,
  });

  assert.ok(turn1.run);
  assert.equal(turn1.run.status, 'completed');
  assert.equal(turn1.run.excludedCount, 2); // Konkan BoxWorks + Western Laminates excluded
  assert.equal(turn1.assistantMessage.leadIds?.length, 16);
  assert.ok(turn1.assistantMessage.shortfallReason && turn1.assistantMessage.shortfallReason.includes('16 of 25'));

  // Every dated signal on returned leads links to its source URL/ID
  const turn1Leads = store.db.leads.filter((l) => turn1.assistantMessage.leadIds?.includes(l.id));
  for (const lead of turn1Leads) {
    assert.ok(lead.signals.length > 0);
    for (const sig of lead.signals) {
      assert.ok(sig.eventDate.length === 10);
      assert.ok(sig.sourceUrlOrId.startsWith('http'));
    }
  }

  // Turn 2: Keep only Pune-headquartered with verified work emails + explain #1 + export top 10 to Excel + draft email to sales@example.com
  const turn2 = await processChatMessage({
    workspaceId: DEMO_WORKSPACE_ID,
    threadId: thread.id,
    campaignId: outboundCmp.id,
    prompt:
      'Keep only Pune-headquartered companies with verified work emails. Why did the first lead rank highest? Export the top 10 to Excel and draft an email to sales@example.com with the file attached.',
    fastMode: true,
  });

  assert.equal(turn2.assistantMessage.leadIds?.length, 10);
  const top10Leads = (turn2.assistantMessage.leadIds ?? []).map(
    (id) => store.db.leads.find((l) => l.id === id)!
  );
  assert.ok(top10Leads.every((l) => l.companyHqCity === 'Pune' && l.emailStatus === 'valid'));

  // Verify score explanation reconciles mathematically to displayed #1 score
  const explanation = turn2.assistantMessage.scoreExplanation;
  assert.ok(explanation);
  assert.equal(explanation.leadId, top10Leads[0].id);
  assert.equal(explanation.reconciledSum, top10Leads[0].scoreTotal);
  const manualSum = explanation.factors.reduce((sum, f) => sum + f.points, 0);
  assert.equal(manualSum, explanation.scoreTotal);

  // Verify genuine Excel file has 3 sheets (Leads, Evidence, Campaign Summary) and exact 10 rows
  const exportId = turn2.assistantMessage.exportArtifactId;
  assert.ok(exportId);
  const artifact = store.db.exports.find((e) => e.id === exportId)!;
  assert.equal(artifact.format, 'xlsx');
  assert.equal(artifact.rowCount, 10);
  const filePath = store.db.exportFiles[exportId];
  assert.ok(filePath && fs.existsSync(filePath));
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
  assert.deepEqual(wb.SheetNames, ['Leads', 'Evidence', 'Campaign Summary']);
  const excelLeadRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Leads']);
  assert.equal(excelLeadRows.length, 10);
  assert.equal(excelLeadRows[0].lead_id, top10Leads[0].id);

  // Verify sharing report creates exactly 1 team draft with that exact file attached and 0 prospect messages
  const draftsCreated = store.db.drafts.filter((d) => d.workspaceId === DEMO_WORKSPACE_ID);
  assert.equal(draftsCreated.length, 1);
  assert.equal(draftsCreated[0].kind, 'team_report');
  assert.deepEqual(draftsCreated[0].recipients, ['sales@example.com']);
  assert.equal(draftsCreated[0].attachmentExportId, exportId);
  assert.equal(draftsCreated[0].attachmentFileName, artifact.fileName);
  assert.equal(draftsCreated.filter((d) => d.kind === 'prospect_outreach').length, 0);

  // Verify filtering ONLY changed outbound campaign, leaving inbound campaign untouched
  const inboundCmpAfter = JSON.stringify(
    store.db.campaigns.find((c) => c.id === 'cmp-inbound-franchise')!.filters
  );
  assert.equal(inboundCmpAfter, inboundCmpBefore);
});

test('interrupted workflow run resumes from last completed step preserving action IDs', async () => {
  store.reset();
  const snap = store.getSnapshot(DEMO_WORKSPACE_ID);
  const res = await processChatMessage({
    workspaceId: DEMO_WORKSPACE_ID,
    threadId: snap.threads[0].id,
    campaignId: 'cmp-mh-packaging',
    prompt: 'Find up to 25 heads of operations at packaging manufacturers headquartered in Maharashtra with 50–500 employees.',
    fastMode: true,
  });
  const run = res.run!;
  // Simulate interruption after step 3
  const step3CompletedAt = run.steps[2].completedAt;
  const step3ActionId = run.steps[2].actionId;
  run.status = 'paused';
  for (let i = 3; i < run.steps.length; i++) {
    run.steps[i].status = 'paused';
    run.steps[i].completedAt = null;
  }

  const resumed = await resumeWorkflowRun(run.id);
  assert.ok(resumed);
  assert.equal(resumed.status, 'completed');
  // Completed steps 1–3 preserved their exact actionId & timestamp without re-running!
  assert.equal(resumed.steps[2].actionId, step3ActionId);
  assert.equal(resumed.steps[2].completedAt, step3CompletedAt);
  assert.ok(resumed.steps.every((s) => s.status === 'completed'));
});

test('inbound retail franchise use case: deduplication, city owner assignment, HubSpot sync, and city-level Excel summary', async () => {
  store.reset();
  const snap = store.getSnapshot(DEMO_WORKSPACE_ID);
  const thread = snap.threads[0];

  const inboundTurn = await processChatMessage({
    workspaceId: DEMO_WORKSPACE_ID,
    threadId: thread.id,
    campaignId: 'cmp-inbound-franchise',
    prompt:
      'Import opted-in retail franchise inquiries, deduplicate repeated submissions, assign owners by city, sync eligible records to HubSpot CRM, and export a city-level Excel summary.',
    fastMode: true,
  });

  // 10 raw opted-in inquiries -> 2 duplicates merged -> 8 unique leads
  assert.ok(inboundTurn.assistantMessage.inboundSummary);
  assert.equal(inboundTurn.assistantMessage.inboundSummary.rawCount, 10);
  assert.equal(inboundTurn.assistantMessage.inboundSummary.duplicatesMerged, 2);
  assert.equal(inboundTurn.assistantMessage.inboundSummary.deduplicatedCount, 8);

  // Check city-based territory routing & retained acquisition sources
  const inboundLeads = (inboundTurn.assistantMessage.leadIds ?? []).map(
    (id) => store.db.leads.find((l) => l.id === id)!
  );
  const puneLead = inboundLeads.find((l) => l.companyHqCity === 'Pune')!;
  const bengaluruLead = inboundLeads.find((l) => l.companyHqCity === 'Bengaluru')!;
  const delhiLead = inboundLeads.find((l) => l.companyHqCity === 'Delhi NCR')!;
  assert.equal(puneLead.owner, 'Rohan Kulkarni');
  assert.equal(bengaluruLead.owner, 'Karthik Nair');
  assert.equal(delhiLead.owner, 'Anjali Verma');
  assert.ok(puneLead.acquisitionSource.includes('+')); // Retained both merged sources!

  // Verify CRM sync populated HubSpot IDs & URLs preserving owners
  assert.ok(inboundTurn.assistantMessage.crmSyncSummary);
  assert.equal(inboundTurn.assistantMessage.crmSyncSummary.syncedCount, 8);
  assert.ok(inboundLeads.every((l) => l.crmRecordId && l.crmRecordUrl));

  // Verify Excel export contains city summary in Campaign Summary sheet
  const expId = inboundTurn.assistantMessage.exportArtifactId!;
  const wb = XLSX.read(fs.readFileSync(store.db.exportFiles[expId]), { type: 'buffer' });
  const summaryRows = XLSX.utils.sheet_to_json<{ Metric: string; Value: string }>(
    wb.Sheets['Campaign Summary']
  );
  assert.ok(summaryRows.some((r) => String(r.Metric).includes('Pune')));
  assert.ok(summaryRows.some((r) => String(r.Metric).includes('Bengaluru')));
});

test('suppression enforcement and conversion funnel denominators compute accurately', () => {
  const suppressed = isLeadSuppressed(
    {
      workEmail: 'test@konkanboxworks.example',
      companyDomain: 'konkanboxworks.example',
      engagementEvents: [],
    },
    [{ id: 's1', pattern: '@konkanboxworks.example', reason: 'customer', createdAt: '2026-10-01' }]
  );
  assert.equal(suppressed.suppressed, true);

  const funnel = computeConversionFunnel([
    {
      qualificationLabel: 'Qualified',
      engagementEvents: [
        { id: '1', type: 'contacted', date: '2026-11-10', channel: 'email', note: '' },
        { id: '2', type: 'replied', date: '2026-11-11', channel: 'email', note: '' },
      ],
    } as never,
    {
      qualificationLabel: 'Qualified',
      engagementEvents: [
        { id: '3', type: 'contacted', date: '2026-11-10', channel: 'email', note: '' },
      ],
    } as never,
    {
      qualificationLabel: 'Needs review',
      engagementEvents: [],
    } as never,
  ]);
  assert.equal(funnel.found, 3);
  assert.equal(funnel.qualified, 2);
  assert.equal(funnel.replyRate.numerator, 1);
  assert.equal(funnel.replyRate.denominator, 2);
  assert.equal(funnel.replyRate.pct, 50);
});

test('installed exporters generate genuine CSV, JSON, Parquet (PAR1), and PDF (%PDF-) files', async () => {
  const { generateExportArtifact } = await import('../../server/exporters');
  const { buildMaharashtraFixtureLeads, DEFAULT_OUTBOUND_FILTERS } = await import('../../server/demoFixtures');
  const sampleLeads = buildMaharashtraFixtureLeads(DEMO_WORKSPACE_ID, 'cmp-mh-packaging').slice(0, 3);
  const campaign = store.getSnapshot(DEMO_WORKSPACE_ID).campaigns[0];

  for (const format of ['csv', 'json', 'parquet', 'pdf'] as const) {
    const { artifact, filePath } = await generateExportArtifact({
      workspaceId: DEMO_WORKSPACE_ID,
      campaign,
      runId: null,
      leads: sampleLeads,
      format,
      filters: DEFAULT_OUTBOUND_FILTERS,
    });
    assert.equal(artifact.rowCount, 3);
    assert.ok(filePath && fs.existsSync(filePath));
    const buf = fs.readFileSync(filePath);
    assert.ok(buf.length > 20);
    if (format === 'parquet') {
      assert.equal(buf.subarray(0, 4).toString('ascii'), 'PAR1');
    } else if (format === 'pdf') {
      assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
    } else if (format === 'json') {
      const parsed = JSON.parse(buf.toString('utf-8'));
      assert.equal(parsed.rowCount, 3);
    } else if (format === 'csv') {
      assert.ok(buf.toString('utf-8').includes('Sahyadri FlexiPack'));
    }
  }
});

test('built-in MCP JSON-RPC 2.0 server handles initialize, tools/list, and tools/call accurately', async () => {
  store.reset();
  const { handleBuiltInMcpRequest } = await import('../../server/mcpBridge');

  const initRes = handleBuiltInMcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  assert.equal(initRes.jsonrpc, '2.0');
  assert.equal((initRes.result as { protocolVersion: string }).protocolVersion, '2025-03-26');

  const listRes = handleBuiltInMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const tools = (listRes.result as { tools: Array<{ name: string }> }).tools;
  assert.equal(tools.length, 3);
  assert.deepEqual(
    tools.map((t) => t.name),
    ['search_gtm_leads', 'list_workspace_campaigns', 'get_connected_tools']
  );

  const callRes = handleBuiltInMcpRequest({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get_connected_tools',
      arguments: { workspaceId: DEMO_WORKSPACE_ID },
    },
  });
  const textPayload = (callRes.result as { content: Array<{ text: string }> }).content[0].text;
  const parsed = JSON.parse(textPayload);
  assert.equal(parsed.connectedToolCount, 6);
  assert.equal(parsed.tools.length, 6);
});

test('connected tool count increments cleanly for newly registered MCP servers, plugins, and custom APIs', () => {
  store.reset();
  const liveSnap = store.getSnapshot(LIVE_WORKSPACE_ID);
  assert.equal(countConnectedTools(liveSnap.integrations), 0);

  const extended = [
    ...liveSnap.integrations,
    {
      id: 'ws-live-mcp-1',
      workspaceId: LIVE_WORKSPACE_ID,
      providerId: 'mcp_hubspot',
      name: 'HubSpot MCP',
      protocol: 'mcp' as const,
      area: 'MCP Servers' as const,
      isCore: false,
      status: 'connected' as const,
      owner: 'Workspace Admin',
      description: 'HubSpot MCP',
      allowedActions: ['hubspot_search_companies'],
      lastSuccessfulRun: '2026-11-19T00:00:00Z',
      creditsRemaining: null,
      creditLimit: null,
      mailboxes: [],
    },
    {
      id: 'ws-live-plugin-1',
      workspaceId: LIVE_WORKSPACE_ID,
      providerId: 'plugin_firecrawl',
      name: 'Firecrawl Plugin',
      protocol: 'plugin' as const,
      area: 'Social & inbound' as const,
      isCore: false,
      status: 'connected' as const,
      owner: 'Workspace Admin',
      description: 'Firecrawl',
      allowedActions: ['scrape_careers_page'],
      lastSuccessfulRun: '2026-11-19T00:00:00Z',
      creditsRemaining: null,
      creditLimit: null,
      mailboxes: [],
    },
    {
      id: 'ws-live-api-1',
      workspaceId: LIVE_WORKSPACE_ID,
      providerId: 'api_erp',
      name: 'ERP API',
      protocol: 'api' as const,
      area: 'Custom REST / Webhook' as const,
      isCore: false,
      status: 'connected' as const,
      owner: 'Workspace Admin',
      description: 'ERP API',
      allowedActions: ['GET /accounts/exclusions'],
      lastSuccessfulRun: '2026-11-19T00:00:00Z',
      creditsRemaining: null,
      creditLimit: null,
      mailboxes: [],
    },
  ];
  assert.equal(countConnectedTools(extended), 3);
});

test('GTM tool catalog covers all 33 tools across the 6 requested categories', async () => {
  const { GTM_CATALOG_CATEGORIES, GTM_TOOL_CATALOG } = await import('./gtmToolCatalog');
  assert.equal(GTM_CATALOG_CATEGORIES.length, 6);
  assert.equal(GTM_TOOL_CATALOG.length, 33);

  const expectedCounts: Record<string, number> = {
    'Data, Scraping & Enrichment': 9,
    'Intent & Buying Signals': 6,
    'Workflow Automation & Orchestration': 4,
    'Cold Email & Multi-Channel Outreach': 6,
    'CRM (Customer Relationship Management)': 4,
    'AI Research & Call Intelligence': 4,
  };
  for (const [cat, expected] of Object.entries(expectedCounts)) {
    const actual = GTM_TOOL_CATALOG.filter((t) => t.category === cat).length;
    assert.equal(actual, expected, `Category "${cat}" should have ${expected} tools`);
  }
});

test('starter stack recommender returns 3–4 distinct tailored tools for every budget, channel, and stage combination', async () => {
  const { recommendStarterStack } = await import('./gtmToolCatalog');
  const budgets = ['bootstrapped', 'funded_enterprise'] as const;
  const channels = ['cold_email', 'linkedin', 'inbound', 'all'] as const;
  const stages = ['solo_founder', 'startup', 'enterprise'] as const;

  for (const budget of budgets) {
    for (const channel of channels) {
      for (const stage of stages) {
        const rec = recommendStarterStack({ budget, channel, stage });
        assert.ok(
          rec.tools.length >= 3 && rec.tools.length <= 4,
          `Expected 3-4 tools for ${budget}/${channel}/${stage}, got ${rec.tools.length}`
        );
        const ids = new Set(rec.tools.map((e) => e.tool.id));
        assert.equal(ids.size, rec.tools.length, 'Recommended tools must be unique');
      }
    }
  }

  const soloCold = recommendStarterStack({
    budget: 'bootstrapped',
    channel: 'cold_email',
    stage: 'solo_founder',
  });
  assert.deepEqual(
    soloCold.tools.map((e) => e.tool.name),
    ['Apollo.io', 'Instantly', 'Attio', 'Claude / Claude Code']
  );

  const enterpriseAll = recommendStarterStack({
    budget: 'funded_enterprise',
    channel: 'all',
    stage: 'enterprise',
  });
  assert.deepEqual(
    enterpriseAll.tools.map((e) => e.tool.name),
    ['ZoomInfo', 'Outreach', 'Salesforce', 'Gong']
  );
});



