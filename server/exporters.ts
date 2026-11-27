import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { parquetWriteBuffer } from 'hyparquet-writer';
import type {
  Campaign,
  ExportArtifact,
  ExportFormat,
  ExtractedFilters,
  LeadRecord,
} from '../src/types/gtm';

export const EXPORT_ROOT_DIR = path.resolve(process.cwd(), 'data', 'exports');

export const DEFAULT_EXPORT_COLUMNS = [
  'lead_id',
  'companyName',
  'contactName',
  'contactTitle',
  'companyHqCity',
  'companyHqState',
  'employeeCount',
  'workEmail',
  'emailStatus',
  'emailProvider',
  'scoreTotal',
  'qualificationLabel',
  'strongestSignal',
  'signalSource',
  'signalDate',
  'owner',
  'crmStage',
  'acquisitionSource',
];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getLeadColumnValue(lead: LeadRecord, col: string): string | number {
  const topSignal = lead.signals[0];
  switch (col) {
    case 'lead_id':
      return lead.id;
    case 'companyName':
      return lead.companyName;
    case 'companyDomain':
      return lead.companyDomain;
    case 'contactName':
      return lead.contactName;
    case 'contactTitle':
      return lead.contactTitle;
    case 'companyHqCity':
      return lead.companyHqCity;
    case 'companyHqState':
      return lead.companyHqState;
    case 'contactLocation':
      return lead.contactLocation;
    case 'employeeCount':
      return lead.employeeCount ?? '';
    case 'workEmail':
      return lead.workEmail;
    case 'emailStatus':
      return lead.emailStatus;
    case 'emailProvider':
      return lead.emailProvider;
    case 'emailVerifiedAt':
      return lead.emailVerifiedAt;
    case 'scoreTotal':
      return lead.scoreTotal;
    case 'qualificationLabel':
      return lead.qualificationLabel;
    case 'dataCoveragePct':
      return lead.dataCoveragePct;
    case 'strongestSignal':
      return topSignal?.title ?? '';
    case 'signalSource':
      return topSignal?.sourceName ?? '';
    case 'signalDate':
      return topSignal?.eventDate ?? '';
    case 'owner':
      return lead.owner;
    case 'territory':
      return lead.territory;
    case 'crmStage':
      return lead.crmStage;
    case 'crmRecordId':
      return lead.crmRecordId ?? '';
    case 'acquisitionSource':
      return lead.acquisitionSource;
    default:
      return lead.customFieldValues[col] ?? '';
  }
}

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function generateExportArtifact(params: {
  workspaceId: string;
  campaign: Campaign;
  runId: string | null;
  leads: LeadRecord[];
  format: ExportFormat;
  columns?: string[];
  filters: ExtractedFilters;
  fileBaseName?: string;
}): Promise<{ artifact: ExportArtifact; filePath: string | null }> {
  const { workspaceId, campaign, runId, leads, format, filters } = params;
  const cols =
    params.columns && params.columns.length > 0
      ? params.columns
      : DEFAULT_EXPORT_COLUMNS;

  const wsDir = path.join(EXPORT_ROOT_DIR, workspaceId);
  ensureDir(wsDir);

  const exportId = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const slug = (params.fileBaseName || campaign.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  const nowIso = new Date().toISOString();

  // Build city summary for Campaign Summary sheet (useful for both outbound & inbound retail franchise)
  const cityMap = new Map<string, { city: string; count: number; qualified: number; owners: Set<string>; crmSynced: number }>();
  for (const lead of leads) {
    const city = lead.companyHqCity || 'Unknown';
    const curr = cityMap.get(city) ?? {
      city,
      count: 0,
      qualified: 0,
      owners: new Set<string>(),
      crmSynced: 0,
    };
    curr.count += 1;
    if (lead.qualificationLabel === 'Qualified') curr.qualified += 1;
    if (lead.owner) curr.owners.add(lead.owner);
    if (lead.crmRecordId) curr.crmSynced += 1;
    cityMap.set(city, curr);
  }
  const citySummaryRows = Array.from(cityMap.values()).map((c) => ({
    City: c.city,
    LeadCount: c.count,
    QualifiedCount: c.qualified,
    CrmSyncedCount: c.crmSynced,
    AssignedOwners: Array.from(c.owners).join(', '),
  }));

  if (format === 'xlsx') {
    const fileName = `${slug}-${leads.length}leads-${exportId.slice(-4)}.xlsx`;
    const filePath = path.join(wsDir, fileName);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Leads
    const leadSheetRows = leads.map((lead) => {
      const row: Record<string, string | number> = {};
      for (const col of cols) {
        row[col] = getLeadColumnValue(lead, col);
      }
      return row;
    });
    const leadsSheet = XLSX.utils.json_to_sheet(
      leadSheetRows.length > 0 ? leadSheetRows : [{ Notice: 'No matching leads' }]
    );
    XLSX.utils.book_append_sheet(wb, leadsSheet, 'Leads');

    // Sheet 2: Evidence (linked by lead_id)
    const evidenceRows: Record<string, string | number>[] = [];
    for (const lead of leads) {
      if (lead.signals.length === 0) {
        evidenceRows.push({
          lead_id: lead.id,
          companyName: lead.companyName,
          contactName: lead.contactName,
          signalType: 'None',
          signalTitle: 'No dated signals recorded',
          sourceName: lead.acquisitionSource,
          sourceUrlOrId: lead.sources[0]?.recordId ?? '',
          eventDate: lead.discoveredAt,
          observedAt: nowIso,
          companyFitPoints: lead.scoreBreakdown.companyFit,
          roleFitPoints: lead.scoreBreakdown.roleFit,
          buyingSignalsPoints: lead.scoreBreakdown.buyingSignals,
          engagementPoints: lead.scoreBreakdown.engagement,
          totalScore: lead.scoreTotal,
        });
      } else {
        for (const sig of lead.signals) {
          evidenceRows.push({
            lead_id: lead.id,
            companyName: lead.companyName,
            contactName: lead.contactName,
            signalType: sig.type,
            signalTitle: sig.title,
            sourceName: sig.sourceName,
            sourceUrlOrId: sig.sourceUrlOrId,
            eventDate: sig.eventDate,
            observedAt: sig.observedAt,
            companyFitPoints: lead.scoreBreakdown.companyFit,
            roleFitPoints: lead.scoreBreakdown.roleFit,
            buyingSignalsPoints: lead.scoreBreakdown.buyingSignals,
            engagementPoints: lead.scoreBreakdown.engagement,
            totalScore: lead.scoreTotal,
          });
        }
      }
    }
    const evidenceSheet = XLSX.utils.json_to_sheet(
      evidenceRows.length > 0 ? evidenceRows : [{ lead_id: '', Notice: 'No evidence rows' }]
    );
    XLSX.utils.book_append_sheet(wb, evidenceSheet, 'Evidence');

    // Sheet 3: Campaign Summary
    const summaryRows: Record<string, string | number>[] = [
      { Metric: 'Campaign Name', Value: campaign.name },
      { Metric: 'Campaign Mode', Value: campaign.mode },
      { Metric: 'Exported At (UTC)', Value: nowIso },
      { Metric: 'Exported Lead Count', Value: leads.length },
      { Metric: 'Qualified Leads', Value: leads.filter((l) => l.qualificationLabel === 'Qualified').length },
      { Metric: 'Verified Work Emails', Value: leads.filter((l) => l.emailStatus === 'valid').length },
      { Metric: 'Industry Filter', Value: filters.industry || 'All' },
      { Metric: 'HQ Geography Filter', Value: filters.cityFilter || filters.companyHqLocation || 'All' },
      { Metric: 'Employee Range', Value: filters.minEmployees !== null && filters.maxEmployees !== null ? `${filters.minEmployees}-${filters.maxEmployees}` : 'All' },
      { Metric: 'Signal Window (Days)', Value: filters.signalWindowDays },
      { Metric: 'HubSpot Customer Exclusion', Value: filters.excludeHubSpotCustomers ? 'Enabled' : 'Disabled' },
      { Metric: '--- City Breakdown ---', Value: '' },
      ...citySummaryRows.map((c) => ({
        Metric: `${c.City} (${c.AssignedOwners})`,
        Value: `${c.LeadCount} leads · ${c.QualifiedCount} qualified · ${c.CrmSyncedCount} CRM synced`,
      })),
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Campaign Summary');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    fs.writeFileSync(filePath, buffer);

    return {
      filePath,
      artifact: {
        id: exportId,
        workspaceId,
        campaignId: campaign.id,
        runId,
        format: 'xlsx',
        fileName,
        rowCount: leads.length,
        columns: cols,
        leadIdsSnapshot: leads.map((l) => l.id),
        filtersSnapshot: filters,
        createdAt: nowIso,
        downloadUrl: `/api/exports/${exportId}/download`,
        summaryNote: `Excel workbook with 3 sheets (Leads, Evidence linked by lead_id, Campaign Summary) — ${leads.length} rows.`,
        sheetsIncluded: ['Leads', 'Evidence', 'Campaign Summary'],
      },
    };
  }

  if (format === 'csv') {
    const fileName = `${slug}-${leads.length}leads-${exportId.slice(-4)}.csv`;
    const filePath = path.join(wsDir, fileName);
    const header = cols.map(escapeCsvCell).join(',');
    const body = leads
      .map((lead) => cols.map((c) => escapeCsvCell(getLeadColumnValue(lead, c))).join(','))
      .join('\n');
    fs.writeFileSync(filePath, `${header}\n${body}\n`, 'utf-8');

    return {
      filePath,
      artifact: {
        id: exportId,
        workspaceId,
        campaignId: campaign.id,
        runId,
        format: 'csv',
        fileName,
        rowCount: leads.length,
        columns: cols,
        leadIdsSnapshot: leads.map((l) => l.id),
        filtersSnapshot: filters,
        createdAt: nowIso,
        downloadUrl: `/api/exports/${exportId}/download`,
        summaryNote: `RFC-4180 CSV snapshot with ${cols.length} columns and ${leads.length} rows.`,
      },
    };
  }

  if (format === 'json') {
    const fileName = `${slug}-${leads.length}leads-${exportId.slice(-4)}.json`;
    const filePath = path.join(wsDir, fileName);
    const payload = {
      exportId,
      campaign: campaign.name,
      exportedAt: nowIso,
      rowCount: leads.length,
      filters,
      citySummary: citySummaryRows,
      leads: leads.map((lead) => {
        const row: Record<string, unknown> = {};
        for (const c of cols) row[c] = getLeadColumnValue(lead, c);
        row.signals = lead.signals;
        row.scoreBreakdown = lead.scoreBreakdown;
        return row;
      }),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');

    return {
      filePath,
      artifact: {
        id: exportId,
        workspaceId,
        campaignId: campaign.id,
        runId,
        format: 'json',
        fileName,
        rowCount: leads.length,
        columns: cols,
        leadIdsSnapshot: leads.map((l) => l.id),
        filtersSnapshot: filters,
        createdAt: nowIso,
        downloadUrl: `/api/exports/${exportId}/download`,
        summaryNote: `Structured JSON snapshot including leads, score breakdowns, and dated evidence (${leads.length} rows).`,
      },
    };
  }

  if (format === 'parquet') {
    const fileName = `${slug}-${leads.length}leads-${exportId.slice(-4)}.parquet`;
    const filePath = path.join(wsDir, fileName);

    const columnData = cols.map((col) => {
      if (col === 'scoreTotal' || col === 'employeeCount' || col === 'dataCoveragePct') {
        return {
          name: col,
          type: 'INT32' as const,
          data: leads.map((l) => {
            const v = getLeadColumnValue(l, col);
            return typeof v === 'number' ? v : 0;
          }),
        };
      }
      return {
        name: col,
        type: 'STRING' as const,
        data: leads.map((l) => String(getLeadColumnValue(l, col) ?? '')),
      };
    });

    const arrayBuffer = parquetWriteBuffer({ columnData });
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

    return {
      filePath,
      artifact: {
        id: exportId,
        workspaceId,
        campaignId: campaign.id,
        runId,
        format: 'parquet',
        fileName,
        rowCount: leads.length,
        columns: cols,
        leadIdsSnapshot: leads.map((l) => l.id),
        filtersSnapshot: filters,
        createdAt: nowIso,
        downloadUrl: `/api/exports/${exportId}/download`,
        summaryNote: `Apache Parquet columnar binary (${cols.length} columns, ${leads.length} rows) ready for Snowflake, BigQuery, or OneLake.`,
      },
    };
  }

  if (format === 'pdf') {
    const fileName = `${slug}-brief-${leads.length}leads-${exportId.slice(-4)}.pdf`;
    const filePath = path.join(wsDir, fileName);

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(18).fillColor('#0F172A').text(`SignalStack GTM — Campaign Brief`);
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#475569').text(`Campaign: ${campaign.name} (${campaign.mode.toUpperCase()})`);
      doc.text(`Generated: ${nowIso} | Total Exported Leads: ${leads.length}`);
      doc.text(`Filters: ${filters.industry || 'All'} | HQ: ${filters.cityFilter || filters.companyHqLocation || 'All'} | Signal Window: ${filters.signalWindowDays} days`);
      doc.moveDown(0.8);

      doc.fontSize(13).fillColor('#0F766E').text('City & Territory Summary');
      doc.moveDown(0.3);
      for (const c of citySummaryRows) {
        doc.fontSize(10).fillColor('#0F172A').text(`• ${c.City}: ${c.LeadCount} leads (${c.QualifiedCount} qualified, ${c.CrmSyncedCount} CRM synced) — Owners: ${c.AssignedOwners}`);
      }
      doc.moveDown(0.8);

      doc.fontSize(13).fillColor('#0F766E').text('Ranked Leads & Supporting Evidence');
      doc.moveDown(0.4);
      leads.slice(0, 20).forEach((lead, idx) => {
        const sig = lead.signals[0];
        doc
          .fontSize(11)
          .fillColor('#0F172A')
          .text(`${idx + 1}. ${lead.contactName} — ${lead.contactTitle} at ${lead.companyName} (${lead.companyHqCity}) | Score: ${lead.scoreTotal}/100 (${lead.qualificationLabel})`);
        doc
          .fontSize(9.5)
          .fillColor('#334155')
          .text(`   Email: ${lead.workEmail} (${lead.emailStatus} via ${lead.emailProvider}) | Owner: ${lead.owner} | Stage: ${lead.crmStage}`);
        if (sig) {
          doc.text(`   Signal (${sig.eventDate}): ${sig.title} — Source: ${sig.sourceName} (${sig.sourceUrlOrId})`);
        }
        doc.text(`   Brief: ${lead.companyBrief}`);
        doc.moveDown(0.45);
      });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return {
      filePath,
      artifact: {
        id: exportId,
        workspaceId,
        campaignId: campaign.id,
        runId,
        format: 'pdf',
        fileName,
        rowCount: leads.length,
        columns: cols,
        leadIdsSnapshot: leads.map((l) => l.id),
        filtersSnapshot: filters,
        createdAt: nowIso,
        downloadUrl: `/api/exports/${exportId}/download`,
        summaryNote: `Executive PDF campaign brief covering city breakdown, scores, and dated evidence (${leads.length} rows).`,
      },
    };
  }

  // Google Sheet snapshot (also stores CSV backup locally so user can always download)
  const fileName = `${slug}-google-sheet-${leads.length}leads-${exportId.slice(-4)}.csv`;
  const filePath = path.join(wsDir, fileName);
  const header = cols.map(escapeCsvCell).join(',');
  const body = leads
    .map((lead) => cols.map((c) => escapeCsvCell(getLeadColumnValue(lead, c))).join(','))
    .join('\n');
  fs.writeFileSync(filePath, `${header}\n${body}\n`, 'utf-8');

  return {
    filePath,
    artifact: {
      id: exportId,
      workspaceId,
      campaignId: campaign.id,
      runId,
      format: 'google_sheet',
      fileName: `${campaign.name} (Google Sheet)`,
      rowCount: leads.length,
      columns: cols,
      leadIdsSnapshot: leads.map((l) => l.id),
      filtersSnapshot: filters,
      createdAt: nowIso,
      downloadUrl: `/api/exports/${exportId}/download`,
      externalUrl: `https://docs.google.com/spreadsheets/d/signalstack-${exportId}/edit`,
      summaryNote: `Synced ${leads.length} rows preserving selected column order to Google Sheets (CSV snapshot also downloadable).`,
    },
  };
}

export function parseUploadedSpreadsheet(
  buffer: Buffer,
  originalName: string
): Record<string, string>[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = wb.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rawRows.map((row) => {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      clean[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
    }
    clean._source_file = originalName;
    return clean;
  });
}
