import React, { useMemo, useState } from 'react';
import { Play, AlertTriangle, Plus, ArrowUpRight } from 'lucide-react';
import type {
  Campaign,
  CampaignTemplate,
  GtmTask,
  LeadRecord,
  OutreachSequence,
} from '../types/gtm';
import { computeConversionFunnel } from '../lib/workflowEngine';

interface TasksMeasurementViewProps {
  campaigns: Campaign[];
  activeCampaign: Campaign;
  leads: LeadRecord[];
  tasks: GtmTask[];
  sequences: OutreachSequence[];
  templates: CampaignTemplate[];
  onCreateTask: (payload: { title: string; owner: string; dueDate: string }) => Promise<void>;
  onUpdateTaskStatus: (taskId: string, status: GtmTask['status']) => Promise<void>;
  onActivateSequence: (sequenceId: string, leadIds: string[]) => Promise<{ ok: boolean; message: string }>;
  onLaunchTemplate: (template: CampaignTemplate) => void;
}

export function TasksMeasurementView({
  activeCampaign,
  leads,
  tasks,
  sequences,
  templates,
  onCreateTask,
  onUpdateTaskStatus,
  onActivateSequence,
  onLaunchTemplate,
}: TasksMeasurementViewProps) {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('Rohan Kulkarni');
  const [dueDate, setDueDate] = useState('2026-11-26');
  const [seqFeedback, setSeqFeedback] = useState<Record<string, { ok: boolean; text: string }>>({});

  const funnel = useMemo(() => computeConversionFunnel(leads), [leads]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreateTask({ title: title.trim(), owner, dueDate });
    setTitle('');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mx-auto max-w-6xl space-y-6 text-xs">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Tasks, Sequences &amp; Measured Conversion Funnel
          </h1>
          <p className="mt-1 text-slate-600">
            Conversion rates are calculated strictly from observed events with explicit denominators. Automated follow-ups pause when a channel cannot report reply stop signals.
          </p>
        </div>

        {/* Observed Conversion Funnel */}
        <section
          aria-label="Measured conversion funnel"
          className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
        >
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Workspace Conversion Funnel (Observed Events)
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <div className="text-[11px] text-slate-500">Leads Found</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {funnel.found}
              </div>
              <div className="text-[11px] text-slate-500">Baseline cohort</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Qualified</div>
              <div className="mt-1 font-mono text-xl font-bold text-teal-700 tabular-nums">
                {funnel.qualified}
              </div>
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                {funnel.qualifiedRate.pct}% ({funnel.qualifiedRate.numerator}/{funnel.qualifiedRate.denominator} found)
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Contacted</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {funnel.contacted}
              </div>
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                {funnel.contactedRate.pct}% ({funnel.contactedRate.numerator}/{funnel.contactedRate.denominator} qualified)
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Replied</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {funnel.replied}
              </div>
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                {funnel.replyRate.pct}% ({funnel.replyRate.numerator}/{funnel.replyRate.denominator} contacted)
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Meetings Booked</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {funnel.meetingsBooked}
              </div>
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                {funnel.meetingRate.pct}% ({funnel.meetingRate.numerator}/{funnel.meetingRate.denominator})
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Opportunities</div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
                {funnel.opportunities}
              </div>
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                {funnel.opportunityRate.pct}% ({funnel.opportunityRate.numerator}/{funnel.opportunityRate.denominator})
              </div>
            </div>
          </div>
        </section>

        {/* Task View */}
        <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Sales Handoff &amp; Follow-Up Tasks ({tasks.length})
            </h2>
          </div>

          <form
            onSubmit={handleAddTask}
            className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3"
          >
            <input
              type="text"
              placeholder="New task description..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 min-w-[220px] rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
            />
            <input
              type="text"
              aria-label="Task owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-36 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
            />
            <input
              type="date"
              aria-label="Task due date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Task</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <div className="px-5 py-6 text-center text-slate-500">No open tasks.</div>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <div className="font-medium text-slate-900">{t.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      Owner: {t.owner} · Due: <span className="font-mono">{t.dueDate}</span>
                      {t.crmTaskId && <> · HubSpot Task: <span className="font-mono">{t.crmTaskId}</span></>}
                    </div>
                  </div>
                  <select
                    aria-label={`Status for ${t.title}`}
                    value={t.status}
                    onChange={(e) =>
                      onUpdateTaskStatus(t.id, e.target.value as GtmTask['status'])
                    }
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Outreach Sequences with Stop-Signal Guardrail */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Outreach Sequences &amp; Reply-Stop Guardrails ({sequences.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sequences.map((seq) => {
              const fb = seqFeedback[seq.id];
              return (
                <div
                  key={seq.id}
                  className="rounded-lg border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{seq.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Channel: {seq.channel} · {seq.steps.length} steps · Enrolled:{' '}
                        <span className="font-mono tabular-nums">{seq.enrolledLeadIds.length}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        seq.status === 'active'
                          ? 'text-emerald-700'
                          : seq.status === 'paused_no_reply_signal'
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {seq.status === 'paused_no_reply_signal'
                        ? 'Paused (No Reply Signal)'
                        : seq.status}
                    </span>
                  </div>

                  {!seq.replyStopSupported && (
                    <div className="flex items-start gap-1.5 rounded bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] text-amber-900">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        Automated follow-ups stay paused until a supported reply stop-signal webhook is connected for {seq.channel}.
                      </span>
                    </div>
                  )}

                  {fb && (
                    <div
                      className={`rounded px-2.5 py-2 text-[11px] ${
                        fb.ok
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {fb.text}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await onActivateSequence(seq.id, activeCampaign.leadIds);
                      setSeqFeedback((prev) => ({
                        ...prev,
                        [seq.id]: { ok: res.ok, text: res.message },
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <Play className="h-3 w-3" />
                    <span>Activate Approved Sequence</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Saved Campaign Templates */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Saved Campaign Templates
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-lg border border-slate-200 p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="text-[11px] font-medium text-teal-700 capitalize">
                    {tpl.mode} Template
                  </div>
                  <div className="mt-0.5 font-semibold text-slate-900">{tpl.name}</div>
                  <p className="mt-1 text-slate-600">{tpl.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchTemplate(tpl)}
                  className="inline-flex items-center gap-1 self-start rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                >
                  <span>Run in Chat</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
