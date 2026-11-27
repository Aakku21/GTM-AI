-- SignalStack GTM — Initial Relational Schema Migration (PostgreSQL)
-- Run with: psql "$DATABASE_URL" -f migrations/001_initial_schema.sql

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'live')),
  currency TEXT NOT NULL DEFAULT 'INR',
  time_zone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  credit_budget INTEGER NOT NULL DEFAULT 1000,
  credits_used INTEGER NOT NULL DEFAULT 0,
  retention_days INTEGER NOT NULL DEFAULT 365,
  ai_provider TEXT NOT NULL DEFAULT 'gemini',
  ai_model TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'gtm_engineer', 'seller', 'viewer')),
  territory TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  area TEXT NOT NULL,
  is_core BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'error', 'approval_required')),
  owner_email TEXT,
  mailboxes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_actions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  credits_remaining INTEGER,
  credit_limit INTEGER,
  last_successful_run TIMESTAMPTZ,
  custom_config_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, provider_id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('outbound', 'inbound')),
  product_id TEXT,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  refresh_schedule TEXT NOT NULL DEFAULT 'Manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  messages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_lead_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_lead_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  filters_json JSONB NOT NULL,
  schedule TEXT NOT NULL DEFAULT 'Manual',
  last_refreshed_at TIMESTAMPTZ,
  last_match_count INTEGER NOT NULL DEFAULT 0,
  newly_qualifying_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  industry TEXT,
  hq_city TEXT,
  hq_state TEXT,
  hq_country TEXT,
  employee_count INTEGER,
  crm_company_id TEXT,
  company_brief TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, domain)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  job_title TEXT,
  contact_location TEXT,
  work_email TEXT,
  email_status TEXT NOT NULL DEFAULT 'unknown' CHECK (email_status IN ('valid', 'invalid', 'accept-all', 'unknown')),
  email_provider TEXT,
  email_verified_at TIMESTAMPTZ,
  acquisition_source TEXT,
  owner_name TEXT,
  territory TEXT,
  crm_stage TEXT NOT NULL DEFAULT 'New',
  crm_record_id TEXT,
  crm_record_url TEXT,
  ambiguous_identity BOOLEAN NOT NULL DEFAULT FALSE,
  custom_fields_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_signals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url_or_id TEXT NOT NULL,
  event_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_scores (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL,
  company_fit INTEGER NOT NULL,
  role_fit INTEGER NOT NULL,
  buying_signals INTEGER NOT NULL,
  engagement INTEGER NOT NULL,
  data_coverage_pct INTEGER NOT NULL,
  qualification_label TEXT NOT NULL CHECK (qualification_label IN ('Qualified', 'Needs review', 'Disqualified')),
  breakdown_json JSONB NOT NULL,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, contact_id)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'paused', 'cancelled', 'completed', 'failed')),
  tools_used_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  plan_summary TEXT,
  shortfall_reason TEXT,
  steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  run_id TEXT REFERENCES workflow_runs(id) ON DELETE SET NULL,
  format TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT,
  row_count INTEGER NOT NULL,
  columns_json JSONB NOT NULL,
  lead_ids_json JSONB NOT NULL,
  filters_json JSONB NOT NULL,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_drafts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('team_report', 'prospect_outreach')),
  mailbox_account TEXT NOT NULL,
  provider TEXT NOT NULL,
  recipients_json JSONB NOT NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_export_id TEXT REFERENCES export_snapshots(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  provider_response_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_sequences (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  reply_stop_supported BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft',
  steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  enrolled_lead_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  stopped_lead_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('opt_out', 'customer', 'permanent_bounce', 'do_not_contact')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, pattern)
);

CREATE TABLE IF NOT EXISTS crm_field_mappings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact', 'task', 'opportunity')),
  mapping_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gtm_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Done')),
  crm_task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_workspace_campaign ON contacts(workspace_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_signals_company_event_date ON evidence_signals(company_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_created ON audit_events(workspace_id, created_at DESC);
