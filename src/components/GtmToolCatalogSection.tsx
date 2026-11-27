import React, { useMemo, useState } from 'react';
import { CheckCircle2, Search, ExternalLink } from 'lucide-react';
import type { IntegrationConnection } from '../types/gtm';
import {
  findWorkspaceConnectionForCatalogTool,
  GTM_CATALOG_CATEGORIES,
  GTM_TOOL_CATALOG,
  type GtmCatalogCategory,
  type GtmCatalogTool,
} from '../lib/gtmToolCatalog';

interface GtmToolCatalogSectionProps {
  integrations: IntegrationConnection[];
  onConnectCatalogTool: (tool: GtmCatalogTool) => Promise<{ ok: boolean; message: string }>;
  onDisconnectExisting: (integrationId: string) => Promise<{ ok: boolean; message: string }>;
}

const SHORT_CATEGORY_LABELS: Record<GtmCatalogCategory, string> = {
  'Data, Scraping & Enrichment': '1. Data & Enrichment',
  'Intent & Buying Signals': '2. Intent & Signals',
  'Workflow Automation & Orchestration': '3. Automation',
  'Cold Email & Multi-Channel Outreach': '4. Outreach',
  'CRM (Customer Relationship Management)': '5. CRM',
  'AI Research & Call Intelligence': '6. AI & Call Intel',
};

export function GtmToolCatalogSection({
  integrations,
  onConnectCatalogTool,
  onDisconnectExisting,
}: GtmToolCatalogSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | GtmCatalogCategory>('all');
  const [query, setQuery] = useState('');
  const [busyToolId, setBusyToolId] = useState<string | null>(null);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GTM_TOOL_CATALOG.filter((tool) => {
      if (selectedCategory !== 'all' && tool.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        tool.capabilities.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [selectedCategory, query]);

  const categoriesToDisplay = useMemo(() => {
    return GTM_CATALOG_CATEGORIES.filter((cat) =>
      filteredTools.some((t) => t.category === cat)
    );
  }, [filteredTools]);

  const handleConnect = async (tool: GtmCatalogTool) => {
    setBusyToolId(tool.id);
    try {
      await onConnectCatalogTool(tool);
    } finally {
      setBusyToolId(null);
    }
  };

  const handleDisconnect = async (toolId: string, connId: string) => {
    setBusyToolId(toolId);
    try {
      await onDisconnectExisting(connId);
    } finally {
      setBusyToolId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Category Filters + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="GTM tool categories">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors tabular-nums ${
              selectedCategory === 'all'
                ? 'bg-[#0B6B4E] text-white'
                : 'bg-[#F6F7F6] text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            All Categories ({GTM_TOOL_CATALOG.length})
          </button>
          {GTM_CATALOG_CATEGORIES.map((cat) => {
            const count = GTM_TOOL_CATALOG.filter((t) => t.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors tabular-nums ${
                  active
                    ? 'bg-[#0B6B4E] text-white'
                    : 'bg-[#F6F7F6] text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                {SHORT_CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 33 GTM tools..."
            aria-label="Search GTM tool catalog"
            className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0B6B4E] focus:outline-none"
          />
        </div>
      </div>

      {/* Categorized Tool Grids */}
      {categoriesToDisplay.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-[#F6F7F6] p-8 text-center text-xs text-slate-600">
          No GTM tools match &ldquo;{query}&rdquo;. Clear the search filter to browse all 33 tools.
        </div>
      ) : (
        <div className="space-y-6">
          {categoriesToDisplay.map((category) => {
            const idx = GTM_CATALOG_CATEGORIES.indexOf(category) + 1;
            const items = filteredTools.filter((t) => t.category === category);
            return (
              <section key={category} className="space-y-3">
                <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <h2 className="font-display text-base font-semibold text-slate-950">
                    {idx}. {category}{' '}
                    <span className="text-xs font-normal text-slate-500 tabular-nums">
                      ({items.length})
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((tool) => {
                    const match = findWorkspaceConnectionForCatalogTool(tool, integrations);
                    const isConnected = match?.status === 'connected';
                    const isBusy = busyToolId === tool.id;
                    const protoText =
                      tool.protocol === 'mcp'
                        ? 'MCP Server'
                        : tool.protocol === 'api'
                        ? 'REST / Webhook API'
                        : 'Plugin';

                    return (
                      <div
                        key={tool.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                {protoText}
                              </div>
                              <h3 className="text-sm font-semibold text-slate-950 truncate">
                                {tool.name}
                              </h3>
                            </div>
                            {isConnected ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B6B4E] shrink-0">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Connected
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 shrink-0">
                                Available
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {tool.description}
                          </p>

                          <div className="text-[11px] text-slate-500">
                            <span className="font-medium text-slate-700">Capabilities:</span>{' '}
                            <span className="font-mono">{tool.capabilities.join(', ')}</span>
                          </div>

                          <div className="text-[10px] font-mono text-slate-500">
                            Secret ref: process.env.{tool.envVarName}
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          {isConnected && match ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDisconnect(tool.id, match.id)}
                              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {isBusy ? 'Updating...' : 'Disconnect'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleConnect(tool)}
                              className="rounded-md bg-[#0B6B4E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#085840] disabled:opacity-50"
                            >
                              {isBusy ? 'Connecting...' : `Connect ${tool.name}`}
                            </button>
                          )}

                          {tool.docsUrl && (
                            <a
                              href={tool.docsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[#0B6B4E]"
                            >
                              <span>Docs</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
