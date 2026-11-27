import type {
  ConnectorProtocol,
  IntegrationArea,
  IntegrationConnection,
} from '../types/gtm';

export type GtmCatalogCategory =
  | 'Data, Scraping & Enrichment'
  | 'Intent & Buying Signals'
  | 'Workflow Automation & Orchestration'
  | 'Cold Email & Multi-Channel Outreach'
  | 'CRM (Customer Relationship Management)'
  | 'AI Research & Call Intelligence';

export const GTM_CATALOG_CATEGORIES: GtmCatalogCategory[] = [
  'Data, Scraping & Enrichment',
  'Intent & Buying Signals',
  'Workflow Automation & Orchestration',
  'Cold Email & Multi-Channel Outreach',
  'CRM (Customer Relationship Management)',
  'AI Research & Call Intelligence',
];

export type StackBudget = 'bootstrapped' | 'funded_enterprise';
export type StackChannel = 'cold_email' | 'linkedin' | 'inbound' | 'all';
export type StackStage = 'solo_founder' | 'startup' | 'enterprise';

export interface GtmCatalogTool {
  id: string;
  /** Matches IntegrationConnection.providerId when already seeded in workspace */
  matchProviderIds: string[];
  name: string;
  category: GtmCatalogCategory;
  description: string;
  protocol: ConnectorProtocol;
  area: IntegrationArea;
  capabilities: string[];
  envVarName: string;
  packageId?: string;
  apiBaseUrl?: string;
  mcpEndpointUrl?: string;
  docsUrl?: string;
}

export const GTM_TOOL_CATALOG: GtmCatalogTool[] = [
  // 1. Data, Scraping & Enrichment (9)
  {
    id: 'clay',
    matchProviderIds: ['clay', 'plugin_claygent_waterfall_plugin'],
    name: 'Clay',
    category: 'Data, Scraping & Enrichment',
    description: 'AI-powered enrichment & waterfall lookups across 150+ providers.',
    protocol: 'plugin',
    area: 'Prospect data & enrichment',
    capabilities: ['waterfall_enrich', 'claygent_research', 'table_webhook'],
    envVarName: 'CLAY_API_KEY',
    packageId: '@gtm-plugins/clay-waterfall',
    docsUrl: 'https://docs.clay.com/',
  },
  {
    id: 'apollo',
    matchProviderIds: ['apollo'],
    name: 'Apollo.io',
    category: 'Data, Scraping & Enrichment',
    description: 'B2B contact database, firmographic filters & prospecting.',
    protocol: 'plugin',
    area: 'Prospect data & enrichment',
    capabilities: ['company_search', 'people_search', 'people_enrichment'],
    envVarName: 'APOLLO_API_KEY',
    packageId: '@gtm-plugins/apollo',
    docsUrl: 'https://docs.apollo.io/',
  },
  {
    id: 'zoominfo',
    matchProviderIds: ['pdl_zoominfo', 'plugin_zoominfo'],
    name: 'ZoomInfo',
    category: 'Data, Scraping & Enrichment',
    description: 'Enterprise B2B intelligence, org charts & verified direct dials.',
    protocol: 'plugin',
    area: 'Prospect data & enrichment',
    capabilities: ['enterprise_company_enrich', 'contact_direct_dials', 'buyer_intent'],
    envVarName: 'ZOOMINFO_API_KEY',
    packageId: '@gtm-plugins/zoominfo',
  },
  {
    id: 'lusha',
    matchProviderIds: ['plugin_lusha'],
    name: 'Lusha',
    category: 'Data, Scraping & Enrichment',
    description: 'Direct phone & verified business email finder for outbound teams.',
    protocol: 'plugin',
    area: 'Prospect data & enrichment',
    capabilities: ['direct_phone_lookup', 'work_email_finder'],
    envVarName: 'LUSHA_API_KEY',
    packageId: '@gtm-plugins/lusha',
  },
  {
    id: 'fullenrich',
    matchProviderIds: ['plugin_fullenrich'],
    name: 'FullEnrich',
    category: 'Data, Scraping & Enrichment',
    description: 'Waterfall contact enrichment aggregating 15+ email & phone vendors.',
    protocol: 'plugin',
    area: 'Prospect data & enrichment',
    capabilities: ['waterfall_email_enrich', 'waterfall_phone_enrich'],
    envVarName: 'FULLENRICH_API_KEY',
    packageId: '@gtm-plugins/fullenrich',
  },
  {
    id: 'leadmagic',
    matchProviderIds: ['plugin_leadmagic'],
    name: 'LeadMagic',
    category: 'Data, Scraping & Enrichment',
    description: 'High-accuracy work email validation, catch-all verification & enrichment.',
    protocol: 'plugin',
    area: 'Prospect data & enrichment',
    capabilities: ['email_validate', 'catchall_verify', 'profile_enrich'],
    envVarName: 'LEADMAGIC_API_KEY',
    packageId: '@gtm-plugins/leadmagic',
  },
  {
    id: 'ocean_io',
    matchProviderIds: ['plugin_ocean_io'],
    name: 'Ocean.io',
    category: 'Data, Scraping & Enrichment',
    description: 'AI lookalike company discovery built from your best existing accounts.',
    protocol: 'plugin',
    area: 'Prospect data & enrichment',
    capabilities: ['lookalike_company_search', 'icp_similarity_score'],
    envVarName: 'OCEAN_IO_API_KEY',
    packageId: '@gtm-plugins/ocean-io',
  },
  {
    id: 'phantombuster',
    matchProviderIds: ['plugin_phantombuster'],
    name: 'PhantomBuster',
    category: 'Data, Scraping & Enrichment',
    description: 'Cloud-based social & web data extraction automations.',
    protocol: 'api',
    area: 'Prospect data & enrichment',
    capabilities: ['POST /phantoms/launch', 'GET /phantoms/output'],
    envVarName: 'PHANTOMBUSTER_API_KEY',
    apiBaseUrl: 'https://api.phantombuster.com/api/v2',
  },
  {
    id: 'apify',
    matchProviderIds: ['plugin_apify', 'plugin_apify_web_actors_plugin'],
    name: 'Apify',
    category: 'Data, Scraping & Enrichment',
    description: 'Scalable custom web scraping actors for directories & careers pages.',
    protocol: 'mcp',
    area: 'MCP Servers',
    capabilities: ['run_apify_actor', 'fetch_dataset_items'],
    envVarName: 'APIFY_TOKEN',
    mcpEndpointUrl: 'https://mcp.apify.com/',
  },

  // 2. Intent & Buying Signals (6)
  {
    id: 'common_room',
    matchProviderIds: ['plugin_common_room'],
    name: 'Common Room',
    category: 'Intent & Buying Signals',
    description: 'Community, dark-social & product-usage buying signal capture.',
    protocol: 'plugin',
    area: 'Intent & buying signals',
    capabilities: ['capture_community_signals', 'resolve_member_identity', 'account_activity_feed'],
    envVarName: 'COMMON_ROOM_API_KEY',
    packageId: '@gtm-plugins/common-room',
  },
  {
    id: 'trigify',
    matchProviderIds: ['plugin_trigify'],
    name: 'Trigify',
    category: 'Intent & Buying Signals',
    description: 'Real-time social engagement & buying signal tracking across LinkedIn.',
    protocol: 'api',
    area: 'Intent & buying signals',
    capabilities: ['POST /webhooks/social-triggers', 'GET /signals/engaged-buyers'],
    envVarName: 'TRIGIFY_API_KEY',
    apiBaseUrl: 'https://api.trigify.io/v1',
  },
  {
    id: '6sense',
    matchProviderIds: ['plugin_6sense'],
    name: '6sense',
    category: 'Intent & Buying Signals',
    description: 'Enterprise account-based intent, buying-stage prediction & dark funnel data.',
    protocol: 'plugin',
    area: 'Intent & buying signals',
    capabilities: ['read_buying_stage', 'intent_topic_scores', 'account_de_anonymize'],
    envVarName: 'SIXSENSE_API_KEY',
    packageId: '@gtm-plugins/6sense',
  },
  {
    id: 'demandbase',
    matchProviderIds: ['plugin_demandbase'],
    name: 'Demandbase',
    category: 'Intent & Buying Signals',
    description: 'B2B account intelligence, keyword intent & ABM qualification.',
    protocol: 'plugin',
    area: 'Intent & buying signals',
    capabilities: ['abm_account_intent', 'qualification_scores'],
    envVarName: 'DEMANDBASE_API_KEY',
    packageId: '@gtm-plugins/demandbase',
  },
  {
    id: 'rb2b',
    matchProviderIds: ['plugin_rb2b'],
    name: 'RB2B',
    category: 'Intent & Buying Signals',
    description: 'Person-level website visitor identification routed into Slack & CRM.',
    protocol: 'api',
    area: 'Intent & buying signals',
    capabilities: ['POST /webhooks/website-visitor', 'GET /visitors/high-intent'],
    envVarName: 'RB2B_WEBHOOK_SECRET',
    apiBaseUrl: 'https://api.rb2b.com/v1/webhooks',
  },
  {
    id: 'clearbit_breeze',
    matchProviderIds: ['plugin_clearbit_breeze_intelligence'],
    name: 'Clearbit / Breeze Intelligence',
    category: 'Intent & Buying Signals',
    description: 'Real-time company & visitor enrichment native to HubSpot buyer intent.',
    protocol: 'plugin',
    area: 'Intent & buying signals',
    capabilities: ['realtime_company_enrich', 'visitor_ip_resolve', 'form_shortening'],
    envVarName: 'BREEZE_CLEARBIT_API_KEY',
    packageId: '@gtm-plugins/clearbit-breeze',
  },

  // 3. Workflow Automation & Orchestration (4)
  {
    id: 'n8n',
    matchProviderIds: ['plugin_n8n', 'plugin_n8n_workflow_bridge_plugin', 'mcp_n8n'],
    name: 'n8n',
    category: 'Workflow Automation & Orchestration',
    description: 'Open-source, AI-friendly workflow automation with complex branching & MCP.',
    protocol: 'mcp',
    area: 'MCP Servers',
    capabilities: ['trigger_n8n_workflow', 'list_active_workflows'],
    envVarName: 'N8N_API_KEY',
    mcpEndpointUrl: 'https://n8n.internal.example/mcp',
  },
  {
    id: 'make',
    matchProviderIds: ['plugin_make'],
    name: 'Make',
    category: 'Workflow Automation & Orchestration',
    description: 'Visual no-code scenario builder for lead routing & webhook orchestration.',
    protocol: 'api',
    area: 'Engagement & automation',
    capabilities: ['POST /scenarios/trigger', 'GET /scenarios/status'],
    envVarName: 'MAKE_WEBHOOK_TOKEN',
    apiBaseUrl: 'https://hook.make.com/custom-gtm',
  },
  {
    id: 'zapier',
    matchProviderIds: ['plugin_zapier', 'mcp_zapier'],
    name: 'Zapier',
    category: 'Workflow Automation & Orchestration',
    description: 'App-to-app automation connecting forms, CRMs, spreadsheets & alerts.',
    protocol: 'mcp',
    area: 'MCP Servers',
    capabilities: ['trigger_zap', 'search_zap_actions'],
    envVarName: 'ZAPIER_MCP_TOKEN',
    mcpEndpointUrl: 'https://mcp.zapier.com/api/mcp',
  },
  {
    id: 'cargo',
    matchProviderIds: ['plugin_cargo'],
    name: 'Cargo',
    category: 'Workflow Automation & Orchestration',
    description: 'Revenue orchestration & data-warehouse GTM workflows.',
    protocol: 'api',
    area: 'Engagement & automation',
    capabilities: ['POST /workflows/execute', 'POST /records/route'],
    envVarName: 'CARGO_API_KEY',
    apiBaseUrl: 'https://api.getcargo.io/v1',
  },

  // 4. Cold Email & Multi-Channel Outreach (6)
  {
    id: 'smartlead',
    matchProviderIds: ['plugin_smartlead'],
    name: 'Smartlead',
    category: 'Cold Email & Multi-Channel Outreach',
    description: 'High-volume cold email infrastructure, warmup & automatic inbox rotation.',
    protocol: 'api',
    area: 'Engagement & automation',
    capabilities: ['POST /campaigns/leads', 'GET /campaigns/analytics', 'GET /webhooks/replies'],
    envVarName: 'SMARTLEAD_API_KEY',
    apiBaseUrl: 'https://server.smartlead.ai/api/v1',
  },
  {
    id: 'instantly',
    matchProviderIds: ['plugin_instantly'],
    name: 'Instantly',
    category: 'Cold Email & Multi-Channel Outreach',
    description: 'Cold email scaling, unlimited sender warmup & unified unibox.',
    protocol: 'api',
    area: 'Engagement & automation',
    capabilities: ['POST /lead/add', 'GET /campaign/summary', 'GET /unibox/replies'],
    envVarName: 'INSTANTLY_API_KEY',
    apiBaseUrl: 'https://api.instantly.ai/api/v2',
  },
  {
    id: 'lemlist',
    matchProviderIds: ['plugin_lemlist'],
    name: 'Lemlist',
    category: 'Cold Email & Multi-Channel Outreach',
    description: 'Personalized email + LinkedIn multi-channel outreach sequences.',
    protocol: 'plugin',
    area: 'Engagement & automation',
    capabilities: ['enroll_multichannel_campaign', 'sync_reply_events'],
    envVarName: 'LEMLIST_API_KEY',
    packageId: '@gtm-plugins/lemlist',
  },
  {
    id: 'heyreach',
    matchProviderIds: ['plugin_heyreach'],
    name: 'HeyReach',
    category: 'Cold Email & Multi-Channel Outreach',
    description: 'Automated LinkedIn outreach across multiple sender seats safely at scale.',
    protocol: 'api',
    area: 'Engagement & automation',
    capabilities: ['POST /campaign/add-leads', 'GET /inbox/conversations'],
    envVarName: 'HEYREACH_API_KEY',
    apiBaseUrl: 'https://api.heyreach.io/api/public',
  },
  {
    id: 'outreach',
    matchProviderIds: ['plugin_outreach'],
    name: 'Outreach',
    category: 'Cold Email & Multi-Channel Outreach',
    description: 'Enterprise sales engagement platform with sequence governance & analytics.',
    protocol: 'plugin',
    area: 'Engagement & automation',
    capabilities: ['enroll_sequence', 'log_sales_activity', 'read_reply_stop'],
    envVarName: 'OUTREACH_ACCESS_TOKEN',
    packageId: '@gtm-plugins/outreach',
  },
  {
    id: 'salesloft',
    matchProviderIds: ['plugin_salesloft'],
    name: 'Salesloft',
    category: 'Cold Email & Multi-Channel Outreach',
    description: 'Enterprise sales engagement cadences, dialer & pipeline rhythm.',
    protocol: 'plugin',
    area: 'Engagement & automation',
    capabilities: ['add_to_cadence', 'sync_call_outcomes'],
    envVarName: 'SALESLOFT_API_KEY',
    packageId: '@gtm-plugins/salesloft',
  },

  // 5. CRM (Customer Relationship Management) (4)
  {
    id: 'hubspot',
    matchProviderIds: ['hubspot'],
    name: 'HubSpot',
    category: 'CRM (Customer Relationship Management)',
    description: 'All-in-one CRM for startups to mid-market with native marketing & deals.',
    protocol: 'plugin',
    area: 'CRM & sales handoff',
    capabilities: ['read_exclusions', 'upsert_companies', 'upsert_contacts', 'create_tasks'],
    envVarName: 'HUBSPOT_PRIVATE_APP_TOKEN',
    packageId: '@gtm-plugins/hubspot-crm',
    docsUrl: 'https://developers.hubspot.com/docs/api/crm/contacts',
  },
  {
    id: 'salesforce',
    matchProviderIds: ['plugin_salesforce'],
    name: 'Salesforce',
    category: 'CRM (Customer Relationship Management)',
    description: 'Enterprise CRM for complex territories, account hierarchies & attribution.',
    protocol: 'plugin',
    area: 'CRM & sales handoff',
    capabilities: ['soql_exclusions', 'upsert_account_contact', 'assign_territory_owner'],
    envVarName: 'SALESFORCE_ACCESS_TOKEN',
    packageId: '@gtm-plugins/salesforce',
  },
  {
    id: 'attio',
    matchProviderIds: ['plugin_attio', 'mcp_attio'],
    name: 'Attio',
    category: 'CRM (Customer Relationship Management)',
    description: 'Modern, flexible, data-driven CRM with custom objects & live enrichment.',
    protocol: 'mcp',
    area: 'MCP Servers',
    capabilities: ['attio_search_records', 'attio_upsert_company', 'attio_add_to_list'],
    envVarName: 'ATTIO_API_KEY',
    mcpEndpointUrl: 'https://mcp.attio.example/v1/mcp',
  },
  {
    id: 'pipedrive',
    matchProviderIds: ['plugin_pipedrive'],
    name: 'Pipedrive',
    category: 'CRM (Customer Relationship Management)',
    description: 'Sales-focused visual pipeline CRM built for fast-moving outbound teams.',
    protocol: 'plugin',
    area: 'CRM & sales handoff',
    capabilities: ['upsert_organization', 'create_deal', 'assign_rep_activity'],
    envVarName: 'PIPEDRIVE_API_TOKEN',
    packageId: '@gtm-plugins/pipedrive',
  },

  // 6. AI Research & Call Intelligence (4)
  {
    id: 'claude_code',
    matchProviderIds: ['mcp_claude_claude_code', 'plugin_claude_claude_code'],
    name: 'Claude / Claude Code',
    category: 'AI Research & Call Intelligence',
    description: 'AI copywriting, data cleaning & agentic GTM workflows via MCP.',
    protocol: 'mcp',
    area: 'MCP Servers',
    capabilities: ['clean_lead_dataset', 'draft_personalized_opener', 'synthesize_account_brief'],
    envVarName: 'ANTHROPIC_API_KEY',
    mcpEndpointUrl: 'http://localhost:3000/api/mcp',
  },
  {
    id: 'perplexity',
    matchProviderIds: ['plugin_perplexity'],
    name: 'Perplexity',
    category: 'AI Research & Call Intelligence',
    description: 'Real-time cited web research on target accounts, hiring & news triggers.',
    protocol: 'api',
    area: 'AI research & call intelligence',
    capabilities: ['POST /chat/completions', 'research_account_citations'],
    envVarName: 'PERPLEXITY_API_KEY',
    apiBaseUrl: 'https://api.perplexity.ai',
  },
  {
    id: 'gong',
    matchProviderIds: ['plugin_gong'],
    name: 'Gong',
    category: 'AI Research & Call Intelligence',
    description: 'Call recording, objection patterns & enterprise revenue intelligence.',
    protocol: 'plugin',
    area: 'AI research & call intelligence',
    capabilities: ['fetch_call_transcripts', 'extract_objection_signals'],
    envVarName: 'GONG_API_KEY',
    packageId: '@gtm-plugins/gong',
  },
  {
    id: 'fireflies',
    matchProviderIds: ['plugin_fireflies_ai'],
    name: 'Fireflies.ai',
    category: 'AI Research & Call Intelligence',
    description: 'AI meeting notes, action items & CRM-synced call summaries.',
    protocol: 'plugin',
    area: 'AI research & call intelligence',
    capabilities: ['sync_meeting_notes', 'extract_next_steps'],
    envVarName: 'FIREFLIES_API_KEY',
    packageId: '@gtm-plugins/fireflies-ai',
  },
];

export interface RecommendedToolEntry {
  tool: GtmCatalogTool;
  slotLabel: string;
  rationale: string;
}

export interface StackRecommendationResult {
  headline: string;
  summary: string;
  tools: RecommendedToolEntry[];
}

function getToolById(id: string): GtmCatalogTool {
  const found = GTM_TOOL_CATALOG.find((t) => t.id === id);
  if (!found) {
    throw new Error(`Unknown GTM catalog tool id: ${id}`);
  }
  return found;
}

/**
 * Pure deterministic recommender that narrows the 33-tool GTM catalog down to
 * the exact 3–4 starter tools based on budget, main channel, and company stage.
 */
export function recommendStarterStack(input: {
  budget: StackBudget;
  channel: StackChannel;
  stage: StackStage;
}): StackRecommendationResult {
  const { budget, channel, stage } = input;
  const entries: RecommendedToolEntry[] = [];

  // Slot 1: Data & Enrichment or Visitor/Intent Capture
  if (channel === 'inbound') {
    if (budget === 'bootstrapped') {
      entries.push({
        tool: getToolById('rb2b'),
        slotLabel: '1. Inbound Signal Capture',
        rationale:
          'Identifies high-intent website visitors on a lean budget so inbound forms and anonymous traffic convert faster.',
      });
    } else if (stage === 'enterprise') {
      entries.push({
        tool: getToolById('6sense'),
        slotLabel: '1. Enterprise Intent & ABM',
        rationale:
          'Surfaces in-market enterprise accounts and buying stages before they ever fill out a demo form.',
      });
    } else {
      entries.push({
        tool: getToolById('clearbit_breeze'),
        slotLabel: '1. Inbound Enrichment',
        rationale:
          'Enriches form submissions in real time and shortens inbound lead capture forms automatically.',
      });
    }
  } else if (budget === 'bootstrapped') {
    entries.push({
      tool: getToolById('apollo'),
      slotLabel: '1. Prospecting & Data',
      rationale:
        'Gives you a generous free/low-cost B2B database and verified filters without paying for multiple data vendors.',
    });
  } else if (stage === 'enterprise') {
    entries.push({
      tool: getToolById('zoominfo'),
      slotLabel: '1. Enterprise Data',
      rationale:
        'Delivers deep enterprise org charts, direct dials, and compliance-ready firmographics.',
    });
  } else {
    entries.push({
      tool: getToolById('clay'),
      slotLabel: '1. Waterfall Enrichment',
      rationale:
        'Combines 150+ enrichment sources and AI account research into one automated waterfall table.',
    });
  }

  // Slot 2: Main Channel Execution / Signal Trigger
  if (channel === 'cold_email') {
    if (stage === 'enterprise' && budget === 'funded_enterprise') {
      entries.push({
        tool: getToolById('outreach'),
        slotLabel: '2. Cold Email Execution',
        rationale:
          'Provides enterprise sequence governance, rep activity sync, and strict opt-out controls.',
      });
    } else if (budget === 'bootstrapped') {
      entries.push({
        tool: getToolById('instantly'),
        slotLabel: '2. Cold Email Scaling',
        rationale:
          'Flat-fee inbox warmup and sending rotation ideal for bootstrapped outbound volume.',
      });
    } else {
      entries.push({
        tool: getToolById('smartlead'),
        slotLabel: '2. Cold Email Infrastructure',
        rationale:
          'High-deliverability multi-inbox rotation with webhook reply capture for funded growth teams.',
      });
    }
  } else if (channel === 'linkedin') {
    if (budget === 'bootstrapped') {
      entries.push({
        tool: getToolById('heyreach'),
        slotLabel: '2. LinkedIn Outreach',
        rationale:
          'Safe multi-seat LinkedIn outreach automation with centralized reply tracking.',
      });
    } else {
      entries.push({
        tool: getToolById('trigify'),
        slotLabel: '2. LinkedIn Buying Signals',
        rationale:
          'Tracks real-time LinkedIn engagement triggers so reps reach out while prospects are active.',
      });
    }
  } else if (channel === 'inbound') {
    entries.push({
      tool: getToolById(budget === 'bootstrapped' ? 'n8n' : 'common_room'),
      slotLabel:
        budget === 'bootstrapped' ? '2. Routing & Automation' : '2. Community & Dark Social',
      rationale:
        budget === 'bootstrapped'
          ? 'Open-source webhook routing to deduplicate, score, and route every inbound form submission.'
          : 'Unifies product usage, community, and inbound signals into prioritized account alerts.',
    });
  } else {
    // All channels
    if (stage === 'enterprise' && budget === 'funded_enterprise') {
      entries.push({
        tool: getToolById('outreach'),
        slotLabel: '2. Multi-Channel Engagement',
        rationale:
          'Coordinates email, call, and LinkedIn tasks across large sales teams with full CRM governance.',
      });
    } else {
      entries.push({
        tool: getToolById('lemlist'),
        slotLabel: '2. Multi-Channel Outreach',
        rationale:
          'Runs coordinated personalized email + LinkedIn sequences from a single workspace.',
      });
    }
  }

  // Slot 3: CRM
  if (stage === 'enterprise') {
    entries.push({
      tool: getToolById('salesforce'),
      slotLabel: '3. System of Record (CRM)',
      rationale:
        'Handles multi-region territory hierarchies, enterprise exclusions, and revenue attribution.',
    });
  } else if (stage === 'solo_founder' && budget === 'bootstrapped') {
    entries.push({
      tool: getToolById('attio'),
      slotLabel: '3. Modern Lightweight CRM',
      rationale:
        'Flexible, fast data-driven CRM with a generous starter tier and zero bloat for solo founders.',
    });
  } else {
    entries.push({
      tool: getToolById('hubspot'),
      slotLabel: '3. Core CRM & Pipeline',
      rationale:
        'All-in-one startup-to-mid-market CRM with native inbound forms, exclusions, and deal stages.',
    });
  }

  // Slot 4: Orchestration or AI Intelligence (keeps total strictly 3–4 tools)
  const existingIds = new Set(entries.map((e) => e.tool.id));
  if (stage === 'enterprise' && budget === 'funded_enterprise') {
    if (!existingIds.has('gong')) {
      entries.push({
        tool: getToolById('gong'),
        slotLabel: '4. Revenue Intelligence',
        rationale:
          'Captures buyer objections and deal risks from calls to sharpen outbound messaging and scoring.',
      });
    }
  } else if (channel === 'all' || (channel === 'linkedin' && budget === 'funded_enterprise')) {
    if (!existingIds.has('n8n')) {
      entries.push({
        tool: getToolById('n8n'),
        slotLabel: '4. AI Workflow Orchestration',
        rationale:
          'Connects enrichment, signals, and outreach over webhooks & MCP with zero per-task SaaS tax.',
      });
    }
  } else if (stage === 'solo_founder') {
    if (!existingIds.has('claude_code')) {
      entries.push({
        tool: getToolById('claude_code'),
        slotLabel: '4. AI Research & Copy',
        rationale:
          'Cleans lists, synthesizes prospect briefs, and drafts tailored openers right inside your MCP stack.',
      });
    }
  } else {
    // Startup + single channel -> 4th slot gives crisp AI/automation leverage (n8n or Perplexity)
    const fourthId = existingIds.has('n8n') ? 'perplexity' : 'n8n';
    entries.push({
      tool: getToolById(fourthId),
      slotLabel:
        fourthId === 'perplexity' ? '4. Real-Time AI Research' : '4. Workflow Orchestration',
      rationale:
        fourthId === 'perplexity'
          ? 'Pulls cited company news and expansion triggers in seconds before reps reach out.'
          : 'Automates enrichment-to-CRM handoff and branching rules across your starter stack.',
    });
  }

  const budgetLabel =
    budget === 'bootstrapped' ? 'Free / Bootstrapped' : 'Funded / Enterprise';
  const channelLabel =
    channel === 'cold_email'
      ? 'Cold Email'
      : channel === 'linkedin'
      ? 'LinkedIn'
      : channel === 'inbound'
      ? 'Inbound'
      : 'All Channels';
  const stageLabel =
    stage === 'solo_founder'
      ? 'Solo Founder'
      : stage === 'startup'
      ? 'Startup'
      : 'Enterprise';

  return {
    headline: `Recommended ${entries.length}-Tool Starter Stack (${stageLabel} · ${channelLabel})`,
    summary: `Optimized for a ${budgetLabel.toLowerCase()} ${stageLabel.toLowerCase()} focused on ${channelLabel.toLowerCase()} — start lean with these ${entries.length} tools before adding niche point solutions.`,
    tools: entries,
  };
}

/**
 * Matches a catalog tool against live workspace IntegrationConnection records
 * so the UI accurately reflects Connected vs. Available status.
 */
export function findWorkspaceConnectionForCatalogTool(
  tool: GtmCatalogTool,
  integrations: IntegrationConnection[]
): IntegrationConnection | undefined {
  const normName = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return integrations.find((conn) => {
    if (tool.matchProviderIds.includes(conn.providerId)) return true;
    const connNorm = conn.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return connNorm === normName || conn.providerId === `plugin_${tool.id}` || conn.providerId === `mcp_${tool.id}` || conn.providerId === `api_${tool.id}`;
  });
}
