import React from 'react';
import {
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Database,
  Users,
  FileText,
  ArrowUpRight,
} from 'lucide-react';
import type {
  CrmSyncSummaryBlock,
  EmailDraft,
  ExportArtifact,
  InboundDedupSummaryBlock,
  ScoreExplanationBlock,
} from '../types/gtm';
import { ExcelFileIcon, GmailIcon, OutlookIcon } from './BrandMarks';

export function ScoreExplanationCard({
  explanation,
}: {
  explanation: ScoreExplanationBlock;
}) {
  return (
    <section
      aria-label="Score ranking explanation"
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="min-w-0">
          <h4 className="font-display text-sm font-bold text-slate-950">
            Why {explanation.leadName} ({explanation.companyName}) ranked #1
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {explanation.qualificationLabel} · Reconciled factor sum:{' '}
            <span className="font-mono font-semibold text-slate-800 tabular-nums">
              {explanation.reconciledSum}/{explanation.scoreTotal}
            </span>
          </p>
        </div>
        <div className="rounded-md bg-[#DCF5E7] px-2.5 py-0.5 font-mono text-sm font-bold text-[#0B6B4E] tabular-nums">
          {explanation.scoreTotal}/100
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-700">
        {explanation.summaryText}
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {explanation.factors.map((f) => {
          const pct = f.maxPoints > 0 ? Math.round((f.points / f.maxPoints) * 100) : 0;
          return (
            <div key={f.factor} className="rounded-lg bg-[#F6F7F6] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900">{f.factor}</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {f.points} / {f.maxPoints}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#0B6B4E]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-600 leading-snug">
                {f.reason}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ExportDownloadCard({
  artifact,
}: {
  artifact: ExportArtifact;
}) {
  const isExcel = artifact.format === 'xlsx';
  const formatDescriptor =
    artifact.format === 'xlsx'
      ? 'Excel workbook'
      : artifact.format === 'google_sheet'
      ? 'Google Sheet'
      : `${artifact.format.toUpperCase()} export`;

  return (
    <section
      aria-label={`Download ${artifact.fileName}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {isExcel ? (
          <ExcelFileIcon className="h-8 w-8 shrink-0" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E3F7EC] text-[#0B6B4E]">
            <FileText className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950 truncate">
            {artifact.fileName}
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-mono tabular-nums">{artifact.rowCount}</span> leads · {formatDescriptor}
            {artifact.sheetsIncluded ? ` · ${artifact.sheetsIncluded.length} sheets` : ''}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {artifact.externalUrl && (
          <a
            href={artifact.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Sheet</span>
          </a>
        )}
        <a
          href={artifact.downloadUrl}
          download={artifact.fileName}
          aria-label={`Download ${artifact.fileName}`}
          title={`Download ${artifact.fileName}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 hover:text-[#0B6B4E]"
        >
          <Download className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}

export function InlineDraftTriggerCard({
  draft,
  isOpen,
  onOpenDraft,
}: {
  draft: EmailDraft;
  isOpen: boolean;
  onOpenDraft: (draftId: string) => void;
}) {
  const isSent = draft.status === 'sent';
  const isBlocked = draft.status === 'blocked_suppressed';

  return (
    <button
      type="button"
      onClick={() => onOpenDraft(draft.id)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
        isOpen
          ? 'border-[#0B6B4E] bg-[#F2FBF6]'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {draft.provider === 'outlook' ? (
          <OutlookIcon className="h-5 w-5 shrink-0" />
        ) : (
          <GmailIcon className="h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 truncate">
            <span className="truncate">{draft.subject}</span>
          </div>
          <div className="text-xs text-slate-500 truncate">
            To: {draft.recipients.join(', ')}
            {draft.attachmentFileName ? ` · Attached: ${draft.attachmentFileName}` : ''}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 text-xs font-medium">
        {isSent ? (
          <span className="inline-flex items-center gap-1 text-[#0B6B4E] font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Sent</span>
          </span>
        ) : isBlocked ? (
          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Blocked</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[#0B6B4E]">
            <span>{isOpen ? 'Open in panel' : 'Open draft'}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </button>
  );
}

export function CrmSyncSummaryCard({ summary }: { summary: CrmSyncSummaryBlock }) {
  return (
    <section
      aria-label="CRM sync summary"
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-950">
          <Database className="h-3.5 w-3.5 text-[#0B6B4E]" />
          <span>{summary.provider} CRM Sync Complete</span>
        </div>
        <div className="text-xs font-mono text-slate-600 tabular-nums">
          {summary.syncedCount} synced ({summary.createdCount} created · {summary.updatedCount} updated · {summary.skippedCount} skipped)
        </div>
      </div>

      <div className="text-[11px] text-slate-600">
        <span className="font-semibold text-slate-800">Field Mapping:</span>{' '}
        {summary.fieldMappings.map((m) => `${m.sourceField} → ${m.crmField}`).join(' · ')}
      </div>

      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {summary.records.slice(0, 6).map((rec) => (
          <div
            key={rec.leadId}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
          >
            <div className="min-w-0">
              <span className="font-medium text-slate-900">{rec.contactName}</span>{' '}
              <span className="text-slate-500">· {rec.companyName} · Owner: {rec.owner}</span>
            </div>
            <a
              href={rec.crmRecordUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-[#0B6B4E] hover:underline shrink-0"
            >
              <span>{rec.crmRecordId}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

export function InboundSummaryCard({ summary }: { summary: InboundDedupSummaryBlock }) {
  return (
    <section
      aria-label="Inbound deduplication and city routing summary"
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-950">
          <Users className="h-3.5 w-3.5 text-[#0B6B4E]" />
          <span>Inbound Deduplication &amp; City Territory Assignment</span>
        </div>
        <div className="text-xs font-mono text-slate-600 tabular-nums">
          {summary.rawCount} raw → {summary.deduplicatedCount} unique ({summary.duplicatesMerged} merged)
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {summary.cityCounts.map((c) => (
          <div key={c.city} className="rounded-lg bg-[#F6F7F6] px-3 py-2.5">
            <div className="text-xs font-semibold text-slate-900">{c.city}</div>
            <div className="mt-0.5 font-mono text-sm font-bold text-[#0B6B4E] tabular-nums">
              {c.count === 1 ? '1 lead' : `${c.count} leads`}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
              Owner: {c.owner}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
