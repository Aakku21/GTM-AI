import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Columns3,
  Maximize2,
  Minimize2,
  Download,
  Mail,
  Database,
  BookmarkPlus,
  ExternalLink,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { ExportFormat, LeadRecord } from '../types/gtm';

interface InlineLeadTableProps {
  leads: LeadRecord[];
  selectedLeadIds: string[];
  activeLeadId: string | null;
  onToggleSelectLead: (leadId: string) => void;
  onSetSelectedLeadIds: (ids: string[]) => void;
  onOpenLeadDetail: (leadId: string) => void;
  onAskWhyLead: (lead: LeadRecord) => void;
  onExportLeads: (format: ExportFormat, leadIds: string[], columns: string[]) => Promise<void>;
  onEmailTeam: (leadIds: string[]) => Promise<void>;
  onDraftProspects: (leadIds: string[]) => Promise<void>;
  onSyncCrm: (leadIds: string[]) => Promise<void>;
  onSaveSearch: () => Promise<void>;
}

const ALL_COLUMNS = [
  { key: 'companyName', label: 'Company' },
  { key: 'contactName', label: 'Contact' },
  { key: 'strongestSignal', label: 'Buying signal' },
  { key: 'scoreTotal', label: 'Score' },
  { key: 'companyHqCity', label: 'HQ Location' },
  { key: 'workEmail', label: 'Work Email' },
  { key: 'emailStatus', label: 'Verification' },
  { key: 'signalSource', label: 'Source & Date' },
  { key: 'crmStage', label: 'CRM Stage' },
  { key: 'owner', label: 'Owner' },
] as const;

type SortField = 'scoreTotal' | 'companyName' | 'signalDate' | 'employeeCount';

function compactSignalLabel(title?: string, type?: string): string {
  if (!title) return type || '—';
  const cleaned = title.replace(/^Hiring \d+\s+/i, 'Hiring ').trim();
  return cleaned.length > 30 ? `${cleaned.slice(0, 28)}…` : cleaned;
}

export function InlineLeadTable({
  leads,
  selectedLeadIds,
  activeLeadId,
  onToggleSelectLead,
  onSetSelectedLeadIds,
  onOpenLeadDetail,
  onAskWhyLead,
  onExportLeads,
  onEmailTeam,
  onDraftProspects,
  onSyncCrm,
  onSaveSearch,
}: InlineLeadTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [qualFilter, setQualFilter] = useState<'All' | 'Qualified' | 'Needs review' | 'Disqualified'>('All');
  const [emailFilter, setEmailFilter] = useState<'All' | 'valid' | 'accept-all' | 'unknown'>('All');
  const [sortField, setSortField] = useState<SortField>('scoreTotal');
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<string[]>([
    'companyName',
    'contactName',
    'strongestSignal',
    'scoreTotal',
    'companyHqCity',
    'workEmail',
    'emailStatus',
    'signalSource',
    'crmStage',
  ]);

  const filteredAndSorted = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const list = leads.filter((l) => {
      if (qualFilter !== 'All' && l.qualificationLabel !== qualFilter) return false;
      if (emailFilter !== 'All' && l.emailStatus !== emailFilter) return false;
      if (q) {
        const blob = `${l.companyName} ${l.contactName} ${l.contactTitle} ${l.companyHqCity} ${l.workEmail} ${l.signals[0]?.title ?? ''} ${l.signals[0]?.type ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortField === 'scoreTotal') return (a.scoreTotal - b.scoreTotal) * dir;
      if (sortField === 'companyName') return a.companyName.localeCompare(b.companyName) * dir;
      if (sortField === 'employeeCount') return ((a.employeeCount ?? 0) - (b.employeeCount ?? 0)) * dir;
      const dA = a.signals[0]?.eventDate ?? '';
      const dB = b.signals[0]?.eventDate ?? '';
      return dA.localeCompare(dB) * dir;
    });
  }, [leads, searchText, qualFilter, emailFilter, sortField, sortAsc]);

  const activeTargetIds = useMemo(() => {
    const selectedInView = filteredAndSorted
      .filter((l) => selectedLeadIds.includes(l.id))
      .map((l) => l.id);
    return selectedInView.length > 0
      ? selectedInView
      : filteredAndSorted.map((l) => l.id);
  }, [filteredAndSorted, selectedLeadIds]);

  const allVisibleSelected =
    filteredAndSorted.length > 0 &&
    filteredAndSorted.every((l) => selectedLeadIds.includes(l.id));

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(field === 'companyName');
    }
  };

  const toggleCol = (key: string) => {
    setVisibleCols((prev) =>
      prev.includes(key)
        ? prev.length > 2
          ? prev.filter((k) => k !== key)
          : prev
        : [...prev, key]
    );
  };

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setBusyAction(label);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

  const compactRows = filteredAndSorted.slice(0, 3);
  const isFullView = showAll || expanded;

  const fullTableContent = (
    <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <h3 className="font-display text-base font-bold text-slate-950">
            Ranked leads
          </h3>
          <span className="text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-800 tabular-nums">
              {filteredAndSorted.length}
            </span>{' '}
            matched
            {selectedLeadIds.length > 0 && (
              <>
                {' '}
                ·{' '}
                <span className="font-mono font-semibold text-[#0B6B4E] tabular-nums">
                  {selectedLeadIds.length}
                </span>{' '}
                selected
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 relative">
          {!expanded && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Compact view
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowColPicker((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span>Columns</span>
          </button>

          {showColPicker && (
            <div className="absolute right-0 top-9 z-30 w-48 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500 pb-1 border-b border-slate-100">
                Visible Columns
              </div>
              {ALL_COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleCols.includes(c.key)}
                    onChange={() => toggleCol(c.key)}
                    className="rounded border-slate-300 accent-[#0B6B4E]"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            {expanded ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Collapse</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters & Bulk Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 px-4 py-2.5 bg-[#FAFAFA]">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Filter leads in table"
              placeholder="Search company, contact..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full sm:w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <select
            aria-label="Filter by qualification"
            value={qualFilter}
            onChange={(e) => setQualFilter(e.target.value as typeof qualFilter)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
          >
            <option value="All">All statuses</option>
            <option value="Qualified">Qualified</option>
            <option value="Needs review">Needs review</option>
            <option value="Disqualified">Disqualified</option>
          </select>

          <select
            aria-label="Filter by email verification"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value as typeof emailFilter)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
          >
            <option value="All">All emails</option>
            <option value="valid">Valid only</option>
            <option value="accept-all">Accept-all</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="Export file format"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800"
          >
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="parquet">Parquet</option>
            <option value="pdf">PDF Brief</option>
            <option value="google_sheet">Google Sheet</option>
          </select>

          <button
            type="button"
            disabled={busyAction !== null || activeTargetIds.length === 0}
            onClick={() =>
              runAction('export', () =>
                onExportLeads(exportFormat, activeTargetIds, ['lead_id', ...visibleCols])
              )
            }
            className="inline-flex items-center gap-1 rounded-lg bg-[#0B6B4E] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#085840] disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{busyAction === 'export' ? 'Exporting...' : `Export (${activeTargetIds.length})`}</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null || activeTargetIds.length === 0}
            onClick={() => runAction('team', () => onEmailTeam(activeTargetIds))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Email Team</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null || activeTargetIds.length === 0}
            onClick={() => runAction('outreach', () => onDraftProspects(activeTargetIds))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <span>Draft Outreach</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null || activeTargetIds.length === 0}
            onClick={() => runAction('crm', () => onSyncCrm(activeTargetIds))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Database className="h-3.5 w-3.5 text-[#0B6B4E]" />
            <span>Sync HubSpot</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runAction('save', onSaveSearch)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>Save Search</span>
          </button>
        </div>
      </div>

      {/* Desktop Data Table (strictly contained horizontal scroll) */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-[#F6F7F6] text-[11px] font-semibold text-slate-600">
              <th className="w-9 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all visible leads"
                  checked={allVisibleSelected}
                  onChange={() =>
                    onSetSelectedLeadIds(
                      allVisibleSelected ? [] : filteredAndSorted.map((l) => l.id)
                    )
                  }
                  className="rounded border-slate-300 accent-[#0B6B4E]"
                />
              </th>
              {visibleCols.includes('companyName') && (
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('companyName')}
                    className="inline-flex items-center gap-1 hover:text-slate-950"
                  >
                    <span>Company</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              )}
              {visibleCols.includes('contactName') && (
                <th className="px-3 py-2.5">Contact</th>
              )}
              {visibleCols.includes('strongestSignal') && (
                <th className="px-3 py-2.5">Buying signal</th>
              )}
              {visibleCols.includes('scoreTotal') && (
                <th className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('scoreTotal')}
                    className="inline-flex items-center gap-1 hover:text-slate-950 ml-auto"
                  >
                    <span>Score</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              )}
              {visibleCols.includes('companyHqCity') && (
                <th className="px-3 py-2.5">HQ Location</th>
              )}
              {visibleCols.includes('workEmail') && (
                <th className="px-3 py-2.5">Work Email</th>
              )}
              {visibleCols.includes('emailStatus') && (
                <th className="px-3 py-2.5">Verification</th>
              )}
              {visibleCols.includes('signalSource') && (
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('signalDate')}
                    className="inline-flex items-center gap-1 hover:text-slate-950"
                  >
                    <span>Source &amp; Date</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              )}
              {visibleCols.includes('crmStage') && (
                <th className="px-3 py-2.5">CRM Stage</th>
              )}
              {visibleCols.includes('owner') && (
                <th className="px-3 py-2.5">Owner</th>
              )}
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAndSorted.map((lead) => {
              const isSelected = selectedLeadIds.includes(lead.id);
              const isActive = activeLeadId === lead.id;
              const sig = lead.signals[0];
              return (
                <tr
                  key={lead.id}
                  className={`transition-colors ${
                    isActive
                      ? 'bg-[#E3F7EC]/60'
                      : isSelected
                      ? 'bg-slate-50'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  <td className="px-3 py-2.5 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Select ${lead.contactName} at ${lead.companyName}`}
                      checked={isSelected}
                      onChange={() => onToggleSelectLead(lead.id)}
                      className="rounded border-slate-300 accent-[#0B6B4E]"
                    />
                  </td>
                  {visibleCols.includes('companyName') && (
                    <td className="px-3 py-2.5 align-top">
                      <button
                        type="button"
                        onClick={() => onOpenLeadDetail(lead.id)}
                        className="text-left font-semibold text-slate-950 hover:text-[#0B6B4E]"
                      >
                        {lead.companyName}
                      </button>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {lead.employeeCount ? `${lead.employeeCount} emp` : lead.industry}
                      </div>
                    </td>
                  )}
                  {visibleCols.includes('contactName') && (
                    <td className="px-3 py-2.5 align-top">
                      <div className="font-medium text-slate-900">{lead.contactName}</div>
                      <div className="text-[11px] text-slate-500">{lead.contactTitle}</div>
                    </td>
                  )}
                  {visibleCols.includes('strongestSignal') && (
                    <td className="px-3 py-2.5 align-top max-w-[220px]">
                      <div className="text-slate-800 line-clamp-2">{sig?.title ?? '—'}</div>
                    </td>
                  )}
                  {visibleCols.includes('scoreTotal') && (
                    <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                      <span
                        className={`inline-flex min-w-[34px] justify-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                          lead.qualificationLabel === 'Qualified'
                            ? 'bg-[#DCF5E7] text-[#0B6B4E]'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {lead.scoreTotal}
                      </span>
                    </td>
                  )}
                  {visibleCols.includes('companyHqCity') && (
                    <td className="px-3 py-2.5 align-top text-slate-700 whitespace-nowrap">
                      {lead.companyHqCity}
                      {lead.companyHqState ? `, ${lead.companyHqState}` : ''}
                    </td>
                  )}
                  {visibleCols.includes('workEmail') && (
                    <td className="px-3 py-2.5 align-top font-mono text-[11px] text-slate-700 max-w-[170px] truncate">
                      {lead.workEmail || '—'}
                    </td>
                  )}
                  {visibleCols.includes('emailStatus') && (
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          lead.emailStatus === 'valid'
                            ? 'text-[#0B6B4E]'
                            : lead.emailStatus === 'invalid'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {lead.emailStatus}
                      </span>
                      <div className="text-[10px] text-slate-400">{lead.emailProvider}</div>
                    </td>
                  )}
                  {visibleCols.includes('signalSource') && (
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      {sig ? (
                        <>
                          {sig.sourceUrlOrId.startsWith('http') ? (
                            <a
                              href={sig.sourceUrlOrId}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-[#0B6B4E] hover:underline"
                            >
                              <span className="max-w-[115px] truncate">{sig.sourceName}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <div className="text-slate-700 max-w-[125px] truncate">
                              {sig.sourceName}
                            </div>
                          )}
                          <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                            {sig.eventDate}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  {visibleCols.includes('crmStage') && (
                    <td className="px-3 py-2.5 align-top whitespace-nowrap text-slate-700">
                      {lead.crmStage}
                    </td>
                  )}
                  {visibleCols.includes('owner') && (
                    <td className="px-3 py-2.5 align-top whitespace-nowrap text-slate-700">
                      {lead.owner}
                    </td>
                  )}
                  <td className="px-3 py-2.5 align-top text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => onAskWhyLead(lead)}
                      className="text-xs font-medium text-slate-600 hover:text-[#0B6B4E]"
                    >
                      Why?
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenLeadDetail(lead.id)}
                      className="text-xs font-semibold text-[#0B6B4E] hover:underline"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-xs text-slate-500">
                  No leads match the current table filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Compact Cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {filteredAndSorted.map((lead) => {
          const sig = lead.signals[0];
          const isSelected = selectedLeadIds.includes(lead.id);
          return (
            <div key={lead.id} className="p-3.5 space-y-2 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <label className="flex items-start gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelectLead(lead.id)}
                    className="mt-1 rounded border-slate-300 accent-[#0B6B4E]"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950 truncate">
                      {lead.companyName}
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {lead.contactName} · {lead.contactTitle}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {lead.companyHqCity} · {lead.emailStatus} · {lead.crmStage}
                    </div>
                  </div>
                </label>
                <span className="shrink-0 rounded-md bg-[#DCF5E7] px-2 py-0.5 font-mono text-xs font-semibold text-[#0B6B4E] tabular-nums">
                  {lead.scoreTotal}
                </span>
              </div>
              {sig && (
                <div className="pl-6 text-[11px] text-slate-600 break-words">
                  <span className="font-medium text-slate-800">{sig.eventDate}:</span> {sig.title}
                </div>
              )}
              <div className="pl-6 flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => onOpenLeadDetail(lead.id)}
                  className="font-semibold text-[#0B6B4E]"
                >
                  Open details
                </button>
                <button
                  type="button"
                  onClick={() => onAskWhyLead(lead)}
                  className="font-medium text-slate-600"
                >
                  Why this lead?
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Clean Compact "Ranked leads" Card (default, matching reference mockup)
  const compactCard = (
    <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold text-slate-950">
          Ranked leads
        </h3>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filter &amp; actions</span>
        </button>
      </div>

      {/* Desktop clean 4-column summary table matching mockup */}
      <div className="hidden sm:block w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#F6F7F6] text-xs font-semibold text-slate-600">
              <th className="rounded-l-lg px-3.5 py-2.5">Company</th>
              <th className="px-3.5 py-2.5">Contact</th>
              <th className="px-3.5 py-2.5">Buying signal</th>
              <th className="rounded-r-lg px-3.5 py-2.5 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {compactRows.map((lead) => {
              const sig = lead.signals[0];
              const isActive = activeLeadId === lead.id;
              return (
                <tr
                  key={lead.id}
                  className={`transition-colors ${
                    isActive ? 'bg-[#E3F7EC]/50' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="px-3.5 py-3 font-medium text-slate-950">
                    <button
                      type="button"
                      onClick={() => onOpenLeadDetail(lead.id)}
                      className="text-left hover:text-[#0B6B4E] transition-colors"
                    >
                      {lead.companyName}
                    </button>
                  </td>
                  <td className="px-3.5 py-3 text-slate-800 whitespace-nowrap">
                    {lead.contactName}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">
                    {compactSignalLabel(sig?.title, sig?.type)}
                  </td>
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex min-w-[36px] justify-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                        lead.qualificationLabel === 'Qualified'
                          ? 'bg-[#DCF5E7] text-[#0B6B4E]'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {lead.scoreTotal}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile compact summary cards */}
      <div className="sm:hidden divide-y divide-slate-100">
        {compactRows.map((lead) => {
          const sig = lead.signals[0];
          return (
            <button
              key={lead.id}
              type="button"
              onClick={() => onOpenLeadDetail(lead.id)}
              className="flex w-full items-start justify-between gap-2 py-2.5 text-left"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-950 truncate">
                  {lead.companyName}
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {lead.contactName} · {compactSignalLabel(sig?.title, sig?.type)}
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-[#DCF5E7] px-2 py-0.5 font-mono text-xs font-semibold text-[#0B6B4E] tabular-nums">
                {lead.scoreTotal}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-sm font-medium text-[#0B6B4E] underline underline-offset-4 hover:text-[#085840]"
        >
          {leads.length === 1 ? 'View 1 lead' : `View all ${leads.length} leads`}
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => runAction('save', onSaveSearch)}
            className="hover:text-[#0B6B4E]"
          >
            Save search
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() =>
              runAction('crm', () => onSyncCrm(filteredAndSorted.map((l) => l.id)))
            }
            className="hover:text-[#0B6B4E]"
          >
            Sync HubSpot
          </button>
        </div>
      </div>
    </div>
  );

  if (expanded) {
    return (
      <div
        role="dialog"
        aria-label="Expanded full-width lead table"
        className="fixed inset-0 z-50 flex flex-col bg-slate-900/50 p-4 sm:p-6"
      >
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-lg">
          <div className="flex-1 overflow-auto">{fullTableContent}</div>
        </div>
      </div>
    );
  }

  return isFullView ? fullTableContent : compactCard;
}
