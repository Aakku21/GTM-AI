import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import type {
  AiProviderId,
  AuditEvent,
  Workspace,
  WorkspaceSnapshotPayload,
} from '../types/gtm';

interface SettingsViewProps {
  workspace: Workspace;
  availableModels: WorkspaceSnapshotPayload['availableModels'];
  auditEvents: AuditEvent[];
  onSaveWorkspace: (patch: Partial<Workspace>) => Promise<void>;
}

export function SettingsView({
  workspace,
  availableModels,
  auditEvents,
  onSaveWorkspace,
}: SettingsViewProps) {
  const [currency, setCurrency] = useState(workspace.currency);
  const [timeZone, setTimeZone] = useState(workspace.timeZone);
  const [creditBudget, setCreditBudget] = useState(workspace.creditBudget);
  const [retentionDays, setRetentionDays] = useState(workspace.retentionDays);
  const [aiChoice, setAiChoice] = useState(`${workspace.aiProvider}:${workspace.aiModel}`);
  const [scoring, setScoring] = useState(workspace.scoringRules);
  const [newSuppression, setNewSuppression] = useState('');
  const [newSuppressionReason, setNewSuppressionReason] = useState<'opt_out' | 'customer' | 'permanent_bounce' | 'do_not_contact'>('opt_out');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const [aiProvider, aiModel] = aiChoice.split(':') as [AiProviderId, string];
    await onSaveWorkspace({
      currency,
      timeZone,
      creditBudget: Number(creditBudget) || 1000,
      retentionDays: Number(retentionDays) || 365,
      aiProvider,
      aiModel,
      scoringRules: scoring,
    });
    setSavedNotice('Workspace settings and scoring weights saved (all campaign leads re-scored).');
    setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppression.trim()) return;
    await onSaveWorkspace({
      suppressions: [
        {
          id: `sup-${Date.now()}`,
          pattern: newSuppression.trim().toLowerCase(),
          reason: newSuppressionReason,
          createdAt: new Date().toISOString().slice(0, 10),
        },
        ...workspace.suppressions,
      ],
    });
    setNewSuppression('');
  };

  const handleRemoveSuppression = async (id: string) => {
    await onSaveWorkspace({
      suppressions: workspace.suppressions.filter((s) => s.id !== id),
    });
  };

  const handleAddCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;
    const key = newFieldLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    await onSaveWorkspace({
      customFields: [
        ...workspace.customFields,
        { id: `cf-${Date.now()}`, key, label: newFieldLabel.trim(), type: 'text' },
      ],
    });
    setNewFieldLabel('');
  };

  const weightSum =
    scoring.companyFitMax +
    scoring.roleFitMax +
    scoring.buyingSignalsMax +
    scoring.engagementMax;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mx-auto max-w-5xl space-y-6 text-xs">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Workspace Settings — {workspace.name}
          </h1>
          <p className="mt-1 text-slate-600">
            Configure workspace currency, time zone, AI model provider, scoring rubric, territories, custom fields, suppression rules, and review audit events.
          </p>
        </div>

        {savedNotice && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* General, Model & Scoring Rules */}
        <form
          onSubmit={handleSaveGeneral}
          className="rounded-lg border border-slate-200 bg-white p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Profile, AI Model &amp; Editable Scoring Rules
            </h2>
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Save Changes
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="ws-currency" className="block text-[11px] font-medium text-slate-600 mb-1">
                Currency
              </label>
              <select
                id="ws-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label htmlFor="ws-tz" className="block text-[11px] font-medium text-slate-600 mb-1">
                Time Zone
              </label>
              <select
                id="ws-tz"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
            <div>
              <label htmlFor="ws-budget" className="block text-[11px] font-medium text-slate-600 mb-1">
                Provider Credit Budget
              </label>
              <input
                id="ws-budget"
                type="number"
                value={creditBudget}
                onChange={(e) => setCreditBudget(Number(e.target.value))}
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="ws-retention" className="block text-[11px] font-medium text-slate-600 mb-1">
                Data Retention (Days)
              </label>
              <input
                id="ws-retention"
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ws-ai" className="block text-[11px] font-medium text-slate-600 mb-1">
              Workspace AI Model (Server-Side Provider)
            </label>
            <select
              id="ws-ai"
              value={aiChoice}
              onChange={(e) => setAiChoice(e.target.value)}
              className="w-full max-w-md rounded-md border border-slate-200 px-2.5 py-1.5"
            >
              {availableModels.map((m) => (
                <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-900">
                Lead Scoring Weights (Total: <span className="font-mono tabular-nums">{weightSum}</span> pts)
              </div>
              <div className="text-[11px] text-slate-500">
                Default: 40 Company Fit · 25 Role Fit · 25 Signals · 10 Engagement
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <div>
                <label htmlFor="sc-comp" className="block text-[11px] text-slate-600 mb-1">
                  Company Fit
                </label>
                <input
                  id="sc-comp"
                  type="number"
                  value={scoring.companyFitMax}
                  onChange={(e) =>
                    setScoring({ ...scoring, companyFitMax: Number(e.target.value) })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="sc-role" className="block text-[11px] text-slate-600 mb-1">
                  Role Fit
                </label>
                <input
                  id="sc-role"
                  type="number"
                  value={scoring.roleFitMax}
                  onChange={(e) =>
                    setScoring({ ...scoring, roleFitMax: Number(e.target.value) })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="sc-sig" className="block text-[11px] text-slate-600 mb-1">
                  Buying Signals
                </label>
                <input
                  id="sc-sig"
                  type="number"
                  value={scoring.buyingSignalsMax}
                  onChange={(e) =>
                    setScoring({ ...scoring, buyingSignalsMax: Number(e.target.value) })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="sc-eng" className="block text-[11px] text-slate-600 mb-1">
                  Engagement
                </label>
                <input
                  id="sc-eng"
                  type="number"
                  value={scoring.engagementMax}
                  onChange={(e) =>
                    setScoring({ ...scoring, engagementMax: Number(e.target.value) })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="sc-qual" className="block text-[11px] text-slate-600 mb-1">
                  Qualified &ge;
                </label>
                <input
                  id="sc-qual"
                  type="number"
                  value={scoring.qualifiedThreshold}
                  onChange={(e) =>
                    setScoring({ ...scoring, qualifiedThreshold: Number(e.target.value) })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="sc-rev" className="block text-[11px] text-slate-600 mb-1">
                  Needs Review &ge;
                </label>
                <input
                  id="sc-rev"
                  type="number"
                  value={scoring.reviewThreshold}
                  onChange={(e) =>
                    setScoring({ ...scoring, reviewThreshold: Number(e.target.value) })
                  }
                  className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono tabular-nums"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Territories, Products & Custom Fields */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Territory Routing Rules ({workspace.territories.length})
            </h2>
            <div className="divide-y divide-slate-100">
              {workspace.territories.map((t) => (
                <div key={t.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{t.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Cities/Regions: {t.citiesOrRegions.join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-teal-800">{t.ownerName}</div>
                    <div className="font-mono text-[10px] text-slate-400">{t.ownerEmail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Products &amp; Custom Fields
            </h2>
            <div className="space-y-2 border-b border-slate-100 pb-3">
              {workspace.products.map((p) => (
                <div key={p.id}>
                  <div className="font-semibold text-slate-900">{p.name}</div>
                  <p className="text-[11px] text-slate-600">{p.valueProp}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-700">
                Custom Lead Fields ({workspace.customFields.length})
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                {workspace.customFields.map((cf) => (
                  <span key={cf.id} className="font-mono">
                    {cf.label} ({cf.key})
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddCustomField} className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add custom field (e.g. Monthly Packaging Volume)"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Suppression List */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Suppression &amp; Opt-Out Rules ({workspace.suppressions.length})
          </h2>
          <p className="text-[11px] text-slate-500">
            Applied automatically across imports, saved lists, prospect drafts, and outreach sequences.
          </p>
          <form onSubmit={handleAddSuppression} className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="email@company.com or @domain.com"
              value={newSuppression}
              onChange={(e) => setNewSuppression(e.target.value)}
              className="flex-1 min-w-[220px] rounded border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
            />
            <select
              value={newSuppressionReason}
              onChange={(e) => setNewSuppressionReason(e.target.value as typeof newSuppressionReason)}
              className="rounded border border-slate-200 px-2.5 py-1.5 text-xs"
            >
              <option value="opt_out">Opt-out</option>
              <option value="customer">Existing Customer</option>
              <option value="permanent_bounce">Permanent Bounce</option>
              <option value="do_not_contact">Do Not Contact</option>
            </select>
            <button
              type="submit"
              className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Add Suppression
            </button>
          </form>
          <div className="divide-y divide-slate-100">
            {workspace.suppressions.map((s) => (
              <div key={s.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono font-medium text-slate-900">{s.pattern}</span>{' '}
                  <span className="text-slate-500">· {s.reason} · {s.createdAt}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSuppression(s.id)}
                  aria-label={`Remove suppression ${s.pattern}`}
                  className="p-1 text-slate-400 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Audit Event Log */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Workspace Activity &amp; Audit Log ({auditEvents.length})
          </h2>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {auditEvents.map((ev) => (
              <div key={ev.id} className="py-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-800 capitalize">{ev.category}</span> ·{' '}
                  <span className="text-slate-700">{ev.summary}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {ev.createdAt.replace('T', ' ').slice(0, 19)} UTC
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
