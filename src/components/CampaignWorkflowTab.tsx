import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowDown,
  Search,
  FolderOpen,
  FileSpreadsheet,
  CornerUpLeft,
  FileText,
  Send,
  Users,
  Database,
  Cloud,
  GitFork,
  Pause,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  BarChart3,
  Cpu,
} from 'lucide-react';
import type {
  Campaign,
  ChatThread,
  LeadRecord,
  WorkflowRun,
  WorkflowStep,
  Workspace,
} from '../types/gtm';
import { GtmBrandMark } from './BrandMarks';

interface CampaignWorkflowTabProps {
  workspace: Workspace;
  thread: ChatThread;
  campaign: Campaign;
  leads: LeadRecord[];
  runs: WorkflowRun[];
  connectedToolNames: string[];
  onControlRun: (runId: string, action: 'pause' | 'cancel' | 'resume') => Promise<void>;
  onReturnToChat: () => void;
  onOpenOutcomes: () => void;
}

type FlowNodeId =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09_share'
  | '09_outreach'
  | '09_handoff'
  | '10';

interface NodeInspectorDetail {
  number: string;
  title: string;
  tool: string;
  status: string;
  actionId: string;
  inputs: string;
  outputCount: number;
  durationMs: number | null;
  completedAt: string | null;
  detail: string;
  error: string | null;
}

function StepNumberBadge({
  num,
  variant = 'light',
}: {
  num: string;
  variant?: 'dark' | 'light' | 'mint';
}) {
  const styles =
    variant === 'dark'
      ? 'bg-[#CBEAD9] text-[#0F3A2F]'
      : variant === 'mint'
      ? 'bg-[#D6EFE1] text-[#0F3A2F]'
      : 'bg-[#E3F5EB] text-[#0B6B4E]';

  return (
    <span
      className={`inline-flex h-6 min-w-[28px] shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold tabular-nums ${styles}`}
    >
      {num}
    </span>
  );
}

export function CampaignWorkflowTab({
  workspace,
  thread,
  campaign,
  leads,
  runs,
  connectedToolNames,
  onControlRun,
  onReturnToChat,
  onOpenOutcomes,
}: CampaignWorkflowTabProps) {
  const campaignRuns = useMemo(
    () => runs.filter((r) => r.campaignId === campaign.id),
    [runs, campaign.id]
  );
  const [selectedRunId, setSelectedRunId] = useState<string>(campaignRuns[0]?.id ?? '');
  const activeRun =
    campaignRuns.find((r) => r.id === selectedRunId) ?? campaignRuns[0] ?? null;

  const [selectedNode, setSelectedNode] = useState<FlowNodeId | null>(null);

  const stepMap = useMemo(() => {
    const map: Record<string, WorkflowStep> = {};
    if (activeRun) {
      for (const st of activeRun.steps) {
        map[st.key] = st;
      }
    }
    return map;
  }, [activeRun]);

  const campaignLeads = useMemo(
    () => leads.filter((l) => l.campaignId === campaign.id),
    [leads, campaign.id]
  );

  const qualifiedCount = campaignLeads.filter(
    (l) => l.qualificationLabel === 'Qualified'
  ).length;
  const repliedCount = campaignLeads.filter((l) =>
    l.engagementEvents.some((e) => e.type === 'replied')
  ).length;
  const meetingsCount = campaignLeads.filter((l) =>
    l.engagementEvents.some((e) => e.type === 'meeting_booked')
  ).length;
  const syncedCrmCount = campaignLeads.filter((l) => Boolean(l.crmRecordId)).length;

  const latestUserPrompt =
    [...thread.messages].reverse().find((m) => m.role === 'user')?.content ||
    'Find operations heads at Pune packaging firms. Export the top 10 to Excel and draft a team email.';

  const weights = {
    companyFit: workspace.scoringRules.companyFitMax,
    roleFit: workspace.scoringRules.roleFitMax,
    buyingSignals: workspace.scoringRules.buyingSignalsMax,
    engagement: workspace.scoringRules.engagementMax,
  };
  const totalWeight =
    weights.companyFit + weights.roleFit + weights.buyingSignals + weights.engagement || 100;

  const inspectorDetail: NodeInspectorDetail | null = useMemo(() => {
    if (!selectedNode) return null;
    const fromStep = (num: string, fallbackTitle: string, key: string): NodeInspectorDetail => {
      const st = stepMap[key];
      if (st) {
        return {
          number: num,
          title: st.title,
          tool: st.tool,
          status: st.status,
          actionId: st.actionId,
          inputs: st.inputs,
          outputCount: st.outputCount,
          durationMs: st.durationMs,
          completedAt: st.completedAt,
          detail: st.detail,
          error: st.error,
        };
      }
      return {
        number: num,
        title: fallbackTitle,
        tool: 'Awaiting first run',
        status: 'pending',
        actionId: 'pending-run',
        inputs: 'Submit a chat prompt to populate live step inputs.',
        outputCount: 0,
        durationMs: null,
        completedAt: null,
        detail: 'No workflow run recorded for this campaign yet.',
        error: null,
      };
    };

    switch (selectedNode) {
      case '01':
        return {
          number: '01',
          title: 'Ask in chat',
          tool: 'Conversation Control Panel',
          status: activeRun ? 'completed' : 'ready',
          actionId: activeRun ? `${activeRun.id}:act:chat_prompt` : 'ready:chat_prompt',
          inputs: latestUserPrompt,
          outputCount: 1,
          durationMs: 2,
          completedAt: activeRun?.createdAt ?? null,
          detail: `Captured plain-language request in "${thread.title}" scoped to "${campaign.name}".`,
          error: null,
        };
      case '02':
        return fromStep('02', 'Turn the request into filters', 'extract_filters');
      case '03':
        return {
          number: '03',
          title: 'Start the background run',
          tool: activeRun
            ? `Durable Runner (${activeRun.toolsUsed.join(', ')})`
            : `Authorized Stack (${connectedToolNames.join(', ') || 'CSV/Excel Local Mode'})`,
          status: activeRun?.status ?? 'ready',
          actionId: activeRun ? `${activeRun.id}:act:dispatch` : 'ready:dispatch',
          inputs: `Workspace credits ${workspace.creditsUsed}/${workspace.creditBudget} · ${connectedToolNames.length} authorized sources`,
          outputCount: activeRun ? activeRun.steps.length : 7,
          durationMs: 6,
          completedAt: activeRun?.createdAt ?? null,
          detail: activeRun
            ? `Verified permissions and workspace credit cap (${activeRun.creditsSpent} credits spent on this run). Supports pause, cancel, and checkpoint resume.`
            : 'Checks workspace permissions, credit budget, and connected tool scopes before launching the background workflow.',
          error: null,
        };
      case '04':
        return fromStep('04', 'Find matching companies and buyers', 'source_search');
      case '05':
        return fromStep('05', 'Clean and verify', 'clean_verify');
      case '06':
        return fromStep('06', 'Research signals', 'research_signals');
      case '07':
        return fromStep('07', 'Score and qualify', 'score_rank');
      case '08':
        return {
          number: '08',
          title: 'Review the ranked leads in chat',
          tool: 'Interactive Inline Table & Lead Inspector',
          status: campaignLeads.length > 0 ? 'completed' : 'pending',
          actionId: activeRun ? `${activeRun.id}:act:review_ranked` : 'pending:review',
          inputs: `${campaignLeads.length} ranked leads in campaign "${campaign.name}"`,
          outputCount: campaignLeads.length,
          durationMs: 4,
          completedAt: activeRun?.updatedAt ?? null,
          detail:
            'Inspect explainable factor scores and dated evidence sources inline. Refine filters in follow-up chat messages without losing prior context or other campaigns.',
          error: null,
        };
      case '09_share':
        return fromStep('09A', 'Share the shortlist (Export & Team Email)', 'output_action');
      case '09_outreach':
        return {
          number: '09B',
          title: 'Prospect outreach & sequence guardrails',
          tool: 'Evidence-Grounded Drafter & Sequence Engine',
          status: activeRun ? 'ready' : 'pending',
          actionId: activeRun ? `${activeRun.id}:act:outreach_branch` : 'ready:outreach',
          inputs: `${qualifiedCount} qualified leads with company research & verification verdicts`,
          outputCount: qualifiedCount,
          durationMs: null,
          completedAt: null,
          detail:
            'Generates personalized drafts grounded in each lead’s dated company brief and enforces automatic reply, opt-out, and permanent bounce stops.',
          error: null,
        };
      case '09_handoff':
        return {
          number: '09C',
          title: 'Sales handoff & CRM sync',
          tool: 'HubSpot / Salesforce / Dynamics Upsert + Territory Router',
          status: syncedCrmCount > 0 ? 'completed' : 'ready',
          actionId: activeRun ? `${activeRun.id}:act:crm_handoff` : 'ready:handoff',
          inputs: `${campaignLeads.length} campaign leads · ${workspace.territories.length} territory rules`,
          outputCount: syncedCrmCount,
          durationMs: null,
          completedAt: activeRun?.updatedAt ?? null,
          detail:
            'Creates or updates CRM contacts/companies preserving city/territory ownership, opens handoff tasks, and tracks deal stage progression.',
          error: null,
        };
      case '10':
        return {
          number: '10',
          title: 'Measure campaign outcomes',
          tool: 'Conversion Funnel & Scheduled Saved Searches',
          status: campaignLeads.length > 0 ? 'active' : 'pending',
          actionId: `${campaign.id}:act:outcomes`,
          inputs: `Qualified: ${qualifiedCount} · Replies: ${repliedCount} · Meetings: ${meetingsCount}`,
          outputCount: qualifiedCount,
          durationMs: null,
          completedAt: activeRun?.updatedAt ?? null,
          detail:
            'Tracks conversion funnel rates with explicit denominators across qualified leads, replies, meetings, and opportunities, and feeds learnings back into saved searches or Power BI / Microsoft Fabric exports.',
          error: null,
        };
    }
  }, [
    selectedNode,
    stepMap,
    activeRun,
    latestUserPrompt,
    thread.title,
    campaign.name,
    campaign.id,
    connectedToolNames,
    workspace.creditsUsed,
    workspace.creditBudget,
    workspace.territories.length,
    campaignLeads.length,
    qualifiedCount,
    repliedCount,
    meetingsCount,
    syncedCrmCount,
  ]);

  const nodeRing = (id: FlowNodeId) =>
    selectedNode === id
      ? 'ring-2 ring-[#0B6B4E] ring-offset-2 ring-offset-[#F7FAF8]'
      : '';

  const stepOutputTag = (key: string) => {
    const st = stepMap[key];
    if (!st) return null;
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-[#0B6B4E] tabular-nums">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        <span>
          {st.outputCount === 1 ? '1 output' : `${st.outputCount} outputs`}
        </span>
      </span>
    );
  };

  return (
    <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden bg-white">
      {/* Main Workflow Column */}
      <div className="flex flex-1 min-w-0 flex-col min-h-0 overflow-hidden">
        {/* Consistent Header & Underlined Chat / Workflow Tab Bar */}
        <div className="shrink-0 border-b border-slate-200/90 bg-white px-5 sm:px-8 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-950 truncate">
              {thread.title || campaign.name}
            </h1>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {campaignRuns.length > 0 && (
                <select
                  aria-label="Select workflow run"
                  value={activeRun?.id ?? ''}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-[#FAFAFA] px-3 py-1.5 text-xs font-mono text-slate-800"
                >
                  {campaignRuns.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id.slice(-10)} ({r.status} · {r.resultLeadIds.length} leads)
                    </option>
                  ))}
                </select>
              )}
              {activeRun?.status === 'running' && (
                <button
                  type="button"
                  onClick={() => onControlRun(activeRun.id, 'pause')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause</span>
                </button>
              )}
              {(activeRun?.status === 'paused' || activeRun?.status === 'failed') && (
                <button
                  type="button"
                  onClick={() => onControlRun(activeRun.id, 'resume')}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#0B6B4E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#085840]"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Resume</span>
                </button>
              )}
            </div>
          </div>

          <div
            className="mt-3 flex items-center gap-6"
            role="tablist"
            aria-label="Campaign views"
          >
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={onReturnToChat}
              className="border-b-2 border-transparent pb-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 whitespace-nowrap"
            >
              Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={true}
              className="border-b-2 border-[#0B6B4E] pb-2.5 text-sm font-semibold text-slate-950 whitespace-nowrap"
            >
              Workflow
            </button>
          </div>
        </div>

        {/* Scrollable Architectural Flow Canvas (#F7FAF8 matching reference diagram) */}
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[#F7FAF8] px-4 sm:px-8 py-7">
          <div className="mx-auto w-full max-w-4xl min-w-0">
            {/* Diagram Header */}
            <div className="mb-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0B6B4E]">
                <GtmBrandMark className="h-4 w-4 shrink-0" />
                <span>AI GTM Engineer</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl sm:text-[30px] font-bold tracking-tight text-[#0D2E25]">
                  From chat to sales handoff
                </h2>
                <span className="text-xs text-slate-500">
                  Click any step to inspect tool, inputs, output count &amp; timestamp
                </span>
              </div>
            </div>

            {/* Wrapper supporting the subtle dashed refinement feedback rail on desktop */}
            <div className="relative">
              {/* Steps 01 & 02 — Dark Pine Hero Banner */}
              <div className="grid grid-cols-1 md:grid-cols-2 rounded-2xl bg-[#113D31] text-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSelectedNode('01')}
                  className={`relative p-5 text-left transition-colors hover:bg-[#154A3C] ${
                    selectedNode === '01' ? 'bg-[#164E3F]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <StepNumberBadge num="01" variant="dark" />
                    <span className="font-display text-base font-bold text-white">
                      Ask in chat
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-[#D7ECE2] line-clamp-3">
                    &ldquo;{latestUserPrompt}&rdquo;
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedNode('02')}
                  className={`relative border-t md:border-t-0 md:border-l border-white/15 p-5 md:pl-7 text-left transition-colors hover:bg-[#154A3C] ${
                    selectedNode === '02' ? 'bg-[#164E3F]' : ''
                  }`}
                >
                  {/* Center Connector Circle Arrow on Desktop */}
                  <span
                    aria-hidden="true"
                    className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-[#113D31] text-[#CBEAD9]"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <StepNumberBadge num="02" variant="dark" />
                      <span className="font-display text-base font-bold text-white">
                        Turn the request into filters
                      </span>
                    </div>
                    {stepMap.extract_filters && (
                      <span className="font-mono text-[11px] text-[#B7E3CC] tabular-nums">
                        {stepMap.extract_filters.outputCount === 1
                          ? '1 filter set'
                          : `${stepMap.extract_filters.outputCount} outputs`}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-[#D7ECE2]">
                    {activeRun
                      ? activeRun.planSummary
                      : 'The AI model identifies the target industry, buyer role, HQ location, headcount band, signals, and CRM exclusions.'}
                  </p>
                </button>
              </div>

              {/* Connector 02 -> 03 */}
              <div className="flex justify-center md:justify-end md:pr-[24%] py-1.5 text-[#3F7A65]">
                <ArrowDown className="h-4 w-4" />
              </div>

              {/* Step 03 — Soft Sage Background Run Banner */}
              <button
                type="button"
                onClick={() => setSelectedNode('03')}
                className={`w-full rounded-xl border border-[#C6DFD1] bg-[#EAF5EF] px-5 py-4 text-left transition-all hover:border-[#0B6B4E] ${nodeRing(
                  '03'
                )}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <StepNumberBadge num="03" variant="mint" />
                    <span className="font-display text-base font-bold text-[#0D2E25]">
                      Start the background run
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#0B6B4E] tabular-nums">
                    <span>
                      Credits {workspace.creditsUsed}/{workspace.creditBudget}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {activeRun
                        ? `${activeRun.toolsUsed.length} tools active`
                        : `${connectedToolNames.length} tools connected`}
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 sm:pl-10 text-xs sm:text-[13px] text-[#285042]">
                  The backend checks workspace permissions and credits, then starts the durable workflow with connected tools
                  {activeRun ? ` (${activeRun.toolsUsed.join(', ')})` : ''}.
                </p>
              </button>

              {/* Connector 03 -> 04 */}
              <div className="flex justify-center py-1.5 text-[#3F7A65]">
                <ArrowDown className="h-4 w-4" />
              </div>

              {/* Steps 04 -> 08 Container with Subtle Dashed Refinement Loop Indicator */}
              <div className="relative">
                {/* Step 04 — Find matching companies and buyers (3-column white card) */}
                <button
                  type="button"
                  onClick={() => setSelectedNode('04')}
                  className={`w-full rounded-2xl border border-[#D4E2DA] bg-white p-5 text-left transition-all hover:border-[#0B6B4E] ${nodeRing(
                    '04'
                  )}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <StepNumberBadge num="04" />
                      <span className="font-display text-base font-bold text-[#0D2E25]">
                        Find matching companies and buyers
                      </span>
                    </div>
                    {stepOutputTag('source_search')}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 md:divide-x md:divide-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <Search className="h-3.5 w-3.5 text-[#0B6B4E]" />
                        <span>Prospecting data</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        Search Apollo or licensed directories for matching companies and decision-makers.
                      </p>
                    </div>

                    <div className="space-y-1 md:pl-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <FolderOpen className="h-3.5 w-3.5 text-[#0B6B4E]" />
                        <span>CRM and files</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        Check HubSpot, Salesforce, or uploaded CSV and Excel lists for leads and customer exclusions.
                      </p>
                    </div>

                    <div className="space-y-1 md:pl-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-[#0B6B4E]" />
                        <span>Social and inbound</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        Use authorized LinkedIn and Meta lead forms, website forms, or opted-in event sign-ups.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Connector 04 -> 05 */}
                <div className="flex justify-center md:justify-start md:pl-[16%] py-1.5 text-[#3F7A65]">
                  <ArrowDown className="h-4 w-4" />
                </div>

                {/* Steps 05 -> 06 -> 07 Horizontal Trio */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch">
                  {/* 05 Clean and verify */}
                  <button
                    type="button"
                    onClick={() => setSelectedNode('05')}
                    className={`flex flex-col justify-between rounded-2xl border border-[#D4E2DA] bg-white p-4 text-left transition-all hover:border-[#0B6B4E] ${nodeRing(
                      '05'
                    )}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StepNumberBadge num="05" />
                          <span className="font-display text-sm font-bold text-[#0D2E25]">
                            Clean and verify
                          </span>
                        </div>
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                        Merge duplicates, exclude existing customers, enrich work emails, and verify with Hunter.
                      </p>
                    </div>
                    {stepMap.clean_verify && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        {stepOutputTag('clean_verify')}
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                          {stepMap.clean_verify.durationMs ?? 0}ms
                        </span>
                      </div>
                    )}
                  </button>

                  <div className="hidden md:flex items-center justify-center text-[#3F7A65]">
                    <ArrowRight className="h-4 w-4" />
                  </div>

                  {/* 06 Research signals */}
                  <button
                    type="button"
                    onClick={() => setSelectedNode('06')}
                    className={`flex flex-col justify-between rounded-2xl border border-[#D4E2DA] bg-white p-4 text-left transition-all hover:border-[#0B6B4E] ${nodeRing(
                      '06'
                    )}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <StepNumberBadge num="06" />
                        <span className="font-display text-sm font-bold text-[#0D2E25]">
                          Research signals
                        </span>
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                        Build an AI company brief from hiring, funding, or expansion news. Cite each source and event date.
                      </p>
                    </div>
                    {stepMap.research_signals && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        {stepOutputTag('research_signals')}
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                          {stepMap.research_signals.durationMs ?? 0}ms
                        </span>
                      </div>
                    )}
                  </button>

                  <div className="hidden md:flex items-center justify-center text-[#3F7A65]">
                    <ArrowRight className="h-4 w-4" />
                  </div>

                  {/* 07 Score and qualify (with 4-segment green weight bar matching diagram) */}
                  <button
                    type="button"
                    onClick={() => setSelectedNode('07')}
                    className={`flex flex-col justify-between rounded-2xl border border-[#D4E2DA] bg-white p-4 text-left transition-all hover:border-[#0B6B4E] ${nodeRing(
                      '07'
                    )}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <StepNumberBadge num="07" />
                        <span className="font-display text-sm font-bold text-[#0D2E25]">
                          Score and qualify
                        </span>
                      </div>
                      <div className="mt-2.5 text-xs font-medium text-slate-700">
                        Scoring weights, out of {totalWeight}
                      </div>

                      {/* 4-segment emerald bar matching mockup */}
                      <div
                        className="mt-2 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
                        aria-label={`Scoring weights: Company fit ${weights.companyFit}, Role fit ${weights.roleFit}, Signals ${weights.buyingSignals}, Engagement ${weights.engagement}`}
                      >
                        <div
                          className="h-full bg-[#0B6B4E]"
                          style={{ width: `${(weights.companyFit / totalWeight) * 100}%` }}
                        />
                        <div
                          className="h-full bg-[#248A67]"
                          style={{ width: `${(weights.roleFit / totalWeight) * 100}%` }}
                        />
                        <div
                          className="h-full bg-[#62B394]"
                          style={{ width: `${(weights.buyingSignals / totalWeight) * 100}%` }}
                        />
                        <div
                          className="h-full bg-[#A8D8C4]"
                          style={{ width: `${(weights.engagement / totalWeight) * 100}%` }}
                        />
                      </div>

                      <div className="mt-2 text-[11px] leading-snug text-slate-600 font-mono tabular-nums">
                        Company fit {weights.companyFit} · Role fit {weights.roleFit}
                        <br />
                        Signals {weights.buyingSignals} · Engagement {weights.engagement}
                      </div>
                    </div>

                    {stepMap.score_rank && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        {stepOutputTag('score_rank')}
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                          {stepMap.score_rank.durationMs ?? 0}ms
                        </span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Connector 07 -> 08 */}
                <div className="flex justify-center py-1.5 text-[#3F7A65]">
                  <ArrowDown className="h-4 w-4" />
                </div>

                {/* Step 08 — Review the ranked leads in chat + Refine loop box */}
                <div
                  className={`rounded-2xl border border-[#C6DFD1] bg-[#EAF5EF] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${nodeRing(
                    '08'
                  )}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedNode('08')}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <StepNumberBadge num="08" variant="mint" />
                      <span className="font-display text-base font-bold text-[#0D2E25]">
                        Review the ranked leads in chat
                      </span>
                    </div>
                    <p className="mt-1.5 sm:pl-10 text-xs sm:text-[13px] text-[#285042]">
                      Inspect scores and dated sources ({campaignLeads.length} ranked leads). Select rows or save the search.
                    </p>
                  </button>

                  <div className="shrink-0 rounded-xl border border-[#C6DFD1] bg-white px-4 py-3 space-y-1.5 md:min-w-[250px]">
                    <div className="text-xs font-semibold text-slate-900">
                      &ldquo;Only keep verified emails.&rdquo;
                    </div>
                    <button
                      type="button"
                      onClick={onReturnToChat}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B6B4E] hover:underline"
                    >
                      <CornerUpLeft className="h-3.5 w-3.5" />
                      <span>Refine the filters and rerun</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Connector 08 -> 09 */}
              <div className="flex justify-center py-2 text-[#3F7A65]">
                <ArrowDown className="h-4 w-4" />
              </div>

              {/* Step 09 — Choose one or more next actions (Centered Title + 3 Branch Cards) */}
              <div className="flex items-center justify-center gap-2.5 pb-2">
                <StepNumberBadge num="09" />
                <h3 className="font-display text-base sm:text-lg font-bold text-[#0D2E25]">
                  Choose one or more next actions
                </h3>
              </div>

              {/* Orthogonal Branching Connectors on Desktop */}
              <div className="hidden md:block mx-auto w-[68%] pb-1.5" aria-hidden="true">
                <div className="mx-auto h-3 w-px bg-[#6EA38F]" />
                <div className="h-px w-full bg-[#6EA38F]" />
                <div className="flex justify-between">
                  <div className="h-3 w-px bg-[#6EA38F]" />
                  <div className="h-3 w-px bg-[#6EA38F]" />
                  <div className="h-3 w-px bg-[#6EA38F]" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
                {/* 09A: Share the shortlist */}
                <button
                  type="button"
                  onClick={() => setSelectedNode('09_share')}
                  className={`rounded-2xl border border-[#D4E2DA] bg-white p-4 text-left transition-all hover:border-[#0B6B4E] space-y-3 ${nodeRing(
                    '09_share'
                  )}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E3F5EB] text-[#0B6B4E]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="font-display text-sm font-bold text-[#0D2E25]">
                      Share the shortlist
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#0B6B4E]">Export selected rows</div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Excel, CSV, JSON, Parquet, PDF, or Google Sheets snapshots.
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 space-y-1">
                    <div className="text-xs font-bold text-[#0B6B4E]">Email the team</div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Attach the export in Gmail or Outlook. Review and send.
                    </p>
                  </div>
                </button>

                {/* 09B: Prospect outreach */}
                <button
                  type="button"
                  onClick={() => setSelectedNode('09_outreach')}
                  className={`rounded-2xl border border-[#D4E2DA] bg-white p-4 text-left transition-all hover:border-[#0B6B4E] space-y-3 ${nodeRing(
                    '09_outreach'
                  )}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E3F5EB] text-[#0B6B4E]">
                      <Send className="h-4 w-4" />
                    </span>
                    <span className="font-display text-sm font-bold text-[#0D2E25]">
                      Prospect outreach
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#0B6B4E]">
                      Draft individual messages
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Personalize templates with each lead&apos;s dated company research.
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 space-y-1">
                    <div className="text-xs font-bold text-[#0B6B4E]">
                      Approve the sequence
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Stop follow-ups automatically on reply, opt-out, or permanent bounce.
                    </p>
                  </div>
                </button>

                {/* 09C: Sales handoff */}
                <button
                  type="button"
                  onClick={() => setSelectedNode('09_handoff')}
                  className={`rounded-2xl border border-[#D4E2DA] bg-white p-4 text-left transition-all hover:border-[#0B6B4E] space-y-3 ${nodeRing(
                    '09_handoff'
                  )}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E3F5EB] text-[#0B6B4E]">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="font-display text-sm font-bold text-[#0D2E25]">
                      Sales handoff
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#0B6B4E]">Sync the CRM</div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Create or update contacts in HubSpot, Dynamics, or Salesforce
                      {syncedCrmCount > 0 ? ` (${syncedCrmCount} synced)` : ''}.
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 space-y-1">
                    <div className="text-xs font-bold text-[#0B6B4E]">Assign an owner</div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Route the lead by territory, create a task, and track its deal stage.
                    </p>
                  </div>
                </button>
              </div>

              {/* Converging Connectors -> Step 10 */}
              <div className="hidden md:block mx-auto w-[68%] pt-1.5" aria-hidden="true">
                <div className="flex justify-between">
                  <div className="h-3 w-px bg-[#6EA38F]" />
                  <div className="h-3 w-px bg-[#6EA38F]" />
                  <div className="h-3 w-px bg-[#6EA38F]" />
                </div>
                <div className="h-px w-full bg-[#6EA38F]" />
                <div className="mx-auto h-3 w-px bg-[#6EA38F]" />
              </div>
              <div className="flex md:hidden justify-center py-1.5 text-[#3F7A65]">
                <ArrowDown className="h-4 w-4" />
              </div>

              {/* Step 10 — Dark Pine Outcome Measurement Banner */}
              <div
                className={`rounded-2xl bg-[#113D31] p-5 text-white transition-all ${nodeRing(
                  '10'
                )}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedNode('10')}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <StepNumberBadge num="10" variant="dark" />
                      <span className="font-display text-base font-bold text-white">
                        Measure campaign outcomes
                      </span>
                    </div>
                    <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-[#D7ECE2]">
                      Track qualified leads ({qualifiedCount}), replies ({repliedCount}), meetings ({meetingsCount}), and opportunities. Use results to refine the next search.
                    </p>
                    <p className="mt-1 text-[11px] text-[#9BC6B5]">
                      Schedule saved searches. Report campaign results in Microsoft Fabric and Power BI if connected.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenOutcomes}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 whitespace-nowrap shrink-0"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Open Funnel</span>
                  </button>
                </div>
              </div>

              {/* Footer — Behind each run (Matching reference diagram) */}
              <section
                aria-label="Backend infrastructure behind each run"
                className="mt-7 pt-5 border-t border-[#D9E5DE]"
              >
                <h3 className="font-display text-sm font-bold text-[#0D2E25]">
                  Behind each run
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <Cpu className="h-3.5 w-3.5 text-[#0B6B4E] shrink-0" />
                      <span>FastAPI, Celery, Redis</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Run background jobs, stream progress, and handle checkpoint retries.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <Database className="h-3.5 w-3.5 text-[#0B6B4E] shrink-0" />
                      <span>PostgreSQL</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Store leads, dated evidence, run audit trails, and synced CRM IDs.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <Cloud className="h-3.5 w-3.5 text-[#0B6B4E] shrink-0" />
                      <span>Azure Blob or S3</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Keep uploaded spreadsheets and immutable export snapshots.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <GitFork className="h-3.5 w-3.5 text-[#0B6B4E] shrink-0" />
                      <span>n8n, Make or Zapier</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Connect custom webhooks and downstream GTM automation workflows.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Right Step Inspector Drawer (opens when any step 01–10 is clicked) */}
      {inspectorDetail && (
        <aside
          aria-label={`Workflow step ${inspectorDetail.number} details`}
          className="fixed inset-0 z-40 lg:static lg:z-auto flex h-full w-full lg:w-[340px] xl:w-[375px] shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StepNumberBadge num={inspectorDetail.number} />
                <span className="font-mono text-[11px] text-slate-500 truncate">
                  {inspectorDetail.status}
                </span>
              </div>
              <h3 className="mt-1.5 font-display text-base font-bold text-slate-950">
                {inspectorDetail.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              aria-label="Close step inspector"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <div className="space-y-1 border-b border-slate-100 pb-3">
              <div className="text-[11px] font-medium text-slate-500">Tool Executed</div>
              <div className="font-semibold text-[#0B6B4E]">{inspectorDetail.tool}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Output Count</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-slate-950 tabular-nums">
                  {inspectorDetail.outputCount}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500">Duration</div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-slate-800 tabular-nums">
                  {inspectorDetail.durationMs !== null
                    ? `${inspectorDetail.durationMs}ms`
                    : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-1 border-b border-slate-100 pb-3">
              <div className="text-[11px] font-medium text-slate-500">Inputs</div>
              <div className="text-slate-800 leading-relaxed break-words">
                {inspectorDetail.inputs}
              </div>
            </div>

            <div className="space-y-1 border-b border-slate-100 pb-3">
              <div className="text-[11px] font-medium text-slate-500">
                Completed Timestamp
              </div>
              <div className="font-mono text-slate-700 tabular-nums">
                {inspectorDetail.completedAt
                  ? `${inspectorDetail.completedAt.replace('T', ' ').slice(0, 19)} UTC`
                  : 'Pending execution'}
              </div>
            </div>

            <div className="space-y-1 border-b border-slate-100 pb-3">
              <div className="text-[11px] font-medium text-slate-500">
                Stable Action ID
              </div>
              <div className="font-mono text-[11px] text-slate-600 break-all">
                {inspectorDetail.actionId}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-[#F6F7F6] p-3.5 text-slate-700 leading-relaxed">
              <div className="mb-1 text-[11px] font-semibold text-slate-900 flex items-center gap-1.5">
                {inspectorDetail.status === 'completed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#0B6B4E]" />
                ) : inspectorDetail.status === 'failed' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-700" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-amber-700" />
                )}
                <span>Execution Detail</span>
              </div>
              {inspectorDetail.detail}
            </div>

            {inspectorDetail.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-red-800">
                <span className="font-semibold">Error:</span> {inspectorDetail.error}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={onReturnToChat}
                className="w-full rounded-lg bg-[#0B6B4E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#085840]"
              >
                Open in Chat
              </button>
              {selectedNode === '10' && (
                <button
                  type="button"
                  onClick={onOpenOutcomes}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  Open Campaign Funnel &amp; Tasks
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
