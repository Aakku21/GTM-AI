import type { McpToolDefinition, McpTransport } from '../src/types/gtm';
import { store } from './store';
import { countConnectedTools } from '../src/lib/workflowEngine';

export interface McpJsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export const BUILTIN_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'search_gtm_leads',
    description:
      'Search ranked GTM leads in a workspace filtered by city, industry, or verified email status.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        city: { type: 'string' },
        verifiedOnly: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'list_workspace_campaigns',
    description:
      'Return active outbound and inbound GTM campaigns with filter summaries and matched lead counts.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
      },
    },
  },
  {
    name: 'get_connected_tools',
    description:
      'List all connected plugins, MCP servers, and REST/Webhook APIs authorized for a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
      },
    },
  },
];

/**
 * Built-in MCP Server JSON-RPC 2.0 handler mounted at POST /api/mcp.
 * Allows external MCP clients (Claude Desktop, Cursor, n8n) or the in-app MCP prober
 * to initialize, discover tools via tools/list, and invoke tools via tools/call.
 */
export function handleBuiltInMcpRequest(body: McpJsonRpcRequest): McpJsonRpcResponse {
  const id = body.id ?? null;
  const method = body.method ?? '';

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: 'ai-gtm-engineer-mcp',
          version: '1.0.0',
        },
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: BUILTIN_MCP_TOOLS,
      },
    };
  }

  if (method === 'tools/call') {
    const params = body.params ?? {};
    const toolName = String(params.name || '');
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    const ws = store.getWorkspace(
      typeof args.workspaceId === 'string'
        ? args.workspaceId
        : store.db.workspaces[0]?.id ?? 'ws-demo'
    );

    if (toolName === 'search_gtm_leads') {
      const city = typeof args.city === 'string' ? args.city.toLowerCase() : '';
      const verifiedOnly = Boolean(args.verifiedOnly);
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
      const matched = store.db.leads
        .filter((l) => l.workspaceId === ws.id)
        .filter((l) => (!city ? true : l.companyHqCity.toLowerCase().includes(city)))
        .filter((l) => (!verifiedOnly ? true : l.emailStatus === 'valid'))
        .slice(0, limit)
        .map((l) => ({
          id: l.id,
          company: l.companyName,
          contact: l.contactName,
          title: l.contactTitle,
          city: l.companyHqCity,
          email: l.workEmail,
          emailStatus: l.emailStatus,
          score: l.scoreTotal,
        }));

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ workspace: ws.name, count: matched.length, leads: matched }, null, 2),
            },
          ],
        },
      };
    }

    if (toolName === 'list_workspace_campaigns') {
      const campaigns = store.db.campaigns
        .filter((c) => c.workspaceId === ws.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          mode: c.mode,
          status: c.status,
          leadCount: c.leadIds.length,
        }));
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ workspace: ws.name, campaigns }, null, 2) }],
        },
      };
    }

    if (toolName === 'get_connected_tools') {
      const conns = store.db.integrations.filter((i) => i.workspaceId === ws.id);
      const connected = conns
        .filter((i) => i.status === 'connected')
        .map((i) => ({
          id: i.id,
          name: i.name,
          protocol: i.protocol ?? 'plugin',
          allowedActions: i.allowedActions,
        }));
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  workspace: ws.name,
                  connectedToolCount: countConnectedTools(conns),
                  tools: connected,
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Unknown MCP tool "${toolName}".` },
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Unsupported MCP method "${method}".` },
  };
}

export interface McpProbeResult {
  ok: boolean;
  liveVerified: boolean;
  protocolVersion: string;
  latencyMs: number;
  tools: McpToolDefinition[];
  message: string;
}

/**
 * Probes an MCP server over Streamable HTTP / SSE using real JSON-RPC 2.0 initialize + tools/list.
 * For stdio commands, validates command structure and returns declared tools without spawning untrusted shells.
 */
export async function probeMcpServer(params: {
  transport: McpTransport;
  endpointUrl?: string;
  command?: string;
  envVarName?: string;
  authMode?: 'none' | 'bearer_env' | 'header_env' | 'oauth';
  declaredTools?: McpToolDefinition[];
}): Promise<McpProbeResult> {
  const start = Date.now();

  if (params.transport === 'stdio') {
    const cmd = (params.command || '').trim();
    if (!cmd) {
      return {
        ok: false,
        liveVerified: false,
        protocolVersion: '2025-03-26',
        latencyMs: Date.now() - start,
        tools: [],
        message: 'Provide a stdio command (e.g. npx -y @modelcontextprotocol/server-hubspot).',
      };
    }
    const tools =
      params.declaredTools && params.declaredTools.length > 0
        ? params.declaredTools
        : [
            {
              name: 'query_records',
              description: `Declared MCP tool via stdio process (${cmd.split(/\s+/)[0]}).`,
            },
          ];
    return {
      ok: true,
      liveVerified: false,
      protocolVersion: '2025-03-26',
      latencyMs: Date.now() - start,
      tools,
      message: `Validated stdio MCP manifest (${cmd}) with ${tools.length} declared tool(s). Run inside your local MCP host to spawn stdio workers.`,
    };
  }

  const endpoint = (params.endpointUrl || '').trim();
  if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
    return {
      ok: false,
      liveVerified: false,
      protocolVersion: '2025-03-26',
      latencyMs: Date.now() - start,
      tools: [],
      message: 'Valid http:// or https:// MCP endpoint URL is required.',
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (params.envVarName && process.env[params.envVarName]) {
    if (params.authMode === 'header_env') {
      headers['X-API-Key'] = process.env[params.envVarName]!;
    } else {
      headers.Authorization = `Bearer ${process.env[params.envVarName]}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const initResp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'ai-gtm-engineer', version: '1.0.0' },
        },
      }),
      signal: controller.signal,
    });

    if (!initResp.ok) {
      return {
        ok: false,
        liveVerified: false,
        protocolVersion: '2025-03-26',
        latencyMs: Date.now() - start,
        tools: params.declaredTools ?? [],
        message: `MCP endpoint returned HTTP ${initResp.status}. Check endpoint URL or server env secret (${params.envVarName || 'none'}).`,
      };
    }

    const initJson = (await initResp.json().catch(() => ({}))) as McpJsonRpcResponse;
    const protocolVersion =
      (initJson.result as { protocolVersion?: string } | undefined)?.protocolVersion ||
      '2025-03-26';

    const listResp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
      signal: controller.signal,
    });

    const listJson = (await listResp.json().catch(() => ({}))) as McpJsonRpcResponse;
    const rawTools = (listJson.result as { tools?: McpToolDefinition[] } | undefined)?.tools;
    const tools: McpToolDefinition[] =
      Array.isArray(rawTools) && rawTools.length > 0
        ? rawTools.map((t) => ({
            name: String(t.name || 'unnamed_tool'),
            description: String(t.description || 'MCP tool'),
            inputSchema: t.inputSchema,
          }))
        : params.declaredTools ?? [];

    return {
      ok: true,
      liveVerified: true,
      protocolVersion,
      latencyMs: Date.now() - start,
      tools,
      message: `Live MCP handshake succeeded (${protocolVersion}) — discovered ${tools.length} tool(s) in ${Date.now() - start}ms.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      liveVerified: false,
      protocolVersion: '2025-03-26',
      latencyMs: Date.now() - start,
      tools: params.declaredTools ?? [],
      message: `Could not reach MCP endpoint ${endpoint} (${reason}). Verify server is running or register with declared tools.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeCustomApiEndpoint(params: {
  baseUrl: string;
  authType?: string;
  envVarName?: string;
}): Promise<{ ok: boolean; statusCode?: number; latencyMs: number; message: string }> {
  const start = Date.now();
  const url = params.baseUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, latencyMs: 0, message: 'Endpoint URL must start with http:// or https://.' };
  }

  const headers: Record<string, string> = {};
  if (params.envVarName && process.env[params.envVarName]) {
    if (params.authType === 'api_key') {
      headers['X-API-Key'] = process.env[params.envVarName]!;
    } else if (params.authType === 'bearer') {
      headers.Authorization = `Bearer ${process.env[params.envVarName]}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const resp = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    const latencyMs = Date.now() - start;
    const reachable = resp.status < 500;
    return {
      ok: reachable,
      statusCode: resp.status,
      latencyMs,
      message: reachable
        ? `Endpoint responded HTTP ${resp.status} in ${latencyMs}ms.`
        : `Endpoint returned server error HTTP ${resp.status}.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Connection refused';
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: `Unable to reach ${url} (${reason}).`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
