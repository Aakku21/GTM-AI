import React, { useMemo, useState } from 'react';
import { Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import type { IntegrationConnection } from '../types/gtm';
import {
  findWorkspaceConnectionForCatalogTool,
  recommendStarterStack,
  type GtmCatalogTool,
  type StackBudget,
  type StackChannel,
  type StackStage,
} from '../lib/gtmToolCatalog';

interface GtmStackRecommenderProps {
  integrations: IntegrationConnection[];
  onConnectCatalogTool: (tool: GtmCatalogTool) => Promise<{ ok: boolean; message: string }>;
  onConnectStack: (tools: GtmCatalogTool[]) => Promise<void>;
}

const BUDGET_OPTIONS: Array<{ id: StackBudget; label: string }> = [
  { id: 'bootstrapped', label: 'Free / Bootstrapped' },
  { id: 'funded_enterprise', label: 'Funded / Enterprise' },
];

const CHANNEL_OPTIONS: Array<{ id: StackChannel; label: string }> = [
  { id: 'cold_email', label: 'Cold Email' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'inbound', label: 'Inbound' },
  { id: 'all', label: 'All Channels' },
];

const STAGE_OPTIONS: Array<{ id: StackStage; label: string }> = [
  { id: 'solo_founder', label: 'Solo Founder' },
  { id: 'startup', label: 'Startup' },
  { id: 'enterprise', label: 'Enterprise' },
];

export function GtmStackRecommender({
  integrations,
  onConnectCatalogTool,
  onConnectStack,
}: GtmStackRecommenderProps) {
  const [budget, setBudget] = useState<StackBudget>('bootstrapped');
  const [channel, setChannel] = useState<StackChannel>('cold_email');
  const [stage, setStage] = useState<StackStage>('startup');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectingAll, setConnectingAll] = useState(false);

  const recommendation = useMemo(
    () => recommendStarterStack({ budget, channel, stage }),
    [budget, channel, stage]
  );

  const unConnectedTools = useMemo(() => {
    return recommendation.tools
      .map((entry) => entry.tool)
      .filter((tool) => {
        const match = findWorkspaceConnectionForCatalogTool(tool, integrations);
        return match?.status !== 'connected';
      });
  }, [recommendation, integrations]);

  const handleConnectOne = async (tool: GtmCatalogTool) => {
    setConnectingId(tool.id);
    try {
      await onConnectCatalogTool(tool);
    } finally {
      setConnectingId(null);
    }
  };

  const handleConnectAll = async () => {
    if (unConnectedTools.length === 0) return;
    setConnectingAll(true);
    try {
      await onConnectStack(unConnectedTools);
    } finally {
      setConnectingAll(false);
    }
  };

  return (
    <section
      aria-label="GTM Stack Recommender"
      className="rounded-xl border border-slate-200 bg-[#F6F7F6] p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0B6B4E]" />
            <h2 className="font-display text-base font-bold text-slate-950">
              Starter Stack Recommender
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            Narrow all 33 GTM tools down to the exact 3–4 tools you need to launch based on
            budget, channel, and company stage.
          </p>
        </div>
        <button
          type="button"
          disabled={connectingAll || unConnectedTools.length === 0}
          onClick={handleConnectAll}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B6B4E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#085840] disabled:opacity-50 whitespace-nowrap"
        >
          {connectingAll ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          <span>
            {unConnectedTools.length === 0
              ? 'Recommended Stack Connected'
              : `Connect Recommended Stack (${unConnectedTools.length})`}
          </span>
        </button>
      </div>

      {/* 3 Selector Controls */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            1. Budget
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Budget">
            {BUDGET_OPTIONS.map((opt) => {
              const active = budget === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBudget(opt.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#0B6B4E] text-white'
                      : 'bg-[#F6F7F6] text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            2. Main Channel
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Main Channel">
            {CHANNEL_OPTIONS.map((opt) => {
              const active = channel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChannel(opt.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#0B6B4E] text-white'
                      : 'bg-[#F6F7F6] text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            3. Company Stage
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Company Stage">
            {STAGE_OPTIONS.map((opt) => {
              const active = stage === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStage(opt.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#0B6B4E] text-white'
                      : 'bg-[#F6F7F6] text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recommended 3–4 Tool Cards */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-900">
            {recommendation.headline}
          </h3>
          <p className="text-[11px] text-slate-600">{recommendation.summary}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recommendation.tools.map(({ tool, slotLabel, rationale }) => {
            const match = findWorkspaceConnectionForCatalogTool(tool, integrations);
            const isConnected = match?.status === 'connected';
            const isBusy = connectingId === tool.id || connectingAll;

            return (
              <div
                key={tool.id}
                className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0B6B4E]">
                      {slotLabel}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-slate-400">
                      {tool.protocol}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-950">{tool.name}</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{rationale}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-slate-500 truncate">
                    {tool.envVarName}
                  </span>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B6B4E] shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Connected
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleConnectOne(tool)}
                      className="rounded-md border border-[#0B6B4E]/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0B6B4E] hover:bg-[#E3F7EC] disabled:opacity-50 shrink-0"
                    >
                      {isBusy ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
