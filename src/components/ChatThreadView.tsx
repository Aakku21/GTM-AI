import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Paperclip,
  Pause,
  Play,
  Square,
  SlidersHorizontal,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Mail,
} from 'lucide-react';
import type {
  Campaign,
  ChatThread,
  EmailDraft,
  ExportArtifact,
  ExportFormat,
  ExtractedFilters,
  LeadRecord,
  WorkflowRun,
  WorkspaceSnapshotPayload,
} from '../types/gtm';
import { GtmBrandMark } from './BrandMarks';
import { InlineLeadTable } from './InlineLeadTable';
import {
  CrmSyncSummaryCard,
  ExportDownloadCard,
  InboundSummaryCard,
  InlineDraftTriggerCard,
  ScoreExplanationCard,
} from './InlineDraftAndExport';

interface ChatThreadViewProps {
  snapshot: WorkspaceSnapshotPayload;
  activeThread: ChatThread;
  activeCampaign: Campaign;
  activeDraftId: string | null;
  threadDraftCount: number;
  isSending: boolean;
  selectedModel: string;
  onChangeModel: (model: string) => void;
  onChangeCampaign: (campaignId: string) => void;
  onSendPrompt: (prompt: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  onControlRun: (runId: string, action: 'pause' | 'cancel' | 'resume') => Promise<void>;
  onToggleSelectLead: (leadId: string) => void;
  onSetSelectedLeadIds: (ids: string[]) => void;
  onOpenLeadDetail: (leadId: string) => void;
  onOpenDraft: (draftId: string) => void;
  onOpenLatestDraft: () => void;
  onExportLeads: (format: ExportFormat, leadIds: string[], columns: string[]) => Promise<void>;
  onEmailTeam: (leadIds: string[]) => Promise<void>;
  onDraftProspects: (leadIds: string[]) => Promise<void>;
  onSyncCrm: (leadIds: string[]) => Promise<void>;
  onSaveSearch: () => Promise<void>;
  onUpdateCampaignFilters: (filters: Partial<ExtractedFilters>) => Promise<void>;
  onOpenWorkflowTab: () => void;
}

const MAHARASHTRA_TURN_1 =
  'Find up to 25 heads of operations at packaging manufacturers headquartered in Maharashtra with 50–500 employees. Prioritize companies that posted a production hiring notice in the last 90 days. Exclude our existing HubSpot customers.';

const MAHARASHTRA_TURN_2 =
  'Keep only Pune-headquartered companies with verified work emails. Why did the first lead rank highest? Export the top 10 to Excel and draft an email to sales@example.com with the file attached.';

const INBOUND_FRANCHISE_PROMPT =
  'Import opted-in retail franchise inquiries, deduplicate repeated submissions, assign owners by city, sync eligible records to HubSpot CRM, and export a city-level Excel summary.';

export function ChatThreadView({
  snapshot,
  activeThread,
  activeCampaign,
  activeDraftId,
  threadDraftCount,
  isSending,
  selectedModel,
  onChangeModel,
  onChangeCampaign,
  onSendPrompt,
  onUploadFile,
  onControlRun,
  onToggleSelectLead,
  onSetSelectedLeadIds,
  onOpenLeadDetail,
  onOpenDraft,
  onOpenLatestDraft,
  onExportLeads,
  onEmailTeam,
  onDraftProspects,
  onSyncCrm,
  onSaveSearch,
  onUpdateCampaignFilters,
  onOpenWorkflowTab,
}: ChatThreadViewProps) {
  const [input, setInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingFilters, setEditingFilters] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeThread.messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [activeThread.id, activeThread.messages.length]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setErrorMsg('Describe the leads or workflow action you want to run.');
      return;
    }
    setErrorMsg(null);
    setInput('');
    await onSendPrompt(trimmed);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    await onUploadFile(file);
    e.target.value = '';
  };

  const isEmpty = activeThread.messages.length === 0;
  const hasMaharashtraFirstTurn =
    activeThread.messages.length === 2 &&
    activeThread.messages[0].content.toLowerCase().includes('maharashtra');

  const composerElement = (
    <div className="w-full min-w-0 space-y-2">
      <form
        onSubmit={handleSubmit}
        className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs transition-colors focus-within:border-[#0B6B4E]"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFilePick}
          className="hidden"
        />

        <div className="flex items-end gap-2">
          <label htmlFor="chat-composer" className="sr-only">
            What leads do you want to find?
          </label>
          <textarea
            id="chat-composer"
            rows={isEmpty ? 2 : 1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              isEmpty
                ? 'What leads do you want to find? Describe industry, HQ, size, roles, signals, or export...'
                : 'Ask a follow-up...'
            }
            className="min-w-0 flex-1 resize-none border-0 bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach spreadsheet"
            title="Attach CSV or Excel spreadsheet"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <button
            type="submit"
            disabled={isSending}
            aria-label="Run lead workflow"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0B6B4E] text-white transition-colors hover:bg-[#085840] disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-xs text-red-700"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>

      {/* Quiet secondary selector row for Campaign & AI Model */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <select
            aria-label="Choose campaign"
            value={activeCampaign.id}
            onChange={(e) => onChangeCampaign(e.target.value)}
            className="max-w-[175px] sm:max-w-[220px] truncate rounded-md border border-transparent bg-transparent py-0.5 pr-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 focus:border-slate-200 focus:bg-white"
          >
            {snapshot.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                Campaign: {c.name}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <select
            aria-label="Select AI model"
            value={selectedModel}
            onChange={(e) => onChangeModel(e.target.value)}
            className="max-w-[165px] sm:max-w-[200px] truncate rounded-md border border-transparent bg-transparent py-0.5 pr-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 focus:border-slate-200 focus:bg-white"
          >
            {snapshot.availableModels.map((m) => (
              <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <span className="hidden sm:inline font-mono text-[11px] text-slate-400 tabular-nums">
          Credits {snapshot.activeWorkspace.creditsUsed}/{snapshot.activeWorkspace.creditBudget}
        </span>
      </div>
    </div>
  );

  if (isEmpty) {
    return (
      <div className="flex flex-1 min-w-0 flex-col bg-white overflow-y-auto px-4 sm:px-8 py-10">
        <div className="mx-auto my-auto w-full max-w-2xl space-y-6 min-w-0">
          <div className="text-center space-y-2.5">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#E3F7EC]">
              <GtmBrandMark className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              What leads do you want to find?
            </h1>
            <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Describe your target companies, roles, buying signals, or attach an opted-in CSV/Excel file. Authorized tools run automatically and return ranked leads, exports, and drafts inline.
            </p>
            <div className="text-xs text-slate-500">
              {snapshot.activeWorkspace.mode === 'demo'
                ? 'Demo workspace active · fictional organizations, source fixtures & local email preview'
                : `Live workspace · ${snapshot.connectedToolCount} tools connected (CSV/Excel upload works with 0 external tools)`}
            </div>
          </div>

          {composerElement}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSendPrompt(MAHARASHTRA_TURN_1)}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#0B6B4E] hover:bg-[#F4FBF7]"
            >
              <div className="text-xs font-semibold text-slate-950">
                Outbound — Maharashtra Packaging Heads of Ops
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                &ldquo;{MAHARASHTRA_TURN_1}&rdquo;
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSendPrompt(INBOUND_FRANCHISE_PROMPT)}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#0B6B4E] hover:bg-[#F4FBF7]"
            >
              <div className="text-xs font-semibold text-slate-950">
                Inbound — Opted-in Retail Franchise Inquiries
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                &ldquo;{INBOUND_FRANCHISE_PROMPT}&rdquo;
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 flex-col min-h-0 overflow-hidden bg-white">
      {/* Clean Page Title & Chat / Workflow Underlined Tab Strip (Matching Mockup) */}
      <div className="shrink-0 border-b border-slate-200/90 bg-white px-5 sm:px-8 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-950 truncate">
            {activeThread.title || activeCampaign.name}
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            {threadDraftCount > 0 && !activeDraftId && (
              <button
                type="button"
                onClick={onOpenLatestDraft}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#BDE9D1] bg-[#E3F7EC] px-2.5 py-1.5 text-xs font-semibold text-[#0B6B4E] hover:bg-[#D4F3E2] whitespace-nowrap"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Email draft</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditingFilters((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{editingFilters ? 'Hide filters' : 'Filters'}</span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-6" role="tablist" aria-label="Campaign views">
          <button
            type="button"
            role="tab"
            aria-selected={true}
            className="border-b-2 border-[#0B6B4E] pb-2.5 text-sm font-semibold text-slate-950 whitespace-nowrap"
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            onClick={onOpenWorkflowTab}
            className="border-b-2 border-transparent pb-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 whitespace-nowrap"
          >
            Workflow
          </button>
        </div>
      </div>

      {/* Collapsible Editable Filter Panel */}
      {editingFilters && (
        <div className="shrink-0 border-b border-slate-200 bg-[#F6F7F6] px-5 sm:px-8 py-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div>
            <label htmlFor="flt-industry" className="block text-[11px] text-slate-500 mb-1">
              Industry
            </label>
            <input
              id="flt-industry"
              type="text"
              defaultValue={activeCampaign.filters.industry}
              onBlur={(e) => onUpdateCampaignFilters({ industry: e.target.value })}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label htmlFor="flt-hq" className="block text-[11px] text-slate-500 mb-1">
              Company HQ State / City
            </label>
            <input
              id="flt-hq"
              type="text"
              defaultValue={
                activeCampaign.filters.cityFilter || activeCampaign.filters.companyHqLocation
              }
              onBlur={(e) =>
                onUpdateCampaignFilters({ cityFilter: e.target.value || null })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label htmlFor="flt-window" className="block text-[11px] text-slate-500 mb-1">
              Signal Window (days)
            </label>
            <input
              id="flt-window"
              type="number"
              defaultValue={activeCampaign.filters.signalWindowDays}
              onBlur={(e) =>
                onUpdateCampaignFilters({
                  signalWindowDays: Number(e.target.value) || 90,
                })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono"
            />
          </div>
          <label className="flex items-center gap-2 sm:pt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={activeCampaign.filters.verifiedEmailOnly}
              onChange={(e) =>
                onUpdateCampaignFilters({ verifiedEmailOnly: e.target.checked })
              }
              className="rounded border-slate-300 accent-[#0B6B4E]"
            />
            <span>Verified emails only</span>
          </label>
          <label className="flex items-center gap-2 sm:pt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={activeCampaign.filters.excludeHubSpotCustomers}
              onChange={(e) =>
                onUpdateCampaignFilters({
                  excludeHubSpotCustomers: e.target.checked,
                })
              }
              className="rounded border-slate-300 accent-[#0B6B4E]"
            />
            <span>Exclude HubSpot customers</span>
          </label>
        </div>
      )}

      {/* Scrollable Conversation Thread */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6">
        <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
          {activeThread.messages.map((msg) => {
            const run: WorkflowRun | undefined = msg.runId
              ? snapshot.runs.find((r) => r.id === msg.runId)
              : undefined;
            const msgLeads: LeadRecord[] = (msg.leadIds ?? [])
              .map((id) => snapshot.leads.find((l) => l.id === id))
              .filter((x): x is LeadRecord => Boolean(x));
            const artifact: ExportArtifact | undefined = msg.exportArtifactId
              ? snapshot.exports.find((e) => e.id === msg.exportArtifactId)
              : undefined;
            const drafts: EmailDraft[] = (msg.draftIds ?? [])
              .map((id) => snapshot.drafts.find((d) => d.id === id))
              .filter((x): x is EmailDraft => Boolean(x));

            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end min-w-0">
                  <div className="max-w-[90%] sm:max-w-lg rounded-2xl bg-[#E3F7EC] px-4 py-3 text-sm leading-relaxed text-slate-900 break-words">
                    {msg.content}
                  </div>
                </div>
              );
            }

            const completedSteps = run
              ? run.steps.filter((s) => s.status === 'completed').length
              : 0;
            const isRunExpanded =
              run &&
              (expandedRuns[run.id] ||
                run.status === 'running' ||
                run.status === 'paused');

            return (
              <div key={msg.id} className="min-w-0 space-y-3.5">
                {/* Assistant Lead Line with Brand Mark */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E3F7EC]">
                    <GtmBrandMark className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm leading-relaxed text-slate-900 break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>

                {/* Indented Structured Blocks */}
                <div className="sm:pl-10 space-y-3.5 min-w-0">
                  {/* Collapsible Run Complete Bar (Matching Mockup) */}
                  {run && (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        aria-expanded={Boolean(isRunExpanded)}
                        onClick={() =>
                          setExpandedRuns((prev) => ({
                            ...prev,
                            [run.id]: !prev[run.id],
                          }))
                        }
                        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-slate-50/70"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          {run.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0B6B4E]" />
                          ) : run.status === 'running' ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0B6B4E]" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
                          )}
                          <span className="font-semibold text-slate-950">
                            {run.status === 'completed'
                              ? 'Run complete'
                              : `Run ${run.status}`}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            |
                          </span>
                          <span className="text-slate-600 truncate">
                            {run.toolsUsed.join(' · ')}
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                            isRunExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isRunExpanded && (
                        <div className="border-t border-slate-100 bg-[#FAFAFA] px-4 py-3 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="font-mono tabular-nums">
                              {completedSteps}/{run.steps.length} steps · Run {run.id.slice(-8)} · {run.creditsSpent} credits
                            </span>
                            <div className="flex items-center gap-1.5">
                              {run.status === 'running' && (
                                <button
                                  type="button"
                                  onClick={() => onControlRun(run.id, 'pause')}
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                                >
                                  <Pause className="h-3 w-3" />
                                  <span>Pause</span>
                                </button>
                              )}
                              {(run.status === 'paused' || run.status === 'failed') && (
                                <button
                                  type="button"
                                  onClick={() => onControlRun(run.id, 'resume')}
                                  className="inline-flex items-center gap-1 rounded bg-[#0B6B4E] px-2.5 py-1 text-[11px] font-semibold text-white"
                                >
                                  <Play className="h-3 w-3" />
                                  <span>Resume</span>
                                </button>
                              )}
                              {(run.status === 'running' || run.status === 'paused') && (
                                <button
                                  type="button"
                                  onClick={() => onControlRun(run.id, 'cancel')}
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600"
                                >
                                  <Square className="h-3 w-3" />
                                  <span>Cancel</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={onOpenWorkflowTab}
                                className="font-semibold text-[#0B6B4E] hover:underline ml-1"
                              >
                                Inspect steps
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
                            {run.steps.map((st) => (
                              <div
                                key={st.id}
                                className={`rounded-md px-2 py-1.5 text-[11px] border ${
                                  st.status === 'completed'
                                    ? 'border-[#BDE9D1] bg-[#F2FBF6] text-slate-800'
                                    : st.status === 'running'
                                    ? 'border-[#0B6B4E] bg-[#E3F7EC] text-slate-900'
                                    : 'border-slate-200 bg-white text-slate-500'
                                }`}
                              >
                                <div className="font-medium truncate">
                                  {st.order}. {st.title.split(' ')[0]}
                                </div>
                                <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                                  {st.outputCount} out
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Shortfall Notice */}
                  {msg.shortfallReason && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-950 break-words">
                      <span className="font-semibold">Shortfall note:</span>{' '}
                      {msg.shortfallReason}
                    </div>
                  )}

                  {/* Unsupported Format Notice */}
                  {msg.unsupportedFormatNotice && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-950 break-words">
                      Format{' '}
                      <span className="font-mono font-semibold">
                        {msg.unsupportedFormatNotice.requested}
                      </span>{' '}
                      is not installed. Available exporters:{' '}
                      <span className="font-mono">
                        {msg.unsupportedFormatNotice.alternatives.join(', ')}
                      </span>
                      .
                    </div>
                  )}

                  {/* Inbound Deduplication Summary */}
                  {msg.inboundSummary && (
                    <InboundSummaryCard summary={msg.inboundSummary} />
                  )}

                  {/* Score Ranking Explanation */}
                  {msg.scoreExplanation && (
                    <ScoreExplanationCard explanation={msg.scoreExplanation} />
                  )}

                  {/* Inline Ranked Leads Table */}
                  {msgLeads.length > 0 && (
                    <InlineLeadTable
                      leads={msgLeads}
                      selectedLeadIds={activeThread.selectedLeadIds}
                      activeLeadId={activeThread.activeLeadId}
                      onToggleSelectLead={onToggleSelectLead}
                      onSetSelectedLeadIds={onSetSelectedLeadIds}
                      onOpenLeadDetail={onOpenLeadDetail}
                      onAskWhyLead={(lead) =>
                        onSendPrompt(`Why this lead ${lead.contactName}?`)
                      }
                      onExportLeads={onExportLeads}
                      onEmailTeam={onEmailTeam}
                      onDraftProspects={onDraftProspects}
                      onSyncCrm={onSyncCrm}
                      onSaveSearch={onSaveSearch}
                    />
                  )}

                  {/* CRM Sync Summary */}
                  {msg.crmSyncSummary && (
                    <CrmSyncSummaryCard summary={msg.crmSyncSummary} />
                  )}

                  {/* Inline Export Download Card (Excel / CSV / Parquet / PDF / Sheets) */}
                  {artifact && <ExportDownloadCard artifact={artifact} />}

                  {/* Inline Draft Trigger Cards (opens Right Email Draft Drawer) */}
                  {drafts.map((draft) => (
                    <InlineDraftTriggerCard
                      key={draft.id}
                      draft={draft}
                      isOpen={activeDraftId === draft.id}
                      onOpenDraft={onOpenDraft}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Sticky Follow-Up Composer */}
      <div className="shrink-0 bg-white px-4 sm:px-8 pt-2 pb-4 border-t border-slate-100">
        <div className="mx-auto w-full max-w-3xl min-w-0 space-y-2">
          {hasMaharashtraFirstTurn && !isSending && (
            <button
              type="button"
              onClick={() => onSendPrompt(MAHARASHTRA_TURN_2)}
              className="block w-full truncate rounded-lg border border-[#BDE9D1] bg-[#F2FBF6] px-3 py-1.5 text-left text-xs font-medium text-[#085840] transition-colors hover:bg-[#E3F7EC]"
            >
              Suggested follow-up: &ldquo;{MAHARASHTRA_TURN_2}&rdquo;
            </button>
          )}
          {composerElement}
        </div>
      </div>
    </div>
  );
}
