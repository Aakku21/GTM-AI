import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  ExternalLink,
  RefreshCw,
  Plug,
  Cpu,
  Globe,
  Copy,
  Check,
  Terminal,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ConnectorProtocol,
  IntegrationArea,
  IntegrationConnection,
  McpToolDefinition,
  McpTransport,
  Workspace,
} from '../types/gtm';
import {
  findWorkspaceConnectionForCatalogTool,
  GTM_TOOL_CATALOG,
  type GtmCatalogTool,
} from '../lib/gtmToolCatalog';
import { GtmStackRecommender } from './GtmStackRecommender';
import { GtmToolCatalogSection } from './GtmToolCatalogSection';

export interface ConnectToolPayload {
  protocol: ConnectorProtocol;
  name: string;
  description?: string;
  // Plugin
  packageId?: string;
  version?: string;
  category?: IntegrationArea;
  capabilities?: string[];
  // MCP
  transport?: McpTransport;
  endpointUrl?: string;
  command?: string;
  authMode?: 'none' | 'bearer_env' | 'header_env' | 'oauth';
  envVarName?: string;
  discoveredTools?: McpToolDefinition[];
  // API
  baseUrl?: string;
  authType?: 'signed_webhook' | 'bearer' | 'api_key' | 'oauth' | 'none';
  operations?: string[];
}

export interface McpProbeResponse {
  ok: boolean;
  liveVerified: boolean;
  protocolVersion: string;
  latencyMs: number;
  tools: McpToolDefinition[];
  message: string;
}

interface IntegrationsViewProps {
  workspace: Workspace;
  integrations: IntegrationConnection[];
  connectedToolCount: number;
  onIntegrationAction: (
    integrationId: string,
    action: 'connect' | 'disconnect' | 'reconnect' | 'test' | 'add_mailbox',
    extra?: { email?: string; label?: string }
  ) => Promise<{ ok: boolean; message: string }>;
  onConnectTool: (
    payload: ConnectToolPayload
  ) => Promise<{ ok: boolean; message: string }>;
  onProbeMcp: (payload: {
    transport: McpTransport;
    endpointUrl?: string;
    command?: string;
    authMode?: 'none' | 'bearer_env' | 'header_env' | 'oauth';
    envVarName?: string;
    declaredTools?: McpToolDefinition[];
  }) => Promise<McpProbeResponse>;
}

const EXTENDED_AREAS: IntegrationArea[] = [
  'MCP Servers',
  'Prospect data & enrichment',
  'Intent & buying signals',
  'Social & inbound',
  'First-party marketing',
  'CRM & sales handoff',
  'Engagement & automation',
  'AI research & call intelligence',
  'Databases & analytics',
  'Custom REST / Webhook',
];

const CURATED_PLUGINS: Array<{
  name: string;
  packageId: string;
  version: string;
  category: IntegrationArea;
  description: string;
  capabilities: string[];
  envVarName: string;
}> = [
  {
    name: 'Claygent Waterfall Plugin',
    packageId: '@gtm-plugins/claygent-waterfall',
    version: '2.4.0',
    category: 'Prospect data & enrichment',
    description:
      'Runs 150+ provider waterfall enrichment and AI account research inside lead runs.',
    capabilities: ['waterfall_enrich', 'company_research', 'find_verified_email'],
    envVarName: 'CLAY_API_KEY',
  },
  {
    name: 'Firecrawl Markdown Scraper',
    packageId: '@gtm-plugins/firecrawl-signals',
    version: '1.8.2',
    category: 'Social & inbound',
    description:
      'Converts company careers pages and press releases into clean markdown for buying-signal detection.',
    capabilities: ['scrape_careers_page', 'extract_hiring_signals', 'markdown_snapshot'],
    envVarName: 'FIRECRAWL_API_KEY',
  },
  {
    name: 'Apify Web Actors Plugin',
    packageId: '@gtm-plugins/apify-actors',
    version: '1.5.0',
    category: 'Social & inbound',
    description:
      'Executes cloud directory and trade-show scrapers with structured JSON output.',
    capabilities: ['run_directory_actor', 'extract_exhibitor_list'],
    envVarName: 'APIFY_TOKEN',
  },
  {
    name: 'n8n Workflow Bridge Plugin',
    packageId: '@gtm-plugins/n8n-orchestrator',
    version: '2.1.0',
    category: 'Engagement & automation',
    description:
      'Triggers multi-branch n8n workflows when leads cross qualification thresholds.',
    capabilities: ['trigger_n8n_webhook', 'route_sales_handoff'],
    envVarName: 'N8N_WEBHOOK_TOKEN',
  },
];

const MCP_PRESETS: Array<{
  id: string;
  label: string;
  name: string;
  transport: McpTransport;
  endpointUrl: string;
  command: string;
  authMode: 'none' | 'bearer_env' | 'header_env' | 'oauth';
  envVarName: string;
  description: string;
  declaredTools: McpToolDefinition[];
}> = [
  {
    id: 'local_live',
    label: 'SignalStack Local MCP (Live)',
    name: 'SignalStack Built-in MCP',
    transport: 'streamable_http',
    endpointUrl: 'http://localhost:3000/api/mcp',
    command: '',
    authMode: 'none',
    envVarName: '',
    description:
      'Live local JSON-RPC 2.0 MCP server exposing workspace leads, campaigns, and connected tool manifests.',
    declaredTools: [],
  },
  {
    id: 'hubspot_mcp',
    label: 'HubSpot CRM MCP',
    name: 'HubSpot CRM MCP Server',
    transport: 'streamable_http',
    endpointUrl: 'https://mcp.hubspot.example/v1/mcp',
    command: '',
    authMode: 'bearer_env',
    envVarName: 'HUBSPOT_MCP_TOKEN',
    description:
      'Model Context Protocol server for account suppression checks, contact upserts, and deal stage sync.',
    declaredTools: [
      { name: 'hubspot_search_companies', description: 'Check existing customers and lifecycle stages.' },
      { name: 'hubspot_upsert_contact', description: 'Create or update CRM contact with owner routing.' },
    ],
  },
  {
    id: 'firecrawl_mcp',
    label: 'Firecrawl Signals MCP',
    name: 'Firecrawl MCP Server',
    transport: 'sse',
    endpointUrl: 'https://mcp.firecrawl.example/sse',
    command: '',
    authMode: 'header_env',
    envVarName: 'FIRECRAWL_API_KEY',
    description:
      'SSE MCP server for live website scraping, careers page monitoring, and LLM-ready markdown.',
    declaredTools: [
      { name: 'firecrawl_scrape', description: 'Scrape a target URL into structured markdown.' },
      { name: 'firecrawl_crawl_careers', description: 'Inspect hiring notices published in the last 90 days.' },
    ],
  },
  {
    id: 'stdio_mcp',
    label: 'Local Stdio MCP',
    name: 'Postgres Warehouse MCP (stdio)',
    transport: 'stdio',
    endpointUrl: '',
    command: 'npx -y @modelcontextprotocol/server-postgres',
    authMode: 'none',
    envVarName: 'WAREHOUSE_DATABASE_URL',
    description:
      'Local stdio MCP server for read-only SQL warehouse enrichment and customer exclusion queries.',
    declaredTools: [
      { name: 'query_customer_accounts', description: 'Query active billing accounts for suppression.' },
      { name: 'fetch_territory_owners', description: 'Look up city/region sales rep ownership.' },
    ],
  },
];

function inferProtocol(conn: IntegrationConnection): ConnectorProtocol {
  if (conn.protocol) return conn.protocol;
  if (conn.mcpConfig || conn.area === 'MCP Servers') return 'mcp';
  if (conn.customConfig || conn.area === 'Custom REST / Webhook') return 'api';
  return 'plugin';
}

function protocolLabel(conn: IntegrationConnection): string {
  const proto = inferProtocol(conn);
  if (proto === 'mcp') {
    const t = conn.mcpConfig?.transport ?? 'streamable_http';
    return t === 'streamable_http'
      ? 'MCP · Streamable HTTP'
      : t === 'sse'
      ? 'MCP · SSE'
      : 'MCP · stdio';
  }
  if (proto === 'api') return 'REST / Webhook API';
  return 'Plugin';
}

export function IntegrationsView({
  workspace,
  integrations,
  connectedToolCount,
  onIntegrationAction,
  onConnectTool,
  onProbeMcp,
}: IntegrationsViewProps) {
  const [protocolFilter, setProtocolFilter] = useState<'catalog' | 'all' | ConnectorProtocol>('catalog');
  const [feedbackMap, setFeedbackMap] = useState<
    Record<string, { ok: boolean; text: string }>
  >({});
  const [bannerFeedback, setBannerFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  const [mailboxEmail, setMailboxEmail] = useState('');
  const [addingMailboxFor, setAddingMailboxFor] = useState<string | null>(null);

  // Connect Tool drawer / panel state
  const [showConnectPanel, setShowConnectPanel] = useState(false);
  const [connectTab, setConnectTab] = useState<ConnectorProtocol>('mcp');
  const [submitting, setSubmitting] = useState(false);

  // Plugin form state
  const [pluginName, setPluginName] = useState('');
  const [pluginPkg, setPluginPkg] = useState('');
  const [pluginCategory, setPluginCategory] = useState<IntegrationArea>(
    'Prospect data & enrichment'
  );
  const [pluginCaps, setPluginCaps] = useState('enrich_company, verify_work_email');
  const [pluginEnvVar, setPluginEnvVar] = useState('');

  // MCP form state
  const [mcpName, setMcpName] = useState('SignalStack Built-in MCP');
  const [mcpTransport, setMcpTransport] = useState<McpTransport>('streamable_http');
  const [mcpEndpoint, setMcpEndpoint] = useState('http://localhost:3000/api/mcp');
  const [mcpCommand, setMcpCommand] = useState('');
  const [mcpAuthMode, setMcpAuthMode] = useState<
    'none' | 'bearer_env' | 'header_env' | 'oauth'
  >('none');
  const [mcpEnvVar, setMcpEnvVar] = useState('');
  const [mcpDesc, setMcpDesc] = useState(
    'Live local JSON-RPC 2.0 MCP server exposing workspace leads, campaigns, and connected tool manifests.'
  );
  const [mcpProbing, setMcpProbing] = useState(false);
  const [mcpProbeResult, setMcpProbeResult] = useState<McpProbeResponse | null>(null);
  const [mcpDeclaredTools, setMcpDeclaredTools] = useState<McpToolDefinition[]>([]);

  // REST / Webhook API form state
  const [apiName, setApiName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiAuth, setApiAuth] = useState<
    'signed_webhook' | 'bearer' | 'api_key' | 'oauth' | 'none'
  >('signed_webhook');
  const [apiEnvVar, setApiEnvVar] = useState('');
  const [apiOps, setApiOps] = useState('GET /accounts/exclusions, POST /leads/upsert');

  const countsByProtocol = useMemo(() => {
    let plugin = 0;
    let mcp = 0;
    let api = 0;
    for (const item of integrations) {
      const p = inferProtocol(item);
      if (p === 'mcp') mcp += 1;
      else if (p === 'api') api += 1;
      else plugin += 1;
    }
    return { all: integrations.length, plugin, mcp, api };
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    if (protocolFilter === 'all' || protocolFilter === 'catalog') return integrations;
    return integrations.filter((item) => inferProtocol(item) === protocolFilter);
  }, [integrations, protocolFilter]);

  const coreIntegrations = filteredIntegrations.filter((i) => i.isCore);
  const extendedIntegrations = filteredIntegrations.filter((i) => !i.isCore);

  const handleConnectCatalogTool = async (
    tool: GtmCatalogTool
  ): Promise<{ ok: boolean; message: string }> => {
    const existing = findWorkspaceConnectionForCatalogTool(tool, integrations);
    if (existing) {
      const res = await onIntegrationAction(existing.id, 'connect');
      setBannerFeedback({ ok: res.ok, text: res.message });
      return res;
    }

    const payload: ConnectToolPayload =
      tool.protocol === 'mcp'
        ? {
            protocol: 'mcp',
            name: tool.name,
            description: tool.description,
            transport: 'streamable_http',
            endpointUrl: tool.mcpEndpointUrl || `https://mcp.${tool.id}.example/v1/mcp`,
            authMode: 'bearer_env',
            envVarName: tool.envVarName,
            discoveredTools: tool.capabilities.map((cap) => ({
              name: cap,
              description: `${tool.name} MCP action (${cap}).`,
            })),
          }
        : tool.protocol === 'api'
        ? {
            protocol: 'api',
            name: tool.name,
            description: tool.description,
            baseUrl: tool.apiBaseUrl || `https://api.${tool.id}.example/v1`,
            authType: 'bearer',
            envVarName: tool.envVarName,
            operations: tool.capabilities,
          }
        : {
            protocol: 'plugin',
            name: tool.name,
            description: tool.description,
            packageId: tool.packageId || `@gtm-plugins/${tool.id}`,
            version: '1.0.0',
            category: tool.area,
            capabilities: tool.capabilities,
            envVarName: tool.envVarName,
          };

    const res = await onConnectTool(payload);
    setBannerFeedback({ ok: res.ok, text: res.message });
    return res;
  };

  const handleConnectStack = async (tools: GtmCatalogTool[]) => {
    const connectedNames: string[] = [];
    for (const tool of tools) {
      const res = await handleConnectCatalogTool(tool);
      if (res.ok) connectedNames.push(tool.name);
    }
    if (connectedNames.length > 0) {
      setBannerFeedback({
        ok: true,
        text: `Connected recommended starter stack: ${connectedNames.join(', ')}.`,
      });
    }
  };

  const localMcpUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/mcp`
      : 'http://localhost:3000/api/mcp';

  const runAction = async (
    id: string,
    action: 'connect' | 'disconnect' | 'reconnect' | 'test' | 'add_mailbox',
    extra?: { email?: string; label?: string }
  ) => {
    const res = await onIntegrationAction(id, action, extra);
    setFeedbackMap((prev) => ({ ...prev, [id]: { ok: res.ok, text: res.message } }));
    return res;
  };

  const applyMcpPreset = (presetId: string) => {
    const preset = MCP_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setMcpName(preset.name);
    setMcpTransport(preset.transport);
    setMcpEndpoint(preset.id === 'local_live' ? localMcpUrl : preset.endpointUrl);
    setMcpCommand(preset.command);
    setMcpAuthMode(preset.authMode);
    setMcpEnvVar(preset.envVarName);
    setMcpDesc(preset.description);
    setMcpDeclaredTools(preset.declaredTools);
    setMcpProbeResult(null);
  };

  const handleProbeMcp = async () => {
    setMcpProbing(true);
    setMcpProbeResult(null);
    try {
      const res = await onProbeMcp({
        transport: mcpTransport,
        endpointUrl: mcpTransport === 'stdio' ? undefined : mcpEndpoint,
        command: mcpTransport === 'stdio' ? mcpCommand : undefined,
        authMode: mcpAuthMode,
        envVarName: mcpEnvVar.trim() || undefined,
        declaredTools: mcpDeclaredTools,
      });
      setMcpProbeResult(res);
      if (res.tools.length > 0) {
        setMcpDeclaredTools(res.tools);
      }
    } finally {
      setMcpProbing(false);
    }
  };

  const handleQuickTestBuiltInMcp = async () => {
    const res = await onProbeMcp({
      transport: 'streamable_http',
      endpointUrl: localMcpUrl,
      authMode: 'none',
    });
    setBannerFeedback({
      ok: res.ok,
      text: `${res.message} Tools: ${res.tools.map((t) => t.name).join(', ')}`,
    });
  };

  const handleInstallCuratedPlugin = async (
    preset: (typeof CURATED_PLUGINS)[number]
  ) => {
    setSubmitting(true);
    try {
      const res = await onConnectTool({
        protocol: 'plugin',
        name: preset.name,
        description: preset.description,
        packageId: preset.packageId,
        version: preset.version,
        category: preset.category,
        capabilities: preset.capabilities,
        envVarName: preset.envVarName,
      });
      setBannerFeedback({ ok: res.ok, text: res.message });
      if (res.ok) {
        setShowConnectPanel(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pluginName.trim()) return;
    setSubmitting(true);
    try {
      const res = await onConnectTool({
        protocol: 'plugin',
        name: pluginName.trim(),
        packageId: pluginPkg.trim() || undefined,
        category: pluginCategory,
        capabilities: pluginCaps
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        envVarName: pluginEnvVar.trim() || undefined,
      });
      setBannerFeedback({ ok: res.ok, text: res.message });
      if (res.ok) {
        setPluginName('');
        setPluginPkg('');
        setPluginEnvVar('');
        setShowConnectPanel(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcpName.trim()) return;
    if (mcpTransport === 'stdio' && !mcpCommand.trim()) return;
    if (mcpTransport !== 'stdio' && !mcpEndpoint.trim()) return;
    setSubmitting(true);
    try {
      const res = await onConnectTool({
        protocol: 'mcp',
        name: mcpName.trim(),
        description: mcpDesc.trim() || undefined,
        transport: mcpTransport,
        endpointUrl: mcpTransport === 'stdio' ? undefined : mcpEndpoint.trim(),
        command: mcpTransport === 'stdio' ? mcpCommand.trim() : undefined,
        authMode: mcpAuthMode,
        envVarName: mcpEnvVar.trim() || undefined,
        discoveredTools:
          mcpProbeResult?.tools && mcpProbeResult.tools.length > 0
            ? mcpProbeResult.tools
            : mcpDeclaredTools,
      });
      setBannerFeedback({ ok: res.ok, text: res.message });
      if (res.ok) {
        setShowConnectPanel(false);
        setProtocolFilter('all');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiName.trim() || !apiUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await onConnectTool({
        protocol: 'api',
        name: apiName.trim(),
        baseUrl: apiUrl.trim(),
        authType: apiAuth,
        envVarName: apiEnvVar.trim() || undefined,
        operations: apiOps
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setBannerFeedback({ ok: res.ok, text: res.message });
      if (res.ok) {
        setApiName('');
        setApiUrl('');
        setApiEnvVar('');
        setShowConnectPanel(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderCard = (conn: IntegrationConnection) => {
    const fb = feedbackMap[conn.id];
    const isConnected = conn.status === 'connected';
    const isApprovalReq = conn.status === 'approval_required';
    const envRef =
      conn.mcpConfig?.envVarName ||
      conn.pluginConfig?.envVarName ||
      conn.customConfig?.envVarName;

    return (
      <div
        key={conn.id}
        className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3"
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {protocolLabel(conn)}
              </div>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-900 truncate">
                {conn.name}
              </h3>
              <div className="mt-0.5 text-[11px] text-slate-500">
                Owner: {conn.owner}
                {conn.lastSuccessfulRun && (
                  <> · Checked {conn.lastSuccessfulRun.slice(0, 10)}</>
                )}
              </div>
            </div>
            <span
              className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                isConnected
                  ? 'text-[#0B6B4E]'
                  : isApprovalReq
                  ? 'text-amber-700'
                  : 'text-slate-500'
              }`}
            >
              {isConnected
                ? 'Connected'
                : isApprovalReq
                ? 'Approval Required'
                : 'Disconnected'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">{conn.description}</p>

          {conn.mcpConfig && (
            <div className="rounded-lg bg-[#F6F7F6] border border-slate-200 px-3 py-2 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-slate-700 font-medium">
                <span className="truncate font-mono text-[10px]">
                  {conn.mcpConfig.endpointUrl || conn.mcpConfig.command}
                </span>
                {conn.mcpConfig.protocolVersion && (
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">
                    v{conn.mcpConfig.protocolVersion}
                  </span>
                )}
              </div>
              {conn.mcpConfig.discoveredTools.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-200/80">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    MCP Tools ({conn.mcpConfig.discoveredTools.length})
                  </div>
                  {conn.mcpConfig.discoveredTools.map((tool) => (
                    <div key={tool.name} className="text-[11px] text-slate-700">
                      <span className="font-mono font-semibold text-[#0B6B4E]">
                        {tool.name}
                      </span>
                      <span className="text-slate-500"> — {tool.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {conn.pluginConfig && (
            <div className="text-[11px] text-slate-500 font-mono truncate">
              Package: {conn.pluginConfig.packageId}@{conn.pluginConfig.version}
            </div>
          )}

          {conn.customConfig && (
            <div className="text-[11px] text-slate-500 font-mono truncate">
              Endpoint: {conn.customConfig.baseUrl}
            </div>
          )}

          {envRef && (
            <div className="text-[11px] text-slate-500">
              Secret ref:{' '}
              <span className="font-mono text-slate-700">process.env.{envRef}</span>
            </div>
          )}

          <div className="text-[11px] text-slate-500">
            <span className="font-medium text-slate-700">Allowed actions:</span>{' '}
            <span className="font-mono">{conn.allowedActions.join(', ')}</span>
          </div>

          {conn.creditsRemaining !== null && conn.creditLimit !== null && (
            <div className="text-[11px] text-slate-600 font-mono tabular-nums">
              Credits: {conn.creditsRemaining} / {conn.creditLimit} remaining
            </div>
          )}

          {conn.mailboxes.length > 0 && (
            <div className="rounded-lg bg-[#F6F7F6] border border-slate-200 px-3 py-2 text-[11px] space-y-1">
              <div className="font-semibold text-slate-700">
                Connected Mailboxes ({conn.mailboxes.length} — counted as 1 {conn.name}{' '}
                tool)
              </div>
              {conn.mailboxes.map((mb) => (
                <div
                  key={mb.id}
                  className="flex items-center justify-between text-slate-600"
                >
                  <span className="font-mono truncate">{mb.email}</span>
                  <span className="font-mono tabular-nums shrink-0 ml-2">
                    {mb.sentToday}/{mb.dailyLimit} today
                  </span>
                </div>
              ))}
            </div>
          )}

          {conn.missingApprovalNote && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{conn.missingApprovalNote}</span>
            </div>
          )}

          {fb && (
            <div
              className={`rounded-lg px-2.5 py-2 text-[11px] ${
                fb.ok
                  ? 'bg-[#E3F7EC] text-[#0B6B4E] border border-[#0B6B4E]/20'
                  : 'bg-red-50 text-red-900 border border-red-200'
              }`}
            >
              {fb.text}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2.5 border-t border-slate-100">
          {addingMailboxFor === conn.id && (
            <div className="flex gap-1.5">
              <input
                type="email"
                placeholder="teammate@company.com"
                value={mailboxEmail}
                onChange={(e) => setMailboxEmail(e.target.value)}
                className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  await runAction(conn.id, 'add_mailbox', {
                    email: mailboxEmail,
                    label: mailboxEmail.split('@')[0],
                  });
                  setMailboxEmail('');
                  setAddingMailboxFor(null);
                }}
                className="rounded-md bg-[#0B6B4E] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#085840]"
              >
                Add
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {!isConnected ? (
                <button
                  type="button"
                  onClick={() => runAction(conn.id, 'connect')}
                  className="rounded-md bg-[#0B6B4E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#085840]"
                >
                  Connect
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => runAction(conn.id, 'test')}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Test</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(conn.id, 'reconnect')}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Reconnect
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(conn.id, 'disconnect')}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                </>
              )}

              {(conn.providerId === 'gmail' || conn.providerId === 'outlook') &&
                isConnected && (
                  <button
                    type="button"
                    onClick={() =>
                      setAddingMailboxFor((cur) => (cur === conn.id ? null : conn.id))
                    }
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-[#0B6B4E] hover:bg-[#E3F7EC]/60"
                  >
                    + Add Mailbox
                  </button>
                )}
            </div>

            {conn.docsUrl && (
              <a
                href={conn.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-[#0B6B4E]"
              >
                <span>API Docs</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white px-4 sm:px-6 lg:px-8 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-xl font-bold text-slate-950">
              Integrations: Plugins, MCP Servers &amp; APIs
            </h1>
            <p className="text-xs text-slate-600 max-w-3xl">
              Workspace:{' '}
              <span className="font-semibold text-slate-800">{workspace.name}</span> ·{' '}
              <span className="font-mono font-semibold text-[#0B6B4E] tabular-nums">
                {connectedToolCount} connected tools
              </span>
              . Connect external GTM tools via first-party Plugins, Model Context Protocol
              (MCP) servers, or custom REST / Webhook APIs. Secrets stay in server
              environment variables — never stored as plaintext in the browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowConnectPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B6B4E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#085840] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect Tool</span>
          </button>
        </div>

        {/* Built-in MCP Server Exposure Strip */}
        <div className="rounded-xl border border-slate-200 bg-[#F6F7F6] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#0B6B4E] shrink-0" />
              <span className="text-xs font-semibold text-slate-900">
                Built-in MCP Server Endpoint (Streamable HTTP · JSON-RPC 2.0)
              </span>
            </div>
            <div className="text-[11px] text-slate-600">
              Connect Claude Desktop, Cursor, n8n, or internal agents directly to{' '}
              <code className="font-mono font-semibold text-slate-900 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                POST {localMcpUrl}
              </code>{' '}
              — exposes{' '}
              <span className="font-mono text-slate-800">
                search_gtm_leads, list_workspace_campaigns, get_connected_tools
              </span>
              .
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(localMcpUrl).catch(() => {});
                setCopiedEndpoint(true);
                setTimeout(() => setCopiedEndpoint(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {copiedEndpoint ? (
                <Check className="h-3.5 w-3.5 text-[#0B6B4E]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedEndpoint ? 'Copied' : 'Copy URL'}</span>
            </button>
            <button
              type="button"
              onClick={handleQuickTestBuiltInMcp}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#0B6B4E]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0B6B4E] hover:bg-[#E3F7EC]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Test /api/mcp</span>
            </button>
          </div>
        </div>

        {bannerFeedback && (
          <div
            className={`flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-xs border ${
              bannerFeedback.ok
                ? 'bg-[#E3F7EC] text-[#0B6B4E] border-[#0B6B4E]/20'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}
          >
            <span>{bannerFeedback.text}</span>
            <button
              type="button"
              onClick={() => setBannerFeedback(null)}
              aria-label="Dismiss notification"
              className="opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Unified Connect Tool Panel: Plugin | MCP Server | REST / Webhook API */}
        {showConnectPanel && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#F6F7F6] px-5 py-3">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-950">
                  Connect External GTM Tool
                </h2>
                <p className="text-[11px] text-slate-600">
                  Choose a connector protocol: install a Plugin, attach an MCP Server, or
                  register a direct REST / Webhook API.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectPanel(false)}
                aria-label="Close connect tool panel"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Protocol Tabs */}
            <div
              role="tablist"
              aria-label="Connector protocol"
              className="flex border-b border-slate-200 px-5 gap-6 bg-white"
            >
              {(
                [
                  { id: 'plugin', label: 'Plugin', icon: Plug },
                  { id: 'mcp', label: 'MCP Server', icon: Cpu },
                  { id: 'api', label: 'REST / Webhook API', icon: Globe },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = connectTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setConnectTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-colors ${
                      active
                        ? 'border-[#0B6B4E] text-[#0B6B4E]'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {/* TAB 1: PLUGINS */}
              {connectTab === 'plugin' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Quick-Install GTM Engineering Plugins
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {CURATED_PLUGINS.map((preset) => (
                        <div
                          key={preset.packageId}
                          className="rounded-lg border border-slate-200 bg-[#F6F7F6]/60 p-3.5 flex flex-col justify-between gap-2.5"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {preset.name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                v{preset.version}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              {preset.description}
                            </p>
                            <div className="text-[10px] font-mono text-slate-500">
                              {preset.packageId} · env: {preset.envVarName}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-[10px] font-mono text-slate-600 truncate">
                              {preset.capabilities.join(', ')}
                            </span>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleInstallCuratedPlugin(preset)}
                              className="shrink-0 rounded-md bg-[#0B6B4E] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#085840] disabled:opacity-50"
                            >
                              Install Plugin
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form
                    onSubmit={handleSubmitPlugin}
                    className="border-t border-slate-200 pt-4 space-y-3 text-xs"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Or Register Custom Plugin Manifest
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor="plugin-name"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Plugin Name
                        </label>
                        <input
                          id="plugin-name"
                          required
                          value={pluginName}
                          onChange={(e) => setPluginName(e.target.value)}
                          placeholder="ZoomInfo Intent Plugin"
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="plugin-pkg"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Package ID
                        </label>
                        <input
                          id="plugin-pkg"
                          value={pluginPkg}
                          onChange={(e) => setPluginPkg(e.target.value)}
                          placeholder="@gtm-plugins/zoominfo-intent"
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="plugin-cat"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Workspace Category
                        </label>
                        <select
                          id="plugin-cat"
                          value={pluginCategory}
                          onChange={(e) =>
                            setPluginCategory(e.target.value as IntegrationArea)
                          }
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
                        >
                          {EXTENDED_AREAS.filter((a) => a !== 'MCP Servers').map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="plugin-caps"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Capabilities (comma-separated)
                        </label>
                        <input
                          id="plugin-caps"
                          value={pluginCaps}
                          onChange={(e) => setPluginCaps(e.target.value)}
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="plugin-env"
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Server Env Var Name (optional secret reference)
                        </label>
                        <input
                          id="plugin-env"
                          value={pluginEnvVar}
                          onChange={(e) => setPluginEnvVar(e.target.value)}
                          placeholder="ZOOMINFO_API_KEY"
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-md bg-[#0B6B4E] px-3.5 py-1.5 font-semibold text-white hover:bg-[#085840] disabled:opacity-50"
                      >
                        Register Plugin
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: MCP SERVER */}
              {connectTab === 'mcp' && (
                <form onSubmit={handleSubmitMcp} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Quick Presets
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MCP_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyMcpPreset(preset.id)}
                          className="rounded-md border border-slate-200 bg-[#F6F7F6] px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:border-[#0B6B4E] hover:text-[#0B6B4E]"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor="mcp-name"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        MCP Server Name
                      </label>
                      <input
                        id="mcp-name"
                        required
                        value={mcpName}
                        onChange={(e) => setMcpName(e.target.value)}
                        placeholder="HubSpot CRM MCP"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="mcp-transport"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        MCP Transport
                      </label>
                      <select
                        id="mcp-transport"
                        value={mcpTransport}
                        onChange={(e) => {
                          setMcpTransport(e.target.value as McpTransport);
                          setMcpProbeResult(null);
                        }}
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
                      >
                        <option value="streamable_http">Streamable HTTP (JSON-RPC 2.0)</option>
                        <option value="sse">Server-Sent Events (SSE)</option>
                        <option value="stdio">Local stdio Command</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="mcp-auth"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Authentication Mode
                      </label>
                      <select
                        id="mcp-auth"
                        value={mcpAuthMode}
                        onChange={(e) =>
                          setMcpAuthMode(e.target.value as typeof mcpAuthMode)
                        }
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
                      >
                        <option value="none">None (Local / Public MCP)</option>
                        <option value="bearer_env">Bearer Token (Server Env Var)</option>
                        <option value="header_env">X-API-Key Header (Server Env Var)</option>
                        <option value="oauth">OAuth 2.0 (Server Managed)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      {mcpTransport === 'stdio' ? (
                        <>
                          <label
                            htmlFor="mcp-cmd"
                            className="block text-[11px] font-medium text-slate-600 mb-1"
                          >
                            Stdio Launch Command
                          </label>
                          <input
                            id="mcp-cmd"
                            required
                            value={mcpCommand}
                            onChange={(e) => setMcpCommand(e.target.value)}
                            placeholder="npx -y @modelcontextprotocol/server-postgres"
                            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                          />
                        </>
                      ) : (
                        <>
                          <label
                            htmlFor="mcp-url"
                            className="block text-[11px] font-medium text-slate-600 mb-1"
                          >
                            MCP Endpoint URL
                          </label>
                          <input
                            id="mcp-url"
                            required
                            type="url"
                            value={mcpEndpoint}
                            onChange={(e) => setMcpEndpoint(e.target.value)}
                            placeholder="http://localhost:3000/api/mcp"
                            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                          />
                        </>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="mcp-env"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Server Env Var Name (secret ref)
                      </label>
                      <input
                        id="mcp-env"
                        value={mcpEnvVar}
                        onChange={(e) => setMcpEnvVar(e.target.value)}
                        placeholder="HUBSPOT_MCP_TOKEN"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="mcp-desc"
                      className="block text-[11px] font-medium text-slate-600 mb-1"
                    >
                      Description
                    </label>
                    <input
                      id="mcp-desc"
                      value={mcpDesc}
                      onChange={(e) => setMcpDesc(e.target.value)}
                      placeholder="What GTM tools or data does this MCP server provide?"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
                    />
                  </div>

                  {/* Live MCP Probe Output */}
                  {mcpProbeResult && (
                    <div
                      className={`rounded-lg border p-3.5 space-y-2 ${
                        mcpProbeResult.ok
                          ? 'bg-[#E3F7EC]/70 border-[#0B6B4E]/25 text-slate-900'
                          : 'bg-amber-50 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-xs text-[#0B6B4E]">
                          {mcpProbeResult.message}
                        </div>
                        <span className="font-mono text-[10px] text-slate-600 tabular-nums">
                          {mcpProbeResult.latencyMs}ms · MCP {mcpProbeResult.protocolVersion}
                        </span>
                      </div>
                      {mcpProbeResult.tools.length > 0 && (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 pt-1">
                          {mcpProbeResult.tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-2"
                            >
                              <div className="font-mono text-[11px] font-semibold text-[#0B6B4E]">
                                {tool.name}
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-600 leading-snug">
                                {tool.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      disabled={mcpProbing}
                      onClick={handleProbeMcp}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#0B6B4E]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B6B4E] hover:bg-[#E3F7EC] disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{mcpProbing ? 'Probing MCP...' : 'Probe MCP Tools'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowConnectPanel(false)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-md bg-[#0B6B4E] px-3.5 py-1.5 font-semibold text-white hover:bg-[#085840] disabled:opacity-50"
                      >
                        Connect MCP Server
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB 3: DIRECT REST / WEBHOOK API */}
              {connectTab === 'api' && (
                <form onSubmit={handleSubmitApi} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor="cust-name"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        API Connector Name
                      </label>
                      <input
                        id="cust-name"
                        required
                        value={apiName}
                        onChange={(e) => setApiName(e.target.value)}
                        placeholder="ERP Customer Exclusion API"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="cust-url"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Base URL / Webhook URL
                      </label>
                      <input
                        id="cust-url"
                        required
                        type="url"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://api.internal.example/v1/gtm"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="cust-auth"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Authentication Mode
                      </label>
                      <select
                        id="cust-auth"
                        value={apiAuth}
                        onChange={(e) => setApiAuth(e.target.value as typeof apiAuth)}
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5"
                      >
                        <option value="signed_webhook">HMAC Signed Webhook</option>
                        <option value="bearer">Bearer Token (Server Env Var)</option>
                        <option value="api_key">Header API Key (Server Env Var)</option>
                        <option value="oauth">OAuth 2.0 (Server Managed)</option>
                        <option value="none">None (Internal Endpoint)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="cust-ops"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Declared Operations (comma-separated)
                      </label>
                      <input
                        id="cust-ops"
                        value={apiOps}
                        onChange={(e) => setApiOps(e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="cust-env"
                        className="block text-[11px] font-medium text-slate-600 mb-1"
                      >
                        Server Env Var Name (secret reference, never raw key)
                      </label>
                      <input
                        id="cust-env"
                        value={apiEnvVar}
                        onChange={(e) => setApiEnvVar(e.target.value)}
                        placeholder="ERP_WEBHOOK_SECRET"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowConnectPanel(false)}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-md bg-[#0B6B4E] px-3.5 py-1.5 font-semibold text-white hover:bg-[#085840] disabled:opacity-50"
                    >
                      Register API Connector
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Starter Stack Recommender */}
        <GtmStackRecommender
          integrations={integrations}
          onConnectCatalogTool={handleConnectCatalogTool}
          onConnectStack={handleConnectStack}
        />

        {/* Protocol & Catalog Filter Bar */}
        <div className="flex flex-wrap items-center gap-6 border-b border-slate-200">
          {(
            [
              { id: 'catalog', label: `GTM Tool Catalog (${GTM_TOOL_CATALOG.length})` },
              { id: 'all', label: `Workspace Tools (${countsByProtocol.all})` },
              { id: 'plugin', label: `Plugins (${countsByProtocol.plugin})` },
              { id: 'mcp', label: `MCP Servers (${countsByProtocol.mcp})` },
              { id: 'api', label: `REST / Webhook APIs (${countsByProtocol.api})` },
            ] as const
          ).map((f) => {
            const active = protocolFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setProtocolFilter(f.id)}
                className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors tabular-nums ${
                  active
                    ? 'border-[#0B6B4E] text-[#0B6B4E]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {protocolFilter === 'catalog' ? (
          <GtmToolCatalogSection
            integrations={integrations}
            onConnectCatalogTool={handleConnectCatalogTool}
            onDisconnectExisting={(connId) => runAction(connId, 'disconnect')}
          />
        ) : (
          <>
            {/* Core Integrations */}
            {coreIntegrations.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0B6B4E]" />
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Core Workspace Integrations ({coreIntegrations.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {coreIntegrations.map(renderCard)}
                </div>
              </section>
            )}

            {/* Extended Connector Groups */}
            {EXTENDED_AREAS.map((area) => {
              const group = extendedIntegrations.filter((i) => i.area === area);
              if (group.length === 0) return null;
              return (
                <section key={area} className="space-y-3">
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    {area} ({group.length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.map(renderCard)}
                  </div>
                </section>
              );
            })}

            {filteredIntegrations.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-[#F6F7F6] p-8 text-center space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  No {protocolFilter === 'mcp' ? 'MCP servers' : 'custom APIs'} connected yet
                </div>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Use the Connect Tool panel above to attach an MCP server (Streamable HTTP,
                  SSE, or stdio), install a GTM plugin, or register a REST/Webhook API.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConnectTab(protocolFilter === 'all' ? 'mcp' : protocolFilter);
                    setShowConnectPanel(true);
                  }}
                  className="rounded-lg bg-[#0B6B4E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#085840]"
                >
                  Connect {protocolFilter === 'mcp' ? 'MCP Server' : 'Tool'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
