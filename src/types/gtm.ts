export type WorkspaceMode = 'demo' | 'live';
export type CampaignMode = 'outbound' | 'inbound';
export type EmailVerificationStatus = 'valid' | 'invalid' | 'accept-all' | 'unknown';
export type QualificationLabel = 'Qualified' | 'Needs review' | 'Disqualified';
export type ExportFormat = 'xlsx' | 'csv' | 'json' | 'parquet' | 'pdf' | 'google_sheet';
export type WorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'failed';
export type IntegrationStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'approval_required';
export type IntegrationArea =
  | 'Core'
  | 'MCP Servers'
  | 'Prospect data & enrichment'
  | 'Intent & buying signals'
  | 'Social & inbound'
  | 'First-party marketing'
  | 'CRM & sales handoff'
  | 'Engagement & automation'
  | 'AI research & call intelligence'
  | 'Databases & analytics'
  | 'Custom REST / Webhook';

export type NavSection =
  | 'chat'
  | 'workflow'
  | 'tasks'
  | 'integrations'
  | 'settings';

export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'deterministic';

export interface ScoringRules {
  companyFitMax: number; // default 40
  roleFitMax: number; // default 25
  buyingSignalsMax: number; // default 25
  engagementMax: number; // default 10
  qualifiedThreshold: number; // default 70
  reviewThreshold: number; // default 45
}

export interface ProductDefinition {
  id: string;
  name: string;
  summary: string;
  valueProp: string;
}

export interface IcpTemplate {
  id: string;
  name: string;
  industry: string;
  geography: string;
  minEmployees: number;
  maxEmployees: number;
  buyerRoles: string[];
  signalKeywords: string[];
}

export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
}

export interface TerritoryRule {
  id: string;
  name: string;
  citiesOrRegions: string[];
  ownerName: string;
  ownerEmail: string;
  segment?: string;
}

export interface SuppressionEntry {
  id: string;
  pattern: string; // email or @domain
  reason: 'opt_out' | 'customer' | 'permanent_bounce' | 'do_not_contact';
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  mode: WorkspaceMode;
  currency: string;
  timeZone: string;
  creditBudget: number;
  creditsUsed: number;
  retentionDays: number;
  aiProvider: AiProviderId;
  aiModel: string;
  products: ProductDefinition[];
  icps: IcpTemplate[];
  customFields: CustomFieldDefinition[];
  territories: TerritoryRule[];
  leadStages: string[];
  scoringRules: ScoringRules;
  suppressions: SuppressionEntry[];
  createdAt: string;
}

export interface MailboxAccount {
  id: string;
  email: string;
  label: string;
  provider: 'gmail' | 'outlook' | 'local_preview';
  dailyLimit: number;
  sentToday: number;
}

export type ConnectorProtocol = 'plugin' | 'mcp' | 'api';
export type McpTransport = 'streamable_http' | 'sse' | 'stdio';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpServerConfig {
  transport: McpTransport;
  endpointUrl?: string;
  command?: string;
  args?: string[];
  authMode: 'none' | 'bearer_env' | 'header_env' | 'oauth';
  envVarName?: string;
  protocolVersion?: string;
  discoveredTools: McpToolDefinition[];
}

export interface PluginManifestConfig {
  packageId: string;
  version: string;
  category: string;
  capabilities: string[];
  envVarName?: string;
}

export interface IntegrationConnection {
  id: string;
  workspaceId: string;
  providerId: string;
  name: string;
  protocol?: ConnectorProtocol;
  area: IntegrationArea;
  isCore: boolean;
  status: IntegrationStatus;
  owner: string;
  description: string;
  allowedActions: string[];
  lastSuccessfulRun: string | null;
  creditsRemaining: number | null;
  creditLimit: number | null;
  mailboxes: MailboxAccount[];
  missingApprovalNote?: string;
  docsUrl?: string;
  mcpConfig?: McpServerConfig;
  pluginConfig?: PluginManifestConfig;
  customConfig?: {
    baseUrl: string;
    authType: 'bearer' | 'api_key' | 'signed_webhook' | 'oauth' | 'none';
    envVarName?: string;
    operations: string[];
    fieldMappings: Record<string, string>;
  };
}

export interface ExtractedFilters {
  product: string;
  campaignGoal: string;
  icpName: string;
  industry: string;
  companyHqLocation: string;
  contactLocation: string;
  minEmployees: number | null;
  maxEmployees: number | null;
  buyerRoles: string[];
  exclusions: string[];
  buyingSignalKeywords: string[];
  signalWindowDays: number;
  targetCount: number;
  requestedOutput: string | null;
  verifiedEmailOnly: boolean;
  excludeHubSpotCustomers: boolean;
  cityFilter: string | null;
}

export interface DatedSignal {
  id: string;
  type: 'Hiring' | 'Expansion' | 'Funding' | 'Tech' | 'Inbound' | 'News';
  title: string;
  summary: string;
  sourceName: string;
  sourceUrlOrId: string;
  eventDate: string; // YYYY-MM-DD
  observedAt: string; // ISO timestamp
}

export interface ScoreFactorDetail {
  factor: 'Company Fit' | 'Buyer-Role Fit' | 'Recent Buying Signals' | 'Observed Engagement';
  points: number;
  maxPoints: number;
  reason: string;
}

export interface ScoreBreakdown {
  companyFit: number;
  roleFit: number;
  buyingSignals: number;
  engagement: number;
  total: number;
  factors: ScoreFactorDetail[];
}

export interface LeadSourceProvenance {
  provider: string;
  recordId: string;
  fetchedAt: string;
}

export interface LeadEngagementEvent {
  id: string;
  type: 'contacted' | 'replied' | 'meeting_booked' | 'opportunity' | 'unsubscribed' | 'bounced';
  date: string;
  channel: 'email' | 'linkedin' | 'phone' | 'form' | 'event';
  note: string;
}

export interface LeadRecord {
  id: string;
  workspaceId: string;
  campaignId: string;
  companyId: string;
  companyName: string;
  companyDomain: string;
  companyHqCity: string;
  companyHqState: string;
  companyHqCountry: string;
  industry: string;
  employeeCount: number | null;
  contactName: string;
  contactTitle: string;
  contactLocation: string;
  workEmail: string;
  emailStatus: EmailVerificationStatus;
  emailProvider: string;
  emailVerifiedAt: string;
  acquisitionSource: string;
  sources: LeadSourceProvenance[];
  signals: DatedSignal[];
  companyBrief: string;
  conversationOpener: string;
  scoreTotal: number;
  scoreBreakdown: ScoreBreakdown;
  dataCoveragePct: number;
  qualificationLabel: QualificationLabel;
  ambiguousIdentityFlag: boolean;
  ambiguousReason?: string;
  owner: string;
  territory: string;
  crmStage: string;
  crmRecordId: string | null;
  crmRecordUrl: string | null;
  crmSyncedAt: string | null;
  isExistingHubSpotCustomer?: boolean;
  customFieldValues: Record<string, string>;
  engagementEvents: LeadEngagementEvent[];
  activityLog: { timestamp: string; summary: string }[];
  discoveredAt: string;
}

export interface WorkflowStep {
  id: string;
  actionId: string;
  order: number;
  key:
    | 'understand'
    | 'crm_exclusions'
    | 'source_search'
    | 'clean_verify'
    | 'research_signals'
    | 'score_rank'
    | 'output_action';
  title: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed' | 'skipped';
  inputs: string;
  outputCount: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  detail: string;
}

export interface WorkflowRun {
  id: string;
  workspaceId: string;
  campaignId: string;
  conversationId: string;
  status: WorkflowRunStatus;
  planSummary: string;
  toolsUsed: string[];
  creditsSpent: number;
  shortfallReason: string | null;
  steps: WorkflowStep[];
  resultLeadIds: string[];
  excludedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportArtifact {
  id: string;
  workspaceId: string;
  campaignId: string;
  runId: string | null;
  format: ExportFormat;
  fileName: string;
  rowCount: number;
  columns: string[];
  leadIdsSnapshot: string[];
  filtersSnapshot: ExtractedFilters;
  createdAt: string;
  downloadUrl: string;
  externalUrl?: string;
  summaryNote: string;
  sheetsIncluded?: string[];
}

export interface EmailDraft {
  id: string;
  workspaceId: string;
  campaignId: string;
  kind: 'team_report' | 'prospect_outreach';
  mailboxAccount: string;
  provider: 'gmail' | 'outlook' | 'local_preview';
  recipients: string[];
  leadId: string | null;
  leadName?: string;
  subject: string;
  body: string;
  attachmentExportId: string | null;
  attachmentFileName: string | null;
  status: 'draft' | 'sent' | 'blocked_suppressed' | 'failed';
  providerResponseId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface OutreachSequenceStep {
  id: string;
  dayOffset: number;
  channel: 'email' | 'linkedin' | 'whatsapp';
  subject: string;
  bodyTemplate: string;
}

export interface OutreachSequence {
  id: string;
  workspaceId: string;
  campaignId: string;
  name: string;
  channel: 'email' | 'linkedin' | 'whatsapp';
  replyStopSupported: boolean;
  status: 'draft' | 'active' | 'paused_no_reply_signal';
  steps: OutreachSequenceStep[];
  enrolledLeadIds: string[];
  stoppedLeadIds: string[];
  createdAt: string;
}

export interface GtmTask {
  id: string;
  workspaceId: string;
  campaignId: string;
  leadId: string | null;
  title: string;
  owner: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Done';
  crmTaskId: string | null;
  createdAt: string;
}

export interface SavedSearch {
  id: string;
  workspaceId: string;
  campaignId: string;
  name: string;
  prompt: string;
  filters: ExtractedFilters;
  schedule: 'Manual' | 'Daily' | 'Weekly';
  lastRefreshedAt: string;
  lastMatchCount: number;
  newlyQualifyingCount: number;
  createdAt: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  mode: CampaignMode;
  description: string;
  prompt: string;
  defaultFilters: Partial<ExtractedFilters>;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  mode: CampaignMode;
  productId: string;
  goal: string;
  status: 'Active' | 'Paused' | 'Completed';
  filters: ExtractedFilters;
  leadIds: string[];
  refreshSchedule: 'Manual' | 'Daily' | 'Weekly';
  createdAt: string;
  updatedAt: string;
}

export interface ScoreExplanationBlock {
  leadId: string;
  leadName: string;
  companyName: string;
  scoreTotal: number;
  qualificationLabel: QualificationLabel;
  reconciledSum: number;
  summaryText: string;
  factors: ScoreFactorDetail[];
}

export interface CrmSyncSummaryBlock {
  provider: string;
  syncedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  fieldMappings: { sourceField: string; crmField: string }[];
  records: { leadId: string; contactName: string; companyName: string; owner: string; crmRecordId: string; crmRecordUrl: string }[];
}

export interface InboundDedupSummaryBlock {
  rawCount: number;
  deduplicatedCount: number;
  duplicatesMerged: number;
  cityCounts: { city: string; count: number; owner: string }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  filterSummary?: string;
  editableFilters?: ExtractedFilters;
  sourcesToUse?: string[];
  runId?: string;
  leadIds?: string[];
  shortfallReason?: string | null;
  scoreExplanation?: ScoreExplanationBlock;
  exportArtifactId?: string;
  draftIds?: string[];
  crmSyncSummary?: CrmSyncSummaryBlock;
  inboundSummary?: InboundDedupSummaryBlock;
  unsupportedFormatNotice?: {
    requested: string;
    alternatives: ExportFormat[];
  };
  clarifyingQuestion?: string;
}

export interface ChatThread {
  id: string;
  workspaceId: string;
  campaignId: string;
  title: string;
  messages: ChatMessage[];
  selectedLeadIds: string[];
  activeLeadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  workspaceId: string;
  actor: string;
  category: 'export' | 'email' | 'crm' | 'workflow' | 'integration' | 'settings';
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ConversionFunnelMetrics {
  found: number;
  qualified: number;
  contacted: number;
  replied: number;
  meetingsBooked: number;
  opportunities: number;
  qualifiedRate: { numerator: number; denominator: number; pct: number };
  contactedRate: { numerator: number; denominator: number; pct: number };
  replyRate: { numerator: number; denominator: number; pct: number };
  meetingRate: { numerator: number; denominator: number; pct: number };
  opportunityRate: { numerator: number; denominator: number; pct: number };
}

export interface WorkspaceSnapshotPayload {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  integrations: IntegrationConnection[];
  connectedToolCount: number;
  campaigns: Campaign[];
  threads: ChatThread[];
  leads: LeadRecord[];
  runs: WorkflowRun[];
  exports: ExportArtifact[];
  drafts: EmailDraft[];
  sequences: OutreachSequence[];
  tasks: GtmTask[];
  savedSearches: SavedSearch[];
  templates: CampaignTemplate[];
  auditEvents: AuditEvent[];
  availableModels: { provider: AiProviderId; model: string; label: string; liveKeyConfigured: boolean }[];
}
