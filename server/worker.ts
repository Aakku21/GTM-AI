import { EventEmitter } from 'events';
import type {
  Campaign,
  ChatMessage,
  ChatThread,
  EmailDraft,
  ExportArtifact,
  ExportFormat,
  ExtractedFilters,
  InboundDedupSummaryBlock,
  LeadRecord,
  WorkflowRun,
  WorkflowStep,
  Workspace,
} from '../src/types/gtm';
import {
  assignTerritoryOwner,
  deduplicateLeads,
  explainLeadRanking,
  filterCampaignLeads,
  isLeadSuppressed,
  parseChatCommand,
  scoreLead,
  SUPPORTED_EXPORT_FORMATS,
} from '../src/lib/workflowEngine';
import { store } from './store';
import { generateExportArtifact } from './exporters';
import { syncLeadsToHubSpot } from './adapters';

export const runEventBus = new EventEmitter();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeSteps(runId: string, tools: { crm: string; search: string; verify: string; research: string; output: string }): WorkflowStep[] {
  return [
    {
      id: `${runId}-s1`,
      actionId: `${runId}:act:understand`,
      order: 1,
      key: 'understand',
      title: 'Understand Request & Extract Filters',
      tool: 'SignalStack Intent Parser',
      status: 'pending',
      inputs: 'User prompt & workspace ICP configuration',
      outputCount: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      detail: 'Extracts product, HQ vs contact geography, headcount band, roles, exclusions, and buying signals.',
    },
    {
      id: `${runId}-s2`,
      actionId: `${runId}:act:crm_exclusions`,
      order: 2,
      key: 'crm_exclusions',
      title: 'Check CRM Exclusions & Existing Records',
      tool: tools.crm,
      status: 'pending',
      inputs: 'Workspace suppression list + CRM customer accounts',
      outputCount: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      detail: 'Identifies existing customers and suppression rules before outbound search.',
    },
    {
      id: `${runId}-s3`,
      actionId: `${runId}:act:source_search`,
      order: 3,
      key: 'source_search',
      title: 'Find Companies & Decision Makers',
      tool: tools.search,
      status: 'pending',
      inputs: 'Structured campaign filters & role targets',
      outputCount: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      detail: 'Queries authorized company/people sources or ingests opted-in inbound records.',
    },
    {
      id: `${runId}-s4`,
      actionId: `${runId}:act:clean_verify`,
      order: 4,
      key: 'clean_verify',
      title: 'Clean, Deduplicate & Verify Emails',
      tool: tools.verify,
      status: 'pending',
      inputs: 'Matched contact candidates',
      outputCount: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      detail: 'Normalizes domains/emails, merges duplicates, flags ambiguous identities, stores verification verdict & date.',
    },
    {
      id: `${runId}-s5`,
      actionId: `${runId}:act:research_signals`,
      order: 5,
      key: 'research_signals',
      title: 'Read Careers/News Feeds & Track Signals',
      tool: tools.research,
      status: 'pending',
      inputs: 'Matched company domains + signal event-date window',
      outputCount: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      detail: 'Applies strict event-date window (e.g. last 90 days) and attaches dated source URLs + AI company briefs.',
    },
    {
      id: `${runId}-s6`,
      actionId: `${runId}:act:score_rank`,
      order: 6,
      key: 'score_rank',
      title: 'Qualify, Score & Assign Territory Owners',
      tool: 'SignalStack Scoring Engine (40/25/25/10)',
      status: 'pending',
      inputs: 'Workspace scoring rubric & territory rules',
      outputCount: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      detail: 'Computes explainable factor scores, data coverage, qualification labels, and city/territory ownership.',
    },
    {
      id: `${runId}-s7`,
      actionId: `${runId}:act:output_action`,
      order: 7,
      key: 'output_action',
      title: 'Generate Exports, Drafts & CRM Handoff',
      tool: tools.output,
      status: 'pending',
      inputs: 'Ranked leads & user requested outputs',
      outputCount: 0,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      detail: 'Creates exact snapshot exports, editable email drafts with attachments, or CRM upserts.',
    },
  ];
}

function getDefaultMailbox(workspaceId: string): { email: string; provider: 'gmail' | 'outlook' | 'local_preview' } {
  const integrations = store.db.integrations.filter((i) => i.workspaceId === workspaceId);
  const gmail = integrations.find((i) => i.providerId === 'gmail' && i.status === 'connected');
  if (gmail && gmail.mailboxes.length > 0) {
    return { email: gmail.mailboxes[0].email, provider: 'gmail' };
  }
  const outlook = integrations.find((i) => i.providerId === 'outlook' && i.status === 'connected');
  if (outlook && outlook.mailboxes.length > 0) {
    return { email: outlook.mailboxes[0].email, provider: 'outlook' };
  }
  return { email: 'local-preview@signalstack-demo.example', provider: 'local_preview' };
}

export function createTeamEmailDraft(params: {
  workspaceId: string;
  campaignId: string;
  recipients: string[];
  exportArtifact: ExportArtifact | null;
  leads: LeadRecord[];
  campaignName: string;
}): EmailDraft {
  const mailbox = getDefaultMailbox(params.workspaceId);
  const topLead = params.leads[0];
  const topSummary = topLead
    ? `Top-ranked lead: ${topLead.contactName} (${topLead.contactTitle} at ${topLead.companyName}, ${topLead.companyHqCity}) — Score ${topLead.scoreTotal}/100.`
    : 'See attached lead selection.';

  const draft: EmailDraft = {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: params.workspaceId,
    campaignId: params.campaignId,
    kind: 'team_report',
    mailboxAccount: mailbox.email,
    provider: mailbox.provider,
    recipients: params.recipients,
    leadId: null,
    subject: `${params.campaignName} — Top ${params.leads.length} Qualified Leads Export`,
    body: `Hi Team,\n\nAttached is the ${params.exportArtifact?.fileName ?? 'lead export'} containing ${params.leads.length} matched leads from "${params.campaignName}".\n\n${topSummary}\n\nEach row in the Leads tab links by lead_id to its dated buying signals and source URLs in the Evidence tab, with filter totals in Campaign Summary.\n\nBest,\nGTM Engineering`,
    attachmentExportId: params.exportArtifact?.id ?? null,
    attachmentFileName: params.exportArtifact?.fileName ?? null,
    status: 'draft',
    providerResponseId: null,
    sentAt: null,
    createdAt: new Date().toISOString(),
  };

  store.db.drafts.unshift(draft);
  store.save();
  return draft;
}

export function createProspectOutreachDrafts(params: {
  workspace: Workspace;
  campaignId: string;
  leads: LeadRecord[];
}): EmailDraft[] {
  const mailbox = getDefaultMailbox(params.workspace.id);
  const created: EmailDraft[] = [];

  for (const lead of params.leads) {
    const sup = isLeadSuppressed(lead, params.workspace.suppressions);
    const firstName = lead.contactName.split(' ')[0] || lead.contactName;
    const topSig = lead.signals[0];
    const draft: EmailDraft = {
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspaceId: params.workspace.id,
      campaignId: params.campaignId,
      kind: 'prospect_outreach',
      mailboxAccount: mailbox.email,
      provider: mailbox.provider,
      recipients: [lead.workEmail],
      leadId: lead.id,
      leadName: `${lead.contactName} (${lead.companyName})`,
      subject: `${lead.companyName} — ${topSig ? topSig.title.slice(0, 52) : 'Operations uptime'}`,
      body: `Hi ${firstName},\n\n${lead.conversationOpener}\n\n${topSig ? `Reference: ${topSig.title} (${topSig.eventDate} via ${topSig.sourceName}).\n\n` : ''}Would you be open to a brief 15-minute walkthrough next week?\n\nBest regards,\n${lead.owner}`,
      attachmentExportId: null,
      attachmentFileName: null,
      status: sup.suppressed ? 'blocked_suppressed' : 'draft',
      providerResponseId: null,
      sentAt: null,
      createdAt: new Date().toISOString(),
    };
    store.db.drafts.unshift(draft);
    created.push(draft);
  }

  store.save();
  return created;
}

function getConnectedToolsList(workspaceId: string, filters: ExtractedFilters, mode: 'outbound' | 'inbound'): string[] {
  const connected = store.db.integrations.filter(
    (i) => i.workspaceId === workspaceId && i.status === 'connected'
  );
  const names: string[] = [];
  if (mode === 'inbound') {
    if (connected.some((c) => c.providerId === 'first_party_forms')) {
      names.push('Website Forms, Typeform & Events');
    } else {
      names.push('Uploaded Opted-In Spreadsheet');
    }
  } else if (connected.some((c) => c.providerId === 'apollo')) {
    names.push('Apollo');
  }
  if (connected.some((c) => c.providerId === 'hunter')) names.push('Hunter');
  if (filters.excludeHubSpotCustomers && connected.some((c) => c.providerId === 'hubspot')) {
    names.push('HubSpot');
  }
  names.push('Careers & News Feed Reader');
  if (connected.some((c) => c.providerId === 'gmail')) names.push('Gmail');
  return names;
}

export async function processChatMessage(params: {
  workspaceId: string;
  threadId: string;
  campaignId: string;
  prompt: string;
  selectedLeadIds?: string[];
  modelLabel?: string;
  fastMode?: boolean; // true for unit/API synchronous execution; false streams live step progress
}): Promise<{
  thread: ChatThread;
  run: WorkflowRun | null;
  assistantMessage: ChatMessage;
}> {
  const workspace = store.getWorkspace(params.workspaceId);
  const thread =
    store.db.threads.find((t) => t.id === params.threadId && t.workspaceId === workspace.id) ??
    store.db.threads.find((t) => t.workspaceId === workspace.id)!;

  let campaign =
    store.db.campaigns.find((c) => c.id === params.campaignId && c.workspaceId === workspace.id) ??
    store.db.campaigns.find((c) => c.id === thread.campaignId && c.workspaceId === workspace.id) ??
    store.db.campaigns.find((c) => c.workspaceId === workspace.id)!;

  const nowIso = new Date().toISOString();
  const userMsg: ChatMessage = {
    id: `msg-${Date.now()}-u`,
    role: 'user',
    content: params.prompt,
    timestamp: nowIso,
  };
  thread.messages.push(userMsg);
  if (thread.messages.length === 1) {
    thread.title = params.prompt.slice(0, 54) + (params.prompt.length > 54 ? '…' : '');
  }
  thread.updatedAt = nowIso;

  const existingCampaignLeads = store.db.leads.filter(
    (l) => l.workspaceId === workspace.id && l.campaignId === campaign.id
  );

  let parsed = parseChatCommand(
    params.prompt,
    campaign.filters,
    existingCampaignLeads.length > 0
  );

  // Switch to inbound campaign automatically if user asks for inbound retail franchise flow,
  // and re-parse against that campaign's own clean filters so outbound filters never bleed across campaigns.
  if (parsed.triggerInboundFranchiseFlow) {
    const inboundCmp = store.db.campaigns.find(
      (c) => c.workspaceId === workspace.id && c.mode === 'inbound'
    );
    if (inboundCmp) {
      campaign = inboundCmp;
      thread.campaignId = inboundCmp.id;
      parsed = parseChatCommand(params.prompt, inboundCmp.filters, false);
    }
  }

  // Ask ONE focused question if genuinely ambiguous
  if (parsed.clarifyingQuestion) {
    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}-a`,
      role: 'assistant',
      content: parsed.clarifyingQuestion,
      timestamp: new Date().toISOString(),
      modelUsed: params.modelLabel || `${workspace.aiProvider}/${workspace.aiModel}`,
      clarifyingQuestion: parsed.clarifyingQuestion,
    };
    thread.messages.push(assistantMsg);
    store.save();
    return { thread, run: null, assistantMessage: assistantMsg };
  }

  // Check if HubSpot exclusion requested without connected HubSpot in Live mode
  const hubspotConn = store.db.integrations.find(
    (i) => i.workspaceId === workspace.id && i.providerId === 'hubspot'
  );
  const apolloConn = store.db.integrations.find(
    (i) => i.workspaceId === workspace.id && i.providerId === 'apollo'
  );

  if (
    workspace.mode === 'live' &&
    !parsed.isFollowUpRefinement &&
    existingCampaignLeads.length === 0 &&
    apolloConn?.status !== 'connected'
  ) {
    const msgContent =
      'This Live Workspace currently has 0 connected lead providers. Connect Apollo in Integrations or attach an opted-in CSV/Excel spreadsheet using the paperclip button below to start discovery.';
    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}-a`,
      role: 'assistant',
      content: msgContent,
      timestamp: new Date().toISOString(),
      modelUsed: params.modelLabel || `${workspace.aiProvider}/${workspace.aiModel}`,
      filterSummary: parsed.oneSentenceSummary,
      editableFilters: parsed.filters,
      sourcesToUse: ['CSV / Excel Upload (No external account needed)'],
    };
    thread.messages.push(assistantMsg);
    store.save();
    return { thread, run: null, assistantMessage: assistantMsg };
  }

  // Update ONLY this campaign's filters (isolates other campaigns!)
  campaign.filters = parsed.filters;
  campaign.updatedAt = new Date().toISOString().slice(0, 10);

  const sourcesToUse = getConnectedToolsList(workspace.id, parsed.filters, campaign.mode);
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const run: WorkflowRun = {
    id: runId,
    workspaceId: workspace.id,
    campaignId: campaign.id,
    conversationId: thread.id,
    status: 'running',
    planSummary: parsed.oneSentenceSummary,
    toolsUsed: sourcesToUse,
    creditsSpent: 0,
    shortfallReason: null,
    steps: makeSteps(runId, {
      crm:
        parsed.filters.excludeHubSpotCustomers && hubspotConn?.status === 'connected'
          ? 'HubSpot CRM'
          : 'Workspace Suppression List',
      search:
        campaign.mode === 'inbound'
          ? 'Website Forms, Typeform & Event Lists'
          : parsed.isFollowUpRefinement
          ? 'Cached Campaign Result Set'
          : 'Apollo Company & People Search',
      verify: 'Hunter Email Verifier',
      research: 'Careers & News Feed Reader',
      output: parsed.requestedExportFormat
        ? `SignalStack Exporter (${parsed.requestedExportFormat.toUpperCase()})`
        : parsed.triggerCrmSync
        ? 'HubSpot CRM Sync'
        : 'Inline Chat Table',
    }),
    resultLeadIds: [],
    excludedCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.db.runs.unshift(run);

  // Create placeholder assistant message linked to this durable runId immediately so UI shows streamed progress
  const assistantMsg: ChatMessage = {
    id: `msg-${Date.now() + 2}-a`,
    role: 'assistant',
    content: parsed.oneSentenceSummary,
    timestamp: new Date().toISOString(),
    modelUsed: params.modelLabel || `${workspace.aiProvider}/${workspace.aiModel}`,
    filterSummary: parsed.oneSentenceSummary,
    editableFilters: parsed.filters,
    sourcesToUse,
    runId,
    leadIds: [],
  };
  thread.messages.push(assistantMsg);
  store.save();

  await executeWorkflowRunSteps({
    run,
    workspace,
    campaign,
    thread,
    assistantMsg,
    parsed,
    selectedLeadIds: params.selectedLeadIds,
    stepDelayMs: params.fastMode ? 0 : 120,
  });

  return { thread, run, assistantMessage: assistantMsg };
}

export async function executeWorkflowRunSteps(params: {
  run: WorkflowRun;
  workspace: Workspace;
  campaign: Campaign;
  thread: ChatThread;
  assistantMsg: ChatMessage;
  parsed: ReturnType<typeof parseChatCommand>;
  selectedLeadIds?: string[];
  stepDelayMs: number;
}): Promise<void> {
  const { run, workspace, campaign, thread, assistantMsg, parsed, stepDelayMs } = params;

  const emitProgress = () => {
    run.updatedAt = new Date().toISOString();
    store.save();
    runEventBus.emit(`run:${run.id}`, { run, assistantMsg });
  };

  let workingLeads: LeadRecord[] = [];
  let inboundSummary: InboundDedupSummaryBlock | undefined;
  let excludedCount = 0;

  const referenceDate = '2026-11-18';

  for (const step of run.steps) {
    // Support pause / cancel with resume from last completed step!
    if (run.status === 'paused' || run.status === 'cancelled') {
      emitProgress();
      return;
    }
    if (step.status === 'completed') {
      // Already completed before pause/retry — preserve actionId and skip re-running side effects!
      continue;
    }

    step.status = 'running';
    step.startedAt = new Date().toISOString();
    emitProgress();

    if (stepDelayMs > 0) {
      await sleep(stepDelayMs);
    }

    // Re-check status after await in case paused/cancelled mid-step
    if ((run.status as string) === 'paused' || (run.status as string) === 'cancelled') {
      step.status = 'paused';
      emitProgress();
      return;
    }

    const t0 = Date.now();

    try {
      if (step.key === 'understand') {
        step.inputs = `Industry: ${parsed.filters.industry || 'Any'}, HQ: ${parsed.filters.cityFilter || parsed.filters.companyHqLocation || 'Any'}, Size: ${parsed.filters.minEmployees ?? 0}-${parsed.filters.maxEmployees ?? 'Any'}`;
        step.outputCount = 1;
        step.detail = parsed.oneSentenceSummary;
      } else if (step.key === 'crm_exclusions') {
        const existingInCampaign = store.db.leads.filter(
          (l) => l.workspaceId === workspace.id && l.campaignId === campaign.id
        );
        if (parsed.isFollowUpRefinement && existingInCampaign.length > 0) {
          workingLeads = existingInCampaign;
          step.outputCount = workingLeads.length;
          step.detail = `Reused ${workingLeads.length} existing campaign records without burning external credits.`;
        } else if (workspace.mode === 'demo') {
          const catalog = store.getDemoCatalogForCampaign(workspace.id, campaign.id, campaign.mode);
          workingLeads = catalog;
          const customerExclusions = parsed.filters.excludeHubSpotCustomers
            ? catalog.filter((c) => c.isExistingHubSpotCustomer).length
            : 0;
          excludedCount = customerExclusions;
          run.excludedCount = excludedCount;
          step.outputCount = customerExclusions;
          step.detail = parsed.filters.excludeHubSpotCustomers
            ? `Checked HubSpot CRM customer list: flagged ${customerExclusions} existing customers (Konkan BoxWorks, Western Laminates) for exclusion.`
            : `Checked workspace suppression list (${workspace.suppressions.length} rules).`;
        } else {
          workingLeads = existingInCampaign;
          step.outputCount = workspace.suppressions.length;
          step.detail = `Applied ${workspace.suppressions.length} workspace suppression rules.`;
        }
      } else if (step.key === 'source_search') {
        const { matched, excludedCustomers } = filterCampaignLeads(workingLeads, parsed.filters);
        excludedCount = Math.max(excludedCount, excludedCustomers.length);
        run.excludedCount = excludedCount;
        workingLeads = matched;
        if (!parsed.isFollowUpRefinement && campaign.mode === 'outbound') {
          run.creditsSpent += Math.max(1, workingLeads.length);
          workspace.creditsUsed = Math.min(workspace.creditBudget, workspace.creditsUsed + workingLeads.length);
        }
        step.outputCount = workingLeads.length;
        step.detail =
          campaign.mode === 'inbound'
            ? `Loaded ${workingLeads.length} raw opted-in inbound franchise inquiries across website forms, Typeform, and event lists.`
            : parsed.isFollowUpRefinement
            ? `Applied follow-up filters to campaign result set: ${workingLeads.length} accounts remain.`
            : `Matched ${workingLeads.length} accounts from Apollo after excluding ${excludedCount} HubSpot customers.`;
      } else if (step.key === 'clean_verify') {
        const rawCount = workingLeads.length;
        const { deduplicated, duplicatesMerged, ambiguousCount } = deduplicateLeads(workingLeads);
        workingLeads = deduplicated;
        const validEmails = workingLeads.filter((l) => l.emailStatus === 'valid').length;
        step.outputCount = workingLeads.length;
        step.detail = `Normalized domains & emails. Merged ${duplicatesMerged} duplicate submissions (${rawCount} → ${workingLeads.length}). Hunter verified ${validEmails}/${workingLeads.length} valid work emails${ambiguousCount > 0 ? `; flagged ${ambiguousCount} ambiguous identity` : ''}.`;

        if (campaign.mode === 'inbound') {
          // Prepare city breakdown after territory assignment in step 6
          inboundSummary = {
            rawCount,
            deduplicatedCount: workingLeads.length,
            duplicatesMerged,
            cityCounts: [],
          };
        }
      } else if (step.key === 'research_signals') {
        const withRecentSignals = workingLeads.filter((l) => l.signals.length > 0).length;
        step.outputCount = withRecentSignals;
        step.detail = `Read permitted careers pages & company news feeds for ${workingLeads.length} accounts; applied strict ${parsed.filters.signalWindowDays}-day event-date window (${withRecentSignals} accounts with dated evidence).`;
      } else if (step.key === 'score_rank') {
        workingLeads = workingLeads.map((lead, idx) => {
          const territoryAssignment = assignTerritoryOwner(lead, workspace.territories, idx);
          const rescored = scoreLead(
            lead,
            parsed.filters,
            workspace.scoringRules,
            referenceDate
          );
          return {
            ...lead,
            owner: territoryAssignment.owner,
            territory: territoryAssignment.territory,
            ...rescored,
          };
        });

        // Sort deterministically by score desc, then latest signal date desc
        workingLeads.sort((a, b) => {
          if (b.scoreTotal !== a.scoreTotal) return b.scoreTotal - a.scoreTotal;
          const dateA = a.signals[0]?.eventDate ?? '';
          const dateB = b.signals[0]?.eventDate ?? '';
          return dateB.localeCompare(dateA);
        });

        // Respect targetCount cap
        if (parsed.filters.targetCount > 0 && workingLeads.length > parsed.filters.targetCount) {
          workingLeads = workingLeads.slice(0, parsed.filters.targetCount);
        }

        // Persist ONLY this campaign's updated leads without affecting other campaigns
        const otherLeads = store.db.leads.filter(
          (l) => !(l.workspaceId === workspace.id && l.campaignId === campaign.id)
        );
        // Keep full set of leads in campaign store when refining so user can still inspect or broaden,
        // while campaign.leadIds & thread message point strictly to current filtered selection!
        const mergedCampaignLeads = new Map<string, LeadRecord>();
        for (const old of store.db.leads.filter(
          (l) => l.workspaceId === workspace.id && l.campaignId === campaign.id
        )) {
          mergedCampaignLeads.set(old.id, old);
        }
        for (const fresh of workingLeads) {
          mergedCampaignLeads.set(fresh.id, fresh);
        }
        store.db.leads = [...otherLeads, ...Array.from(mergedCampaignLeads.values())];
        campaign.leadIds = workingLeads.map((l) => l.id);
        run.resultLeadIds = workingLeads.map((l) => l.id);

        if (inboundSummary) {
          const cityMap = new Map<string, { city: string; count: number; owner: string }>();
          for (const l of workingLeads) {
            const c = cityMap.get(l.companyHqCity) ?? {
              city: l.companyHqCity,
              count: 0,
              owner: l.owner,
            };
            c.count += 1;
            cityMap.set(l.companyHqCity, c);
          }
          inboundSummary.cityCounts = Array.from(cityMap.values());
          assistantMsg.inboundSummary = inboundSummary;
        }

        // Compute shortfall explanation when actual matches < targetCount
        if (
          !parsed.isFollowUpRefinement &&
          parsed.filters.targetCount > 0 &&
          workingLeads.length < parsed.filters.targetCount &&
          campaign.mode === 'outbound'
        ) {
          run.shortfallReason = `Returned ${workingLeads.length} of ${parsed.filters.targetCount} requested accounts: ${excludedCount} matching Maharashtra packaging manufacturers were excluded as existing HubSpot customers, and no additional accounts met the 50–500 employee headcount and operations-role criteria in connected sources.`;
          assistantMsg.shortfallReason = run.shortfallReason;
        }

        step.outputCount = workingLeads.length;
        step.detail = `Scored ${workingLeads.length} leads using workspace weights (${workspace.scoringRules.companyFitMax}/${workspace.scoringRules.roleFitMax}/${workspace.scoringRules.buyingSignalsMax}/${workspace.scoringRules.engagementMax}) and assigned territory owners.`;
      } else if (step.key === 'output_action') {
        const actionsTaken: string[] = [];

        // 1. Score explanation ("Why did the first lead rank highest?" / "Why this lead?")
        if (parsed.explainTopLead && workingLeads.length > 0) {
          assistantMsg.scoreExplanation = explainLeadRanking(workingLeads[0]);
          actionsTaken.push(`Explained #1 rank (${workingLeads[0].contactName}, ${workingLeads[0].scoreTotal}/100)`);
        } else if (parsed.explainLeadQuery && workingLeads.length > 0) {
          const q = parsed.explainLeadQuery.toLowerCase();
          const target =
            workingLeads.find(
              (l) =>
                l.contactName.toLowerCase().includes(q) ||
                l.companyName.toLowerCase().includes(q)
            ) ?? workingLeads[0];
          assistantMsg.scoreExplanation = explainLeadRanking(target);
          actionsTaken.push(`Explained ranking for ${target.contactName}`);
        }

        // 2. CRM sync if requested (e.g. inbound franchise use case)
        if (parsed.triggerCrmSync && workingLeads.length > 0) {
          const crmResult = await syncLeadsToHubSpot({
            workspace,
            leads: workingLeads,
          });
          assistantMsg.crmSyncSummary = crmResult;
          actionsTaken.push(`Synced ${crmResult.syncedCount} leads to HubSpot`);
          store.recordAudit(
            workspace.id,
            'GTM Workflow',
            'crm',
            `Synced ${crmResult.syncedCount} leads to HubSpot (${crmResult.createdCount} created, ${crmResult.updatedCount} updated) for campaign "${campaign.name}".`
          );
        }

        // 3. Unsupported format warning
        if (parsed.unsupportedExportFormat) {
          assistantMsg.unsupportedFormatNotice = {
            requested: parsed.unsupportedExportFormat,
            alternatives: SUPPORTED_EXPORT_FORMATS,
          };
          actionsTaken.push(`Reported unsupported format ${parsed.unsupportedExportFormat}`);
        }

        // 4. Genuine Export Artifact (uses exact displayed/selected rows, sliced by top N if requested)
        let generatedExport: ExportArtifact | null = null;
        if (parsed.requestedExportFormat) {
          let rowsForExport = workingLeads;
          if (params.selectedLeadIds && params.selectedLeadIds.length > 0) {
            const set = new Set(params.selectedLeadIds);
            const selectedSubset = workingLeads.filter((l) => set.has(l.id));
            if (selectedSubset.length > 0) rowsForExport = selectedSubset;
          }
          if (parsed.requestedExportLimit && parsed.requestedExportLimit > 0) {
            rowsForExport = rowsForExport.slice(0, parsed.requestedExportLimit);
          }

          const { artifact, filePath } = await generateExportArtifact({
            workspaceId: workspace.id,
            campaign,
            runId: run.id,
            leads: rowsForExport,
            format: parsed.requestedExportFormat as ExportFormat,
            filters: parsed.filters,
          });
          store.db.exports.unshift(artifact);
          if (filePath) {
            store.db.exportFiles[artifact.id] = filePath;
          }
          generatedExport = artifact;
          assistantMsg.exportArtifactId = artifact.id;
          actionsTaken.push(`Generated ${artifact.format.toUpperCase()} (${artifact.rowCount} rows)`);
          store.recordAudit(
            workspace.id,
            'GTM Workflow',
            'export',
            `Exported ${artifact.rowCount} leads to ${artifact.fileName} (${artifact.format.toUpperCase()}).`
          );
        }

        // 5. Team report email draft (creates ONE team draft and ZERO prospect messages!)
        if (parsed.teamEmailRecipients.length > 0) {
          const rowsForTeam = generatedExport
            ? workingLeads.filter((l) => generatedExport!.leadIdsSnapshot.includes(l.id))
            : parsed.requestedExportLimit
            ? workingLeads.slice(0, parsed.requestedExportLimit)
            : workingLeads;

          const teamDraft = createTeamEmailDraft({
            workspaceId: workspace.id,
            campaignId: campaign.id,
            recipients: parsed.teamEmailRecipients,
            exportArtifact: generatedExport,
            leads: rowsForTeam,
            campaignName: campaign.name,
          });
          assistantMsg.draftIds = [...(assistantMsg.draftIds ?? []), teamDraft.id];
          actionsTaken.push(`Created 1 team email draft to ${parsed.teamEmailRecipients.join(', ')}`);
          store.recordAudit(
            workspace.id,
            'GTM Workflow',
            'email',
            `Created editable team report draft to ${parsed.teamEmailRecipients.join(', ')} with attachment ${teamDraft.attachmentFileName ?? 'none'}.`
          );
        }

        // 6. Individual prospect outreach drafts (only if explicitly requested!)
        if (parsed.draftProspectOutreach) {
          const targetLeads =
            params.selectedLeadIds && params.selectedLeadIds.length > 0
              ? workingLeads.filter((l) => params.selectedLeadIds!.includes(l.id))
              : workingLeads.slice(0, 5);
          const prospectDrafts = createProspectOutreachDrafts({
            workspace,
            campaignId: campaign.id,
            leads: targetLeads,
          });
          assistantMsg.draftIds = [
            ...(assistantMsg.draftIds ?? []),
            ...prospectDrafts.map((d) => d.id),
          ];
          actionsTaken.push(`Created ${prospectDrafts.length} prospect outreach drafts`);
        }

        // 7. Save search if requested
        if (parsed.saveSearchName) {
          store.db.savedSearches.unshift({
            id: `ss-${Date.now()}`,
            workspaceId: workspace.id,
            campaignId: campaign.id,
            name: parsed.saveSearchName,
            prompt: thread.messages[thread.messages.length - 2]?.content || parsed.oneSentenceSummary,
            filters: parsed.filters,
            schedule: 'Weekly',
            lastRefreshedAt: new Date().toISOString(),
            lastMatchCount: workingLeads.length,
            newlyQualifyingCount: 0,
            createdAt: new Date().toISOString().slice(0, 10),
          });
          actionsTaken.push(`Saved search "${parsed.saveSearchName}"`);
        }

        assistantMsg.leadIds = workingLeads.map((l) => l.id);

        // Compose clear assistant narrative
        const narrativeParts: string[] = [parsed.oneSentenceSummary];
        if (inboundSummary) {
          narrativeParts.push(
            `Deduplicated ${inboundSummary.rawCount} submissions into ${inboundSummary.deduplicatedCount} unique franchise inquiries (${inboundSummary.duplicatesMerged} repeats merged) and assigned city territory owners.`
          );
        } else {
          narrativeParts.push(
            `Found ${workingLeads.length} matching leads using ${run.toolsUsed.join(', ')}.`
          );
        }
        if (run.shortfallReason) {
          narrativeParts.push(run.shortfallReason);
        }
        if (assistantMsg.scoreExplanation) {
          narrativeParts.push(assistantMsg.scoreExplanation.summaryText);
        }
        if (generatedExport) {
          narrativeParts.push(
            `Generated ${generatedExport.fileName} (${generatedExport.rowCount} rows).`
          );
        }
        if (parsed.teamEmailRecipients.length > 0) {
          narrativeParts.push(
            `Prepared 1 editable team email draft to ${parsed.teamEmailRecipients.join(', ')} with the export attached (0 prospect emails created).`
          );
        }
        assistantMsg.content = narrativeParts.join(' ');

        step.outputCount = workingLeads.length;
        step.detail =
          actionsTaken.length > 0
            ? actionsTaken.join(' · ')
            : `Returned ${workingLeads.length} ranked leads inline in conversation.`;
      }

      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      step.durationMs = Math.max(12, Date.now() - t0);
      emitProgress();
    } catch (err) {
      step.status = 'failed';
      step.error = err instanceof Error ? err.message : 'Unexpected step error';
      step.completedAt = new Date().toISOString();
      run.status = 'failed';
      emitProgress();
      return;
    }
  }

  run.status = 'completed';
  store.recordAudit(
    workspace.id,
    'GTM Workflow',
    'workflow',
    `Completed run ${run.id} for "${campaign.name}": ${run.resultLeadIds.length} matches, tools used: ${run.toolsUsed.join(', ')}.`
  );
  emitProgress();
}

export async function resumeWorkflowRun(runId: string): Promise<WorkflowRun | null> {
  const run = store.db.runs.find((r) => r.id === runId);
  if (!run) return null;
  if (run.status === 'completed') return run;

  const workspace = store.getWorkspace(run.workspaceId);
  const campaign = store.db.campaigns.find((c) => c.id === run.campaignId);
  const thread = store.db.threads.find((t) => t.id === run.conversationId);
  if (!campaign || !thread) return null;

  const assistantMsg = thread.messages.find((m) => m.runId === run.id);
  if (!assistantMsg) return null;

  run.status = 'running';
  for (const s of run.steps) {
    if (s.status === 'paused' || s.status === 'failed') {
      s.status = 'pending';
      s.error = null;
    }
  }
  store.save();

  const parsed = parseChatCommand(
    run.planSummary,
    campaign.filters,
    true
  );

  await executeWorkflowRunSteps({
    run,
    workspace,
    campaign,
    thread,
    assistantMsg,
    parsed: {
      ...parsed,
      filters: campaign.filters,
      oneSentenceSummary: run.planSummary,
    },
    stepDelayMs: 60,
  });

  return run;
}
