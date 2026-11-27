import type {
  ConversionFunnelMetrics,
  DatedSignal,
  ExportFormat,
  ExtractedFilters,
  IntegrationConnection,
  LeadRecord,
  QualificationLabel,
  ScoreBreakdown,
  ScoreExplanationBlock,
  ScoreFactorDetail,
  ScoringRules,
  SuppressionEntry,
  TerritoryRule,
} from '../types/gtm';

export const DEFAULT_SCORING_RULES: ScoringRules = {
  companyFitMax: 40,
  roleFitMax: 25,
  buyingSignalsMax: 25,
  engagementMax: 10,
  qualifiedThreshold: 70,
  reviewThreshold: 45,
};

export const SUPPORTED_EXPORT_FORMATS: ExportFormat[] = [
  'xlsx',
  'csv',
  'json',
  'parquet',
  'pdf',
  'google_sheet',
];

export function normalizeDomain(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .trim();
}

export function normalizeEmail(input: string): string {
  return (input || '').trim().toLowerCase();
}

export function isSignalWithinWindow(
  signal: DatedSignal,
  windowDays: number,
  referenceDateIso: string
): boolean {
  if (!signal.eventDate) return false;
  const eventMs = Date.parse(`${signal.eventDate}T00:00:00Z`);
  const refMs = Date.parse(
    referenceDateIso.length === 10
      ? `${referenceDateIso}T23:59:59Z`
      : referenceDateIso
  );
  if (Number.isNaN(eventMs) || Number.isNaN(refMs)) return false;
  const diffDays = (refMs - eventMs) / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= windowDays;
}

export function computeDataCoveragePct(lead: Partial<LeadRecord>): number {
  const fields = [
    Boolean(lead.companyName),
    Boolean(lead.companyDomain),
    Boolean(lead.companyHqCity || lead.companyHqState),
    Boolean(lead.industry),
    typeof lead.employeeCount === 'number' && lead.employeeCount > 0,
    Boolean(lead.contactName),
    Boolean(lead.contactTitle),
    Boolean(lead.workEmail),
    Boolean(lead.emailStatus && lead.emailStatus !== 'unknown'),
    Boolean(lead.signals && lead.signals.length > 0),
  ];
  const populated = fields.filter(Boolean).length;
  return Math.round((populated / fields.length) * 100);
}

export function countConnectedTools(integrations: IntegrationConnection[]): number {
  const uniqueConnectedProducts = new Set<string>();
  for (const item of integrations) {
    if (item.status === 'connected') {
      uniqueConnectedProducts.add(item.providerId);
    }
  }
  return uniqueConnectedProducts.size;
}

export function isLeadSuppressed(
  lead: Pick<LeadRecord, 'workEmail' | 'companyDomain' | 'engagementEvents'>,
  suppressions: SuppressionEntry[]
): { suppressed: boolean; reason: string | null } {
  const email = normalizeEmail(lead.workEmail);
  const domain = normalizeDomain(lead.companyDomain);

  for (const event of lead.engagementEvents ?? []) {
    if (event.type === 'unsubscribed') {
      return { suppressed: true, reason: 'Contact previously unsubscribed' };
    }
    if (event.type === 'bounced') {
      return { suppressed: true, reason: 'Permanent bounce recorded' };
    }
  }

  for (const entry of suppressions) {
    const pattern = entry.pattern.trim().toLowerCase();
    if (!pattern) continue;
    if (pattern.startsWith('@')) {
      const targetDom = pattern.slice(1);
      if (domain === targetDom || email.endsWith(pattern)) {
        return { suppressed: true, reason: `Suppression rule (${entry.reason}): ${entry.pattern}` };
      }
    } else if (email === pattern || domain === pattern) {
      return { suppressed: true, reason: `Suppression rule (${entry.reason}): ${entry.pattern}` };
    }
  }

  return { suppressed: false, reason: null };
}

export function assignTerritoryOwner(
  lead: Pick<LeadRecord, 'companyHqCity' | 'companyHqState' | 'contactLocation'>,
  territories: TerritoryRule[],
  roundRobinIndex = 0
): { owner: string; territory: string } {
  const city = (lead.companyHqCity || '').toLowerCase();
  const state = (lead.companyHqState || '').toLowerCase();
  const loc = (lead.contactLocation || '').toLowerCase();

  for (const rule of territories) {
    const matched = rule.citiesOrRegions.some((region) => {
      const r = region.toLowerCase();
      return (
        (city && (city.includes(r) || r.includes(city))) ||
        (loc && loc.includes(r)) ||
        (state && (state.includes(r) || r.includes(state)))
      );
    });
    if (matched) {
      return { owner: rule.ownerName, territory: rule.name };
    }
  }

  if (territories.length > 0) {
    const fallback = territories[roundRobinIndex % territories.length];
    return { owner: fallback.ownerName, territory: `${fallback.name} (Round Robin)` };
  }

  return { owner: 'Unassigned', territory: 'General' };
}

export function deduplicateLeads(leads: LeadRecord[]): {
  deduplicated: LeadRecord[];
  duplicatesMerged: number;
  ambiguousCount: number;
} {
  const byEmail = new Map<string, LeadRecord>();
  const byNameDomain = new Map<string, LeadRecord>();
  const byNameOnly = new Map<string, LeadRecord>();
  const result: LeadRecord[] = [];
  let duplicatesMerged = 0;

  for (const raw of leads) {
    const email = normalizeEmail(raw.workEmail);
    const domain = normalizeDomain(raw.companyDomain);
    const nameKey = raw.contactName.trim().toLowerCase();
    const nameDomainKey = `${nameKey}::${domain}`;

    const existing =
      (email ? byEmail.get(email) : undefined) ||
      (domain ? byNameDomain.get(nameDomainKey) : undefined);

    if (existing) {
      duplicatesMerged += 1;
      // Merge acquisition sources & provenance without losing history
      const existingSources = new Set(existing.sources.map((s) => `${s.provider}:${s.recordId}`));
      for (const src of raw.sources) {
        const key = `${src.provider}:${src.recordId}`;
        if (!existingSources.has(key)) {
          existing.sources.push(src);
        }
      }
      if (
        raw.acquisitionSource &&
        !existing.acquisitionSource.includes(raw.acquisitionSource)
      ) {
        existing.acquisitionSource = `${existing.acquisitionSource} + ${raw.acquisitionSource}`;
      }
      const existingSigIds = new Set(existing.signals.map((s) => s.title.toLowerCase()));
      for (const sig of raw.signals) {
        if (!existingSigIds.has(sig.title.toLowerCase())) {
          existing.signals.push(sig);
        }
      }
      existing.activityLog.push({
        timestamp: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
        summary: `Deduplicated repeat submission from ${raw.acquisitionSource || 'secondary source'}`,
      });
      continue;
    }

    const cloned: LeadRecord = {
      ...raw,
      companyDomain: domain,
      workEmail: email,
      sources: [...raw.sources],
      signals: [...raw.signals],
      engagementEvents: [...raw.engagementEvents],
      activityLog: [...raw.activityLog],
    };

    // Flag ambiguous identity if same contact name exists at a different domain
    const sameNameOther = byNameOnly.get(nameKey);
    if (sameNameOther && sameNameOther.companyDomain !== domain && nameKey.length > 0) {
      cloned.ambiguousIdentityFlag = true;
      cloned.ambiguousReason = `Matches contact name "${raw.contactName}" found at ${sameNameOther.companyName} (${sameNameOther.companyDomain}). Review identity before outreach.`;
    } else if (nameKey) {
      byNameOnly.set(nameKey, cloned);
    }

    if (email) byEmail.set(email, cloned);
    if (domain) byNameDomain.set(nameDomainKey, cloned);
    result.push(cloned);
  }

  return {
    deduplicated: result,
    duplicatesMerged,
    ambiguousCount: result.filter((l) => l.ambiguousIdentityFlag).length,
  };
}

export function scoreLead(
  lead: LeadRecord,
  filters: ExtractedFilters,
  rules: ScoringRules = DEFAULT_SCORING_RULES,
  referenceDateIso = '2026-11-18'
): { scoreTotal: number; scoreBreakdown: ScoreBreakdown; qualificationLabel: QualificationLabel; dataCoveragePct: number } {
  // 1. Company Fit (default 40 pts): industry + HQ geography + employee size range
  let companyFitRatio = 0;
  const companyReasons: string[] = [];

  const targetInd = (filters.industry || '').toLowerCase();
  const leadInd = (lead.industry || '').toLowerCase();
  if (!targetInd || targetInd === 'all' || leadInd.includes(targetInd.split(' ')[0]) || targetInd.includes(leadInd.split(' ')[0])) {
    companyFitRatio += 0.4;
    companyReasons.push(`Industry matches ${lead.industry}`);
  } else {
    companyFitRatio += 0.1;
    companyReasons.push(`Adjacent industry (${lead.industry})`);
  }

  const targetHq = (filters.cityFilter || filters.companyHqLocation || '').toLowerCase();
  const leadHq = `${lead.companyHqCity} ${lead.companyHqState} ${lead.companyHqCountry}`.toLowerCase();
  if (!targetHq || leadHq.includes(targetHq) || targetHq.includes(lead.companyHqCity.toLowerCase()) || targetHq.includes(lead.companyHqState.toLowerCase())) {
    companyFitRatio += 0.3;
    companyReasons.push(`HQ in ${lead.companyHqCity}, ${lead.companyHqState}`);
  } else {
    companyFitRatio += 0.05;
    companyReasons.push(`HQ outside target (${lead.companyHqCity})`);
  }

  const minEmp = filters.minEmployees ?? 1;
  const maxEmp = filters.maxEmployees ?? 100000;
  if (lead.employeeCount !== null && lead.employeeCount >= minEmp && lead.employeeCount <= maxEmp) {
    // Reward sweet-spot mid-range within the employee band for clear deterministic tie-breaking
    const mid = (minEmp + maxEmp) / 2;
    const distance = Math.abs(lead.employeeCount - mid) / Math.max(1, maxEmp - minEmp);
    companyFitRatio += distance <= 0.35 ? 0.3 : 0.25;
    companyReasons.push(`${lead.employeeCount} employees (within ${minEmp}–${maxEmp})`);
  } else if (lead.employeeCount !== null) {
    companyFitRatio += 0.1;
    companyReasons.push(`${lead.employeeCount} employees (outside ${minEmp}–${maxEmp})`);
  } else {
    companyReasons.push('Headcount unverified');
  }

  const companyFit = Math.min(rules.companyFitMax, Math.round(companyFitRatio * rules.companyFitMax));

  // 2. Buyer-Role Fit (default 25 pts)
  const titleLower = (lead.contactTitle || '').toLowerCase();
  const targetRoles = filters.buyerRoles.map((r) => r.toLowerCase());
  let roleRatio = 0.25;
  let roleReason = `Title "${lead.contactTitle}" is adjacent to target roles`;

  if (targetRoles.length === 0) {
    roleRatio = 0.85;
    roleReason = `Decision-maker role (${lead.contactTitle})`;
  } else if (
    targetRoles.some((r) => {
      const normalizedR = r.replace(/heads of/g, 'head of');
      return titleLower === normalizedR || titleLower.includes(normalizedR) || normalizedR.includes(titleLower);
    })
  ) {
    roleRatio = 1.0;
    roleReason = `Exact role match: ${lead.contactTitle}`;
  } else if (
    titleLower.includes('operations') ||
    titleLower.includes('plant') ||
    titleLower.includes('manufacturing') ||
    titleLower.includes('franchise') ||
    titleLower.includes('director') ||
    titleLower.includes('vp') ||
    titleLower.includes('head')
  ) {
    roleRatio = 0.8;
    roleReason = `Senior functional match: ${lead.contactTitle}`;
  }

  const roleFit = Math.min(rules.roleFitMax, Math.round(roleRatio * rules.roleFitMax));

  // 3. Recent Buying Signals (default 25 pts) — strictly filtered on eventDate within windowDays
  const windowDays = filters.signalWindowDays || 90;
  const recentSignals = lead.signals.filter((s) =>
    isSignalWithinWindow(s, windowDays, referenceDateIso)
  );
  const keywordHits = recentSignals.filter((s) => {
    if (filters.buyingSignalKeywords.length === 0) return true;
    const text = `${s.title} ${s.summary} ${s.type}`.toLowerCase();
    return filters.buyingSignalKeywords.some((kw) => text.includes(kw.toLowerCase()));
  });

  let signalRatio = 0;
  let signalReason = `No dated signals within last ${windowDays} days`;
  if (keywordHits.length >= 2) {
    signalRatio = 1.0;
    signalReason = `${keywordHits.length} matching signals within ${windowDays}d (latest ${keywordHits[0].eventDate}: ${keywordHits[0].title})`;
  } else if (keywordHits.length === 1) {
    // Recency bonus within 30d vs 90d
    const daysAgo = Math.max(
      0,
      Math.round(
        (Date.parse(`${referenceDateIso}T00:00:00Z`) -
          Date.parse(`${keywordHits[0].eventDate}T00:00:00Z`)) /
          86400000
      )
    );
    signalRatio = daysAgo <= 30 ? 0.92 : daysAgo <= 60 ? 0.8 : 0.72;
    signalReason = `Matching ${keywordHits[0].type.toLowerCase()} signal on ${keywordHits[0].eventDate} (${daysAgo}d ago): ${keywordHits[0].title}`;
  } else if (recentSignals.length > 0) {
    signalRatio = 0.48;
    signalReason = `${recentSignals.length} general recent signal (${recentSignals[0].eventDate}: ${recentSignals[0].title})`;
  }

  const buyingSignals = Math.min(
    rules.buyingSignalsMax,
    Math.round(signalRatio * rules.buyingSignalsMax)
  );

  // 4. Observed Engagement (default 10 pts)
  let engagementPoints = 0;
  const engagementNotes: string[] = [];
  if (lead.engagementEvents.some((e) => e.type === 'meeting_booked' || e.type === 'opportunity')) {
    engagementPoints = rules.engagementMax;
    engagementNotes.push('Active meeting/opportunity engagement');
  } else if (lead.engagementEvents.some((e) => e.type === 'replied')) {
    engagementPoints = Math.round(rules.engagementMax * 0.9);
    engagementNotes.push('Replied to outreach');
  } else if (lead.acquisitionSource.toLowerCase().includes('form') || lead.acquisitionSource.toLowerCase().includes('event') || lead.acquisitionSource.toLowerCase().includes('typeform')) {
    engagementPoints = Math.round(rules.engagementMax * 0.8);
    engagementNotes.push(`Opted-in first-party inquiry (${lead.acquisitionSource})`);
  } else if (lead.engagementEvents.some((e) => e.type === 'contacted')) {
    engagementPoints = Math.round(rules.engagementMax * 0.5);
    engagementNotes.push('Contacted in active sequence');
  } else if (lead.emailStatus === 'valid' && lead.signals.length >= 2) {
    engagementPoints = Math.round(rules.engagementMax * 0.6);
    engagementNotes.push('Verified direct contact with multi-source footprint');
  } else if (lead.emailStatus === 'valid') {
    engagementPoints = Math.round(rules.engagementMax * 0.4);
    engagementNotes.push('Verified work email ready for engagement');
  } else {
    engagementPoints = Math.round(rules.engagementMax * 0.1);
    engagementNotes.push('No first-party engagement observed yet');
  }

  const engagement = Math.min(rules.engagementMax, engagementPoints);
  const total = companyFit + roleFit + buyingSignals + engagement;

  const factors: ScoreFactorDetail[] = [
    {
      factor: 'Company Fit',
      points: companyFit,
      maxPoints: rules.companyFitMax,
      reason: companyReasons.join(' · '),
    },
    {
      factor: 'Buyer-Role Fit',
      points: roleFit,
      maxPoints: rules.roleFitMax,
      reason: roleReason,
    },
    {
      factor: 'Recent Buying Signals',
      points: buyingSignals,
      maxPoints: rules.buyingSignalsMax,
      reason: signalReason,
    },
    {
      factor: 'Observed Engagement',
      points: engagement,
      maxPoints: rules.engagementMax,
      reason: engagementNotes.join(' · '),
    },
  ];

  let qualificationLabel: QualificationLabel = 'Disqualified';
  if (lead.emailStatus === 'invalid') {
    qualificationLabel = 'Needs review';
  } else if (total >= rules.qualifiedThreshold && !lead.ambiguousIdentityFlag) {
    qualificationLabel = 'Qualified';
  } else if (total >= rules.reviewThreshold || lead.ambiguousIdentityFlag) {
    qualificationLabel = 'Needs review';
  }

  return {
    scoreTotal: total,
    scoreBreakdown: {
      companyFit,
      roleFit,
      buyingSignals,
      engagement,
      total,
      factors,
    },
    qualificationLabel,
    dataCoveragePct: computeDataCoveragePct(lead),
  };
}

export function explainLeadRanking(lead: LeadRecord): ScoreExplanationBlock {
  const reconciledSum = lead.scoreBreakdown.factors.reduce((acc, f) => acc + f.points, 0);
  const topSignal = lead.signals[0];
  const signalText = topSignal
    ? `Its strongest dated signal is "${topSignal.title}" (${topSignal.eventDate}, source: ${topSignal.sourceName}).`
    : 'No recent dated signal was recorded.';

  const summaryText = `${lead.contactName} (${lead.contactTitle}) at ${lead.companyName} (${lead.companyHqCity}, ${lead.companyHqState}) ranked highest with ${lead.scoreTotal}/100 (${lead.qualificationLabel}). Factor totals reconcile exactly: ${lead.scoreBreakdown.companyFit} Company Fit + ${lead.scoreBreakdown.roleFit} Role Fit + ${lead.scoreBreakdown.buyingSignals} Buying Signals + ${lead.scoreBreakdown.engagement} Engagement = ${reconciledSum}. ${signalText} Work email (${lead.workEmail}) is ${lead.emailStatus} via ${lead.emailProvider}.`;

  return {
    leadId: lead.id,
    leadName: lead.contactName,
    companyName: lead.companyName,
    scoreTotal: lead.scoreTotal,
    qualificationLabel: lead.qualificationLabel,
    reconciledSum,
    summaryText,
    factors: lead.scoreBreakdown.factors,
  };
}

export function filterCampaignLeads(
  leads: LeadRecord[],
  filters: ExtractedFilters
): { matched: LeadRecord[]; excludedCustomers: LeadRecord[] } {
  const excludedCustomers: LeadRecord[] = [];
  const matched: LeadRecord[] = [];

  for (const lead of leads) {
    if (filters.excludeHubSpotCustomers && lead.isExistingHubSpotCustomer) {
      excludedCustomers.push(lead);
      continue;
    }

    if (filters.industry && filters.industry.toLowerCase() !== 'all') {
      const want = filters.industry.toLowerCase();
      const got = lead.industry.toLowerCase();
      const keyToken = want.split(' ')[0];
      if (!got.includes(keyToken) && !want.includes(got.split(' ')[0])) {
        continue;
      }
    }

    if (filters.companyHqLocation) {
      const wantLoc = filters.companyHqLocation.toLowerCase();
      const hqBlob = `${lead.companyHqCity} ${lead.companyHqState} ${lead.companyHqCountry}`.toLowerCase();
      const locTokens = wantLoc
        .split(/[,/]|\band\b/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (locTokens.length > 0 && !locTokens.some((tok) => hqBlob.includes(tok))) {
        continue;
      }
    }

    if (filters.cityFilter) {
      const wantCity = filters.cityFilter.toLowerCase();
      if (!lead.companyHqCity.toLowerCase().includes(wantCity)) {
        continue;
      }
    }

    if (filters.minEmployees !== null && lead.employeeCount !== null && lead.employeeCount < filters.minEmployees) {
      continue;
    }
    if (filters.maxEmployees !== null && lead.employeeCount !== null && lead.employeeCount > filters.maxEmployees) {
      continue;
    }

    if (filters.verifiedEmailOnly && lead.emailStatus !== 'valid') {
      continue;
    }

    matched.push(lead);
  }

  return { matched, excludedCustomers };
}

export function computeConversionFunnel(leads: LeadRecord[]): ConversionFunnelMetrics {
  const found = leads.length;
  const qualified = leads.filter((l) => l.qualificationLabel === 'Qualified').length;
  const contacted = leads.filter((l) =>
    l.engagementEvents.some((e) => e.type === 'contacted')
  ).length;
  const replied = leads.filter((l) =>
    l.engagementEvents.some((e) => e.type === 'replied')
  ).length;
  const meetingsBooked = leads.filter((l) =>
    l.engagementEvents.some((e) => e.type === 'meeting_booked')
  ).length;
  const opportunities = leads.filter((l) =>
    l.engagementEvents.some((e) => e.type === 'opportunity')
  ).length;

  const rate = (num: number, den: number) => ({
    numerator: num,
    denominator: den,
    pct: den > 0 ? Math.round((num / den) * 1000) / 10 : 0,
  });

  return {
    found,
    qualified,
    contacted,
    replied,
    meetingsBooked,
    opportunities,
    qualifiedRate: rate(qualified, found),
    contactedRate: rate(contacted, qualified),
    replyRate: rate(replied, contacted),
    meetingRate: rate(meetingsBooked, replied || contacted),
    opportunityRate: rate(opportunities, meetingsBooked || qualified),
  };
}

export interface ParsedChatCommand {
  filters: ExtractedFilters;
  oneSentenceSummary: string;
  isFollowUpRefinement: boolean;
  explainTopLead: boolean;
  explainLeadQuery: string | null;
  requestedExportFormat: ExportFormat | null;
  unsupportedExportFormat: string | null;
  requestedExportLimit: number | null;
  teamEmailRecipients: string[];
  draftProspectOutreach: boolean;
  triggerCrmSync: boolean;
  triggerInboundFranchiseFlow: boolean;
  saveSearchName: string | null;
  clarifyingQuestion: string | null;
}

export function parseChatCommand(
  prompt: string,
  baseFilters: ExtractedFilters,
  hasPriorResults: boolean
): ParsedChatCommand {
  const lower = prompt.toLowerCase();
  const next: ExtractedFilters = {
    ...baseFilters,
    buyerRoles: [...baseFilters.buyerRoles],
    exclusions: [...baseFilters.exclusions],
    buyingSignalKeywords: [...baseFilters.buyingSignalKeywords],
  };

  // Detect follow-up refinement vs brand-new discovery
  const isFollowUpRefinement =
    hasPriorResults &&
    /\b(keep only|filter to|narrow|only |why did|why this|export|draft an email|email this|sync|remove|exclude)\b/i.test(
      prompt
    ) &&
    !/\bfind up to\b/i.test(prompt);

  // Target count ("up to 25")
  const countMatch = prompt.match(/(?:up to|find|top)\s+(\d{1,3})\b/i);
  let requestedExportLimit: number | null = null;
  if (countMatch) {
    const n = Number(countMatch[1]);
    if (lower.includes('export') && /top\s+(\d{1,3})/i.test(prompt)) {
      const topExport = prompt.match(/top\s+(\d{1,3})/i);
      if (topExport) requestedExportLimit = Number(topExport[1]);
    } else if (!isFollowUpRefinement) {
      next.targetCount = n;
    }
  }
  const explicitTopExport = prompt.match(/export(?:\s+the)?\s+top\s+(\d{1,3})/i);
  if (explicitTopExport) {
    requestedExportLimit = Number(explicitTopExport[1]);
  }

  // Employee range ("50-500" or "50–500")
  const empMatch = prompt.match(/(\d{1,4})\s*[-–to]+\s*(\d{1,5})\s*employees?/i);
  if (empMatch) {
    next.minEmployees = Number(empMatch[1]);
    next.maxEmployees = Number(empMatch[2]);
  }

  // Industry detection
  if (lower.includes('packaging')) {
    next.industry = 'Packaging Manufacturing';
    next.icpName = 'Packaging Manufacturers';
  } else if (lower.includes('franchise') || lower.includes('retail')) {
    next.industry = 'Retail Franchise';
    next.icpName = 'Opted-in Retail Franchise Inquiries';
  } else if (lower.includes('fintech') || lower.includes('payments')) {
    next.industry = 'B2B FinTech';
    next.icpName = 'Mid-Market FinTech';
  } else if (lower.includes('pharma') || lower.includes('healthcare')) {
    next.industry = 'Pharmaceuticals & Healthcare';
  }

  // Company HQ vs Contact location
  const hqMatch = prompt.match(/headquartered in\s+([A-Za-z\s]+?)(?:\s+with|\.|,|$)/i);
  if (hqMatch) {
    next.companyHqLocation = hqMatch[1].trim();
    next.cityFilter = null;
  }
  const cityHqMatch = prompt.match(/\b(pune|mumbai|bengaluru|bangalore|nashik|aurangabad|thane|delhi|hyderabad|chennai)[\s-]+headquartered\b/i);
  if (cityHqMatch) {
    next.cityFilter = cityHqMatch[1].charAt(0).toUpperCase() + cityHqMatch[1].slice(1).toLowerCase();
  } else if (lower.includes('only pune') || lower.includes('in pune')) {
    next.cityFilter = 'Pune';
  }

  // Buyer roles
  if (lower.includes('heads of operations') || lower.includes('head of operations')) {
    next.buyerRoles = ['Head of Operations', 'VP Operations', 'Plant Operations Director'];
  } else if (lower.includes('vp engineering') || lower.includes('cto')) {
    next.buyerRoles = ['VP Engineering', 'CTO'];
  } else if (lower.includes('franchise')) {
    next.buyerRoles = ['Franchise Partner', 'Managing Director', 'Business Owner'];
  }

  // Buying signals & window
  const windowMatch = prompt.match(/last\s+(\d{1,3})\s+days/i);
  if (windowMatch) {
    next.signalWindowDays = Number(windowMatch[1]);
  }
  if (lower.includes('production hiring') || lower.includes('hiring notice')) {
    next.buyingSignalKeywords = ['production', 'hiring', 'plant', 'shift'];
  } else if (lower.includes('funding')) {
    next.buyingSignalKeywords = ['funding', 'series', 'expansion'];
  }

  // Exclusions
  if (lower.includes('exclude') && (lower.includes('hubspot') || lower.includes('customer'))) {
    next.excludeHubSpotCustomers = true;
    if (!next.exclusions.includes('Existing HubSpot customers')) {
      next.exclusions.push('Existing HubSpot customers');
    }
  }

  // Verified email only
  if (lower.includes('verified work email') || lower.includes('verified email')) {
    next.verifiedEmailOnly = true;
  }

  // Export format detection (including unsupported format check)
  let requestedExportFormat: ExportFormat | null = null;
  let unsupportedExportFormat: string | null = null;
  if (/\bexcel\b|\bxlsx\b/i.test(prompt)) {
    requestedExportFormat = 'xlsx';
    next.requestedOutput = 'Excel (.xlsx)';
  } else if (/\bcsv\b/i.test(prompt)) {
    requestedExportFormat = 'csv';
    next.requestedOutput = 'CSV';
  } else if (/\bparquet\b/i.test(prompt)) {
    requestedExportFormat = 'parquet';
    next.requestedOutput = 'Parquet';
  } else if (/\bpdf\b/i.test(prompt)) {
    requestedExportFormat = 'pdf';
    next.requestedOutput = 'PDF Brief';
  } else if (/\bjson\b/i.test(prompt)) {
    requestedExportFormat = 'json';
    next.requestedOutput = 'JSON';
  } else if (/google sheet/i.test(prompt)) {
    requestedExportFormat = 'google_sheet';
    next.requestedOutput = 'Google Sheet';
  } else {
    const unknownFmt = prompt.match(/export(?:\s+to|\s+as)?\s+(xml|yaml|pptx|powerpoint|docx|word|avro|orc)\b/i);
    if (unknownFmt) {
      unsupportedExportFormat = unknownFmt[1].toUpperCase();
    }
  }

  // Team email recipients
  const emailMatches = prompt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
  const teamEmailRecipients =
    /\b(email|send|draft|share)\b/i.test(prompt) ? Array.from(new Set(emailMatches)) : [];
  if (
    teamEmailRecipients.length === 0 &&
    /email this list to my team/i.test(prompt)
  ) {
    teamEmailRecipients.push('sales@example.com');
  }

  const draftProspectOutreach =
    /draft outreach for (these|selected) leads/i.test(prompt) ||
    /personalize outreach/i.test(prompt);

  const explainTopLead =
    /why did the first lead rank highest/i.test(prompt) ||
    /why (is|did) .* rank (highest|first|#1)/i.test(prompt) ||
    /explain (the )?(top|first) lead/i.test(prompt);

  const whyLeadMatch = prompt.match(/why (?:this lead|lead)\s+([a-zA-Z\s]+)\??/i);
  const explainLeadQuery = whyLeadMatch ? whyLeadMatch[1].trim() : null;

  const triggerCrmSync =
    /\bsync\b.*\b(hubspot|crm|salesforce)\b/i.test(prompt) ||
    /hand off.*crm/i.test(prompt);

  const triggerInboundFranchiseFlow =
    lower.includes('franchise') && (lower.includes('inbound') || lower.includes('import') || lower.includes('dedup'));

  const saveSearchMatch = prompt.match(/save (?:this )?search(?: as ["']?([^"']+)["']?)?/i);
  const saveSearchName = saveSearchMatch
    ? (saveSearchMatch[1]?.trim() || `${next.industry} — ${next.cityFilter || next.companyHqLocation}`)
    : null;

  // Ask ONE focused clarifying question only when missing answer changes the work
  let clarifyingQuestion: string | null = null;
  const isVeryVague =
    !isFollowUpRefinement &&
    !triggerInboundFranchiseFlow &&
    !explainTopLead &&
    !requestedExportFormat &&
    !triggerCrmSync &&
    prompt.trim().split(/\s+/).length < 6 &&
    !lower.includes('packaging') &&
    !lower.includes('maharashtra') &&
    !lower.includes('pune') &&
    !lower.includes('franchise');

  if (isVeryVague) {
    clarifyingQuestion =
      'Which target industry and headquarters geography should I search (or would you like to upload an opted-in CSV/Excel list)?';
  }

  // Build crisp 1-sentence summary
  const locLabel = next.cityFilter
    ? `${next.cityFilter}-headquartered`
    : next.companyHqLocation
    ? `headquartered in ${next.companyHqLocation}`
    : 'all headquarters locations';
  const empLabel =
    next.minEmployees !== null && next.maxEmployees !== null
      ? `${next.minEmployees}–${next.maxEmployees} employees`
      : 'all company sizes';
  const roleLabel =
    next.buyerRoles.length > 0 ? next.buyerRoles[0] : 'target decision makers';
  const extras: string[] = [];
  if (next.verifiedEmailOnly) extras.push('verified work emails only');
  if (next.buyingSignalKeywords.length > 0) {
    extras.push(`prioritizing ${next.buyingSignalKeywords.slice(0, 2).join(' ')} signals in the last ${next.signalWindowDays} days`);
  }
  if (next.excludeHubSpotCustomers) extras.push('excluding existing HubSpot customers');

  const oneSentenceSummary = isFollowUpRefinement
    ? `Refining the active campaign selection to ${locLabel} ${next.industry} leads (${extras.join(', ') || 'current filters'}).`
    : `Searching up to ${next.targetCount} ${roleLabel} contacts at ${next.industry} companies ${locLabel} (${empLabel})${extras.length ? `, ${extras.join(', ')}` : ''}.`;

  return {
    filters: next,
    oneSentenceSummary,
    isFollowUpRefinement,
    explainTopLead,
    explainLeadQuery,
    requestedExportFormat,
    unsupportedExportFormat,
    requestedExportLimit,
    teamEmailRecipients,
    draftProspectOutreach,
    triggerCrmSync,
    triggerInboundFranchiseFlow,
    saveSearchName,
    clarifyingQuestion,
  };
}
