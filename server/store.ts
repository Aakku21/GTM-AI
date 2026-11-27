import fs from 'fs';
import path from 'path';
import type {
  AuditEvent,
  Campaign,
  CampaignTemplate,
  ChatThread,
  EmailDraft,
  ExportArtifact,
  GtmTask,
  IntegrationConnection,
  LeadRecord,
  OutreachSequence,
  SavedSearch,
  WorkflowRun,
  Workspace,
  WorkspaceSnapshotPayload,
} from '../src/types/gtm';
import {
  buildInboundFranchiseFixtures,
  buildMaharashtraFixtureLeads,
  createInitialThreads,
  createSeedCampaigns,
  createSeedIntegrations,
  createSeedSavedSearches,
  createSeedSequences,
  createSeedTasks,
  createSeedTemplates,
  createSeedWorkspaces,
  DEMO_WORKSPACE_ID,
  LIVE_WORKSPACE_ID,
} from './demoFixtures';
import { countConnectedTools } from '../src/lib/workflowEngine';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'signalstack-db.json');

export interface DatabaseState {
  workspaces: Workspace[];
  integrations: IntegrationConnection[];
  campaigns: Campaign[];
  threads: ChatThread[];
  leads: LeadRecord[];
  runs: WorkflowRun[];
  exports: ExportArtifact[];
  exportFiles: Record<string, string>; // exportId -> local filePath
  drafts: EmailDraft[];
  sequences: OutreachSequence[];
  tasks: GtmTask[];
  savedSearches: SavedSearch[];
  templates: CampaignTemplate[];
  auditEvents: AuditEvent[];
}

function buildFreshDatabase(): DatabaseState {
  const workspaces = createSeedWorkspaces();
  const demoIntegrations = createSeedIntegrations(DEMO_WORKSPACE_ID, 'demo');
  const liveIntegrations = createSeedIntegrations(LIVE_WORKSPACE_ID, 'live');
  const demoCampaigns = createSeedCampaigns(DEMO_WORKSPACE_ID, 'demo');
  const liveCampaigns = createSeedCampaigns(LIVE_WORKSPACE_ID, 'live');

  const demoThreads = createInitialThreads(DEMO_WORKSPACE_ID, demoCampaigns[0].id);
  const liveThreads = createInitialThreads(LIVE_WORKSPACE_ID, liveCampaigns[0].id);

  return {
    workspaces,
    integrations: [...demoIntegrations, ...liveIntegrations],
    campaigns: [...demoCampaigns, ...liveCampaigns],
    threads: [...demoThreads, ...liveThreads],
    leads: [], // Populated on workflow runs or imports; demo fixture catalog queried dynamically!
    runs: [],
    exports: [],
    exportFiles: {},
    drafts: [],
    sequences: createSeedSequences(DEMO_WORKSPACE_ID, 'demo'),
    tasks: createSeedTasks(DEMO_WORKSPACE_ID, 'demo'),
    savedSearches: createSeedSavedSearches(DEMO_WORKSPACE_ID, 'demo'),
    templates: createSeedTemplates(),
    auditEvents: [
      {
        id: 'aud-init-1',
        workspaceId: DEMO_WORKSPACE_ID,
        actor: 'System',
        category: 'settings',
        summary: 'Initialized Demo Workspace with fictional Maharashtra packaging & retail franchise fixtures and local email preview.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'aud-init-2',
        workspaceId: LIVE_WORKSPACE_ID,
        actor: 'System',
        category: 'settings',
        summary: 'Initialized Live Workspace with 0 connected tools. Upload a spreadsheet or connect providers in Integrations.',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

class GtmStore {
  private state: DatabaseState;

  constructor() {
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseState;
        if (parsed.workspaces && parsed.workspaces.length >= 2) {
          return parsed;
        }
      }
    } catch {
      // Fall back to fresh seed state
    }
    const fresh = buildFreshDatabase();
    this.save(fresh);
    return fresh;
  }

  public save(nextState?: DatabaseState) {
    if (nextState) {
      this.state = nextState;
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch {
      // Non-fatal in read-only filesystem scenarios
    }
  }

  public reset(): DatabaseState {
    const fresh = buildFreshDatabase();
    this.save(fresh);
    return fresh;
  }

  public get db(): DatabaseState {
    return this.state;
  }

  public getWorkspace(workspaceId: string): Workspace {
    return (
      this.state.workspaces.find((w) => w.id === workspaceId) ??
      this.state.workspaces[0]
    );
  }

  public getDemoCatalogForCampaign(workspaceId: string, campaignId: string, mode: 'outbound' | 'inbound'): LeadRecord[] {
    if (mode === 'inbound') {
      return buildInboundFranchiseFixtures(workspaceId, campaignId);
    }
    return buildMaharashtraFixtureLeads(workspaceId, campaignId);
  }

  public recordAudit(
    workspaceId: string,
    actor: string,
    category: AuditEvent['category'],
    summary: string,
    metadata?: Record<string, unknown>
  ) {
    this.state.auditEvents.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspaceId,
      actor,
      category,
      summary,
      metadata,
      createdAt: new Date().toISOString(),
    });
    if (this.state.auditEvents.length > 200) {
      this.state.auditEvents.length = 200;
    }
    this.save();
  }

  public getAvailableModels(): WorkspaceSnapshotPayload['availableModels'] {
    const hasGemini = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
    const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

    return [
      {
        provider: 'gemini',
        model: 'gemini-4-hydrogen',
        label: hasGemini ? 'Gemini 4 Flash (Live)' : 'Gemini 4 Flash (Rule Fallback)',
        liveKeyConfigured: hasGemini,
      },
      {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        label: hasOpenAi ? 'OpenAI GPT-4.1 Mini (Live)' : 'OpenAI GPT-4.1 Mini (Key Needed)',
        liveKeyConfigured: hasOpenAi,
      },
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        label: hasAnthropic ? 'Claude Sonnet 4.5 (Live)' : 'Claude Sonnet 4.5 (Key Needed)',
        liveKeyConfigured: hasAnthropic,
      },
      {
        provider: 'deterministic',
        model: 'signalstack-rule-v1',
        label: 'Deterministic GTM Engine (Local)',
        liveKeyConfigured: true,
      },
    ];
  }

  public getSnapshot(workspaceId?: string): WorkspaceSnapshotPayload {
    const activeWorkspace = this.getWorkspace(workspaceId || DEMO_WORKSPACE_ID);
    const wsId = activeWorkspace.id;

    const integrations = this.state.integrations.filter((i) => i.workspaceId === wsId);
    const campaigns = this.state.campaigns.filter((c) => c.workspaceId === wsId);
    const threads = this.state.threads.filter((t) => t.workspaceId === wsId);
    const leads = this.state.leads.filter((l) => l.workspaceId === wsId);
    const runs = this.state.runs.filter((r) => r.workspaceId === wsId);
    const exportsList = this.state.exports.filter((e) => e.workspaceId === wsId);
    const drafts = this.state.drafts.filter((d) => d.workspaceId === wsId);
    const sequences = this.state.sequences.filter((s) => s.workspaceId === wsId);
    const tasks = this.state.tasks.filter((t) => t.workspaceId === wsId);
    const savedSearches = this.state.savedSearches.filter((s) => s.workspaceId === wsId);
    const auditEvents = this.state.auditEvents.filter((a) => a.workspaceId === wsId);

    return {
      workspaces: this.state.workspaces,
      activeWorkspace,
      integrations,
      connectedToolCount: countConnectedTools(integrations),
      campaigns,
      threads,
      leads,
      runs,
      exports: exportsList,
      drafts,
      sequences,
      tasks,
      savedSearches,
      templates: this.state.templates,
      auditEvents,
      availableModels: this.getAvailableModels(),
    };
  }
}

export const store = new GtmStore();
