import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  AlertTriangle,
  Database,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import type {
  CustomFieldDefinition,
  LeadEngagementEvent,
  LeadRecord,
  TerritoryRule,
} from '../types/gtm';

interface LeadDetailsPanelProps {
  lead: LeadRecord;
  leadStages: string[];
  territories: TerritoryRule[];
  customFields: CustomFieldDefinition[];
  hasThreadDraft?: boolean;
  onBackToDraft?: () => void;
  onClose: () => void;
  onUpdateLead: (
    leadId: string,
    patch: {
      owner?: string;
      crmStage?: string;
      customFieldValues?: Record<string, string>;
      newEngagementEvent?: Omit<LeadEngagementEvent, 'id'>;
    }
  ) => Promise<void>;
  onSyncSingleLead: (leadId: string) => Promise<void>;
  onDraftOutreachForLead: (leadId: string) => Promise<void>;
}

export function LeadDetailsPanel({
  lead,
  leadStages,
  territories,
  customFields,
  hasThreadDraft,
  onBackToDraft,
  onClose,
  onUpdateLead,
  onSyncSingleLead,
  onDraftOutreachForLead,
}: LeadDetailsPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const ownerChoices = Array.from(
    new Set([lead.owner, ...territories.map((t) => t.ownerName), 'Unassigned'])
  );

  const handleRecordEvent = async (type: LeadEngagementEvent['type']) => {
    await onUpdateLead(lead.id, {
      newEngagementEvent: {
        type,
        date: new Date().toISOString().slice(0, 10),
        channel: 'email',
        note: `Recorded ${type.replace('_', ' ')} from lead details panel`,
      },
      crmStage:
        type === 'replied'
          ? 'Replied'
          : type === 'meeting_booked'
          ? 'Meeting Booked'
          : type === 'opportunity'
          ? 'Opportunity'
          : lead.crmStage,
    });
  };

  return (
    <aside
      aria-label={`Lead details for ${lead.contactName}`}
      className="fixed inset-0 z-40 lg:static lg:z-auto flex h-full w-full lg:w-[340px] xl:w-[375px] shrink-0 flex-col border-l border-slate-200 bg-white overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4 space-y-2">
        {hasThreadDraft && onBackToDraft && (
          <button
            type="button"
            onClick={onBackToDraft}
            className="text-[11px] font-semibold text-[#0B6B4E] hover:underline"
          >
            &larr; Back to Email draft
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 truncate">
              {lead.companyName} · {lead.companyHqCity}, {lead.companyHqState}
            </div>
            <h3 className="mt-0.5 font-display text-base font-bold text-slate-950 truncate">
              {lead.contactName}
            </h3>
            <div className="text-xs text-slate-600">{lead.contactTitle}</div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right">
              <div className="font-mono text-lg font-bold text-[#0B6B4E] tabular-nums">
                {lead.scoreTotal}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </div>
              <div className="text-[11px] font-medium text-slate-600">
                {lead.qualificationLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lead details panel"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5 text-xs">
        {lead.ambiguousIdentityFlag && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Ambiguous Identity Flagged for Review</span>
            </div>
            <p className="mt-1 text-[11px]">{lead.ambiguousReason}</p>
          </div>
        )}

        {/* Contact & Verification */}
        <section className="space-y-1.5 border-b border-slate-200 pb-4">
          <h4 className="font-semibold text-slate-900">Contact &amp; Verification</h4>
          <div className="text-slate-700 font-mono text-[11px] break-all">
            {lead.workEmail || 'No email recorded'}
          </div>
          <div className="text-[11px] text-slate-500">
            Email verdict:{' '}
            <span
              className={`font-semibold ${
                lead.emailStatus === 'valid'
                  ? 'text-emerald-700'
                  : lead.emailStatus === 'invalid'
                  ? 'text-red-700'
                  : 'text-amber-700'
              }`}
            >
              {lead.emailStatus}
            </span>{' '}
            · Provider: {lead.emailProvider} · Checked: {lead.emailVerifiedAt}
          </div>
          <div className="text-[11px] text-slate-500">
            Data coverage:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800">
              {lead.dataCoveragePct}%
            </span>{' '}
            · Employees:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800">
              {lead.employeeCount ?? 'Unknown'}
            </span>{' '}
            · Acquisition: {lead.acquisitionSource}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={drafting}
              onClick={async () => {
                setDrafting(true);
                await onDraftOutreachForLead(lead.id);
                setDrafting(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B6B4E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#085840] disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>{drafting ? 'Drafting...' : 'Draft Outreach'}</span>
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                await onSyncSingleLead(lead.id);
                setSyncing(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              <Database className="h-3.5 w-3.5 text-[#0B6B4E]" />
              <span>{syncing ? 'Syncing...' : lead.crmRecordId ? 'Update HubSpot' : 'Sync to HubSpot'}</span>
            </button>
          </div>
        </section>

        {/* Score Breakdown */}
        <section className="space-y-2.5 border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900">Score Breakdown</h4>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {lead.scoreBreakdown.companyFit}+{lead.scoreBreakdown.roleFit}+
              {lead.scoreBreakdown.buyingSignals}+{lead.scoreBreakdown.engagement} ={' '}
              {lead.scoreTotal}
            </span>
          </div>
          <div className="space-y-2">
            {lead.scoreBreakdown.factors.map((f) => (
              <div key={f.factor}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-800">{f.factor}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {f.points}/{f.maxPoints}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{f.reason}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AI Company Brief & Opener */}
        <section className="space-y-2 border-b border-slate-200 pb-4">
          <h4 className="font-semibold text-slate-900">Company Brief &amp; Opener</h4>
          <p className="text-slate-700 leading-relaxed">{lead.companyBrief}</p>
          <div className="rounded-md bg-slate-50 p-3 border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-700 mb-1">
              Suggested Conversation Opener
            </div>
            <p className="text-slate-800 leading-relaxed">{lead.conversationOpener}</p>
          </div>
        </section>

        {/* Dated Buying Signals & Evidence */}
        <section className="space-y-2.5 border-b border-slate-200 pb-4">
          <h4 className="font-semibold text-slate-900">
            Dated Buying Signals ({lead.signals.length})
          </h4>
          {lead.signals.map((sig) => (
            <div
              key={sig.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-2.5 space-y-1"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-slate-900">{sig.type}</span>
                <span className="font-mono text-slate-500 tabular-nums">
                  Event: {sig.eventDate}
                </span>
              </div>
              <div className="font-medium text-slate-800">{sig.title}</div>
              <p className="text-[11px] text-slate-600">{sig.summary}</p>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500">
                  {sig.sourceName} · Observed {sig.observedAt.slice(0, 10)}
                </span>
                {sig.sourceUrlOrId.startsWith('http') ? (
                  <a
                    href={sig.sourceUrlOrId}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline"
                  >
                    <span>Source</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-mono text-slate-500">{sig.sourceUrlOrId}</span>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Owner, CRM Status & Observed Outcomes */}
        <section className="space-y-3 border-b border-slate-200 pb-4">
          <h4 className="font-semibold text-slate-900">Owner &amp; CRM Status</h4>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="detail-owner"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                Owner ({lead.territory})
              </label>
              <select
                id="detail-owner"
                value={lead.owner}
                onChange={(e) => onUpdateLead(lead.id, { owner: e.target.value })}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-900"
              >
                {ownerChoices.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="detail-stage"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                CRM Stage
              </label>
              <select
                id="detail-stage"
                value={lead.crmStage}
                onChange={(e) => onUpdateLead(lead.id, { crmStage: e.target.value })}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-900"
              >
                {leadStages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {lead.crmRecordId && lead.crmRecordUrl && (
            <div className="flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-900">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                HubSpot ID: {lead.crmRecordId}
              </span>
              <a
                href={lead.crmRecordUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline"
              >
                <span>Open CRM</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-medium text-slate-500">Custom Fields</div>
              <div className="grid grid-cols-2 gap-2">
                {customFields.map((cf) => (
                  <div key={cf.id}>
                    <label
                      htmlFor={`cf-${cf.key}`}
                      className="block text-[10px] text-slate-500"
                    >
                      {cf.label}
                    </label>
                    <input
                      id={`cf-${cf.key}`}
                      type="text"
                      defaultValue={lead.customFieldValues[cf.key] ?? ''}
                      onBlur={(e) =>
                        onUpdateLead(lead.id, {
                          customFieldValues: { [cf.key]: e.target.value },
                        })
                      }
                      className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Log Observed Outcomes */}
          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1.5">
              Log Observed Outcome (Updates Funnel)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { type: 'replied', label: '+ Replied' },
                  { type: 'meeting_booked', label: '+ Meeting' },
                  { type: 'opportunity', label: '+ Opportunity' },
                  { type: 'unsubscribed', label: 'Unsubscribed' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.type}
                  type="button"
                  onClick={() => handleRecordEvent(btn.type)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Provenance & Activity */}
        <section className="space-y-2">
          <h4 className="font-semibold text-slate-900">Sources &amp; Activity</h4>
          <div className="space-y-1 text-[11px] text-slate-600">
            {lead.sources.map((src, i) => (
              <div key={`${src.provider}-${i}`} className="truncate">
                <span className="font-medium text-slate-800">{src.provider}</span> ·{' '}
                <span className="font-mono text-slate-500">{src.recordId}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 space-y-1.5 border-t border-slate-100">
            {lead.activityLog.map((act, i) => (
              <div key={i} className="text-[11px] text-slate-600">
                <span className="font-mono text-slate-400">{act.timestamp}</span> — {act.summary}
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
