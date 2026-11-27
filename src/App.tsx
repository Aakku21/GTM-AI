import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import type {
  CampaignTemplate,
  EmailDraft,
  ExportFormat,
  ExtractedFilters,
  LeadEngagementEvent,
  MailboxAccount,
  NavSection,
  SavedSearch,
  Workspace,
  WorkspaceSnapshotPayload,
} from './types/gtm';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatThreadView } from './components/ChatThreadView';
import { LeadDetailsPanel } from './components/LeadDetailsPanel';
import { EmailDraftDrawer } from './components/EmailDraftDrawer';
import { CampaignWorkflowTab } from './components/CampaignWorkflowTab';
import { IntegrationsView } from './components/IntegrationsView';
import { SettingsView } from './components/SettingsView';
import { TasksMeasurementView } from './components/TasksMeasurementView';
import { GtmBrandMark } from './components/BrandMarks';

const ACTIVE_WS_STORAGE = 'signalstack-active-workspace-v2';

export default function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshotPayload | null>(null);
  const [activeNav, setActiveNav] = useState<NavSection>('chat');
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini:gemini-4-hydrogen');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async (workspaceId?: string) => {
    try {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const resp = await fetch(`/api/state${qs}`);
      if (!resp.ok) throw new Error('Failed to load workspace state');
      const data = (await resp.json()) as WorkspaceSnapshotPayload;
      setSnapshot(data);
      localStorage.setItem(ACTIVE_WS_STORAGE, data.activeWorkspace.id);
      setSelectedModel(`${data.activeWorkspace.aiProvider}:${data.activeWorkspace.aiModel}`);
      setActiveThreadId((curr) =>
        data.threads.some((t) => t.id === curr)
          ? curr
          : data.threads[0]?.id ?? ''
      );
      setActiveDraftId(null);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach server.');
    }
  }, []);

  useEffect(() => {
    const savedWs = localStorage.getItem(ACTIVE_WS_STORAGE) ?? undefined;
    loadWorkspace(savedWs);
  }, [loadWorkspace]);

  const activeThread = useMemo(() => {
    if (!snapshot) return null;
    return (
      snapshot.threads.find((t) => t.id === activeThreadId) ??
      snapshot.threads[0] ??
      null
    );
  }, [snapshot, activeThreadId]);

  const activeCampaign = useMemo(() => {
    if (!snapshot) return null;
    const targetId = activeThread?.campaignId;
    return (
      snapshot.campaigns.find((c) => c.id === targetId) ??
      snapshot.campaigns[0] ??
      null
    );
  }, [snapshot, activeThread]);

  const activeDetailLead = useMemo(() => {
    if (!snapshot || !activeThread?.activeLeadId) return null;
    return snapshot.leads.find((l) => l.id === activeThread.activeLeadId) ?? null;
  }, [snapshot, activeThread]);

  const threadDrafts = useMemo<EmailDraft[]>(() => {
    if (!snapshot || !activeThread) return [];
    const ids = activeThread.messages.flatMap((m) => m.draftIds ?? []);
    const uniqueIds = Array.from(new Set(ids));
    return uniqueIds
      .map((id) => snapshot.drafts.find((d) => d.id === id))
      .filter((x): x is EmailDraft => Boolean(x));
  }, [snapshot, activeThread]);

  const activeDrawerDraft = useMemo(() => {
    if (!activeDraftId) return null;
    return threadDrafts.find((d) => d.id === activeDraftId) ?? null;
  }, [threadDrafts, activeDraftId]);

  const availableMailboxes = useMemo<MailboxAccount[]>(() => {
    if (!snapshot) return [];
    return snapshot.integrations
      .filter((i) => i.status === 'connected' && i.mailboxes.length > 0)
      .flatMap((i) => i.mailboxes);
  }, [snapshot]);

  const persistThreadState = async (
    threadId: string,
    patch: { selectedLeadIds?: string[]; activeLeadId?: string | null; campaignId?: string }
  ) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        threads: prev.threads.map((t) =>
          t.id === threadId ? { ...t, ...patch } : t
        ),
      };
    });
    await fetch(`/api/threads/${encodeURIComponent(threadId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  };

  const focusNewestDraftIfPresent = (
    nextSnapshot: WorkspaceSnapshotPayload,
    threadId: string,
    prevDraftIds: Set<string>
  ) => {
    const thread = nextSnapshot.threads.find((t) => t.id === threadId);
    if (!thread) return;
    const allIds = thread.messages.flatMap((m) => m.draftIds ?? []);
    const newest = [...allIds].reverse().find((id) => !prevDraftIds.has(id));
    if (newest) {
      setActiveDraftId(newest);
      if (thread.activeLeadId) {
        persistThreadState(threadId, { activeLeadId: null });
      }
    }
  };

  const handleNewChat = async () => {
    if (!snapshot) return;
    const resp = await fetch('/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: snapshot.activeWorkspace.id,
        campaignId: activeCampaign?.id,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
      setActiveThreadId(data.thread.id);
      setActiveDraftId(null);
      setActiveNav('chat');
    }
  };

  const handleSendPrompt = async (prompt: string) => {
    if (!snapshot || !activeThread || !activeCampaign) return;
    const prevDraftIds = new Set(threadDrafts.map((d) => d.id));
    setIsSending(true);
    try {
      const resp = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: snapshot.activeWorkspace.id,
          threadId: activeThread.id,
          campaignId: activeCampaign.id,
          prompt,
          selectedLeadIds: activeThread.selectedLeadIds,
          modelLabel: selectedModel,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setSnapshot(data.snapshot);
        focusNewestDraftIfPresent(data.snapshot, activeThread.id, prevDraftIds);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!snapshot || !activeThread || !activeCampaign) return;
    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', snapshot.activeWorkspace.id);
      formData.append('campaignId', activeCampaign.id);
      formData.append('threadId', activeThread.id);
      const resp = await fetch('/api/uploads/import', {
        method: 'POST',
        body: formData,
      });
      if (resp.ok) {
        const data = await resp.json();
        setSnapshot(data.snapshot);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleControlRun = async (runId: string, action: 'pause' | 'cancel' | 'resume') => {
    const resp = await fetch(`/api/runs/${encodeURIComponent(runId)}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
    }
  };

  const handleExportLeads = async (
    format: ExportFormat,
    leadIds: string[],
    columns: string[]
  ) => {
    if (!snapshot || !activeThread || !activeCampaign) return;
    const resp = await fetch('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: snapshot.activeWorkspace.id,
        campaignId: activeCampaign.id,
        threadId: activeThread.id,
        format,
        leadIds,
        columns,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
    }
  };

  const handleEmailTeam = async (leadIds: string[]) => {
    if (!snapshot || !activeThread || !activeCampaign) return;
    const prevDraftIds = new Set(threadDrafts.map((d) => d.id));
    const expResp = await fetch('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: snapshot.activeWorkspace.id,
        campaignId: activeCampaign.id,
        format: 'xlsx',
        leadIds,
      }),
    });
    const expData = expResp.ok ? await expResp.json() : null;
    const resp = await fetch('/api/drafts/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: snapshot.activeWorkspace.id,
        campaignId: activeCampaign.id,
        threadId: activeThread.id,
        recipients: ['sales@example.com'],
        exportArtifactId: expData?.artifact?.id ?? null,
        leadIds,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
      focusNewestDraftIfPresent(data.snapshot, activeThread.id, prevDraftIds);
    }
  };

  const handleDraftProspects = async (leadIds: string[]) => {
    if (!snapshot || !activeThread || !activeCampaign) return;
    const prevDraftIds = new Set(threadDrafts.map((d) => d.id));
    const resp = await fetch('/api/drafts/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: snapshot.activeWorkspace.id,
        campaignId: activeCampaign.id,
        threadId: activeThread.id,
        leadIds,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
      focusNewestDraftIfPresent(data.snapshot, activeThread.id, prevDraftIds);
    }
  };

  const handleSyncCrm = async (leadIds: string[]) => {
    if (!snapshot || !activeThread || !activeCampaign) return;
    const resp = await fetch('/api/crm/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: snapshot.activeWorkspace.id,
        campaignId: activeCampaign.id,
        threadId: activeThread.id,
        leadIds,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
    }
  };

  const handleSaveSearch = async () => {
    if (!snapshot || !activeCampaign) return;
    const resp = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: snapshot.activeWorkspace.id,
        campaignId: activeCampaign.id,
        name: `${activeCampaign.filters.industry || activeCampaign.name} (${activeCampaign.filters.cityFilter || activeCampaign.filters.companyHqLocation || 'All'})`,
        prompt: activeThread?.messages[0]?.content ?? activeCampaign.goal,
        filters: activeCampaign.filters,
        schedule: 'Weekly',
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
    }
  };

  const handleUpdateDraft = async (
    draftId: string,
    patch: Partial<Pick<EmailDraft, 'subject' | 'body' | 'recipients' | 'mailboxAccount' | 'provider'>>
  ) => {
    await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  };

  const handleSendDraft = async (
    draftId: string
  ): Promise<{ ok: boolean; message: string }> => {
    const resp = await fetch(`/api/drafts/${encodeURIComponent(draftId)}/send`, {
      method: 'POST',
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { ok: false, message: data.error || 'Failed to send email.' };
    }
    setSnapshot(data.snapshot);
    return { ok: true, message: data.result?.message || 'Email sent.' };
  };

  const handleUpdateLead = async (
    leadId: string,
    patch: {
      owner?: string;
      crmStage?: string;
      customFieldValues?: Record<string, string>;
      newEngagementEvent?: Omit<LeadEngagementEvent, 'id'>;
    }
  ) => {
    const resp = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
    }
  };

  const handleUpdateCampaignFilters = async (filters: Partial<ExtractedFilters>) => {
    if (!activeCampaign) return;
    const resp = await fetch(`/api/campaigns/${encodeURIComponent(activeCampaign.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setSnapshot(data.snapshot);
    }
  };

  const handleRunSavedSearch = async (search: SavedSearch) => {
    if (!activeThread) return;
    await persistThreadState(activeThread.id, { campaignId: search.campaignId });
    await handleSendPrompt(search.prompt);
  };

  const handleLaunchTemplate = async (tpl: CampaignTemplate) => {
    setActiveNav('chat');
    await handleSendPrompt(tpl.prompt);
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-3 text-center">
          <h1 className="font-display text-lg font-bold text-slate-900">
            Unable to connect to AI GTM Engineer backend
          </h1>
          <p className="text-xs text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={() => loadWorkspace()}
            className="rounded-lg bg-[#0B6B4E] px-4 py-2 text-xs font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot || !activeThread || !activeCampaign) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-xs text-slate-500">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-white text-slate-900">
      <ChatSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        workspaces={snapshot.workspaces}
        activeWorkspace={snapshot.activeWorkspace}
        onSwitchWorkspace={(wsId) => loadWorkspace(wsId)}
        connectedToolCount={snapshot.connectedToolCount}
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        threads={snapshot.threads}
        activeThreadId={activeThread.id}
        onSelectThread={(threadId) => {
          setActiveThreadId(threadId);
          setActiveDraftId(null);
        }}
        onNewChat={handleNewChat}
        campaigns={snapshot.campaigns}
        activeCampaignId={activeCampaign.id}
        onSelectCampaign={(cmpId) => persistThreadState(activeThread.id, { campaignId: cmpId })}
        savedSearches={snapshot.savedSearches}
        onRunSavedSearch={handleRunSavedSearch}
        onRefreshSavedSearch={async (id) => {
          const resp = await fetch(`/api/saved-searches/${encodeURIComponent(id)}/refresh`, {
            method: 'POST',
          });
          if (resp.ok) {
            const data = await resp.json();
            setSnapshot(data.snapshot);
          }
        }}
        onResetDemo={async () => {
          const resp = await fetch('/api/workspaces/reset', { method: 'POST' });
          if (resp.ok) {
            const data = await resp.json();
            setSnapshot(data);
            setActiveThreadId(data.threads[0]?.id ?? '');
            setActiveDraftId(null);
            setActiveNav('chat');
          }
        }}
      />

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden bg-white">
        {/* Minimal Mobile-Only Header Bar */}
        <header className="flex lg:hidden h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation sidebar"
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-4 w-4" />
            </button>
            <GtmBrandMark className="h-5 w-5 shrink-0" />
            <span className="font-display text-sm font-bold text-slate-950 truncate">
              AI GTM Engineer
            </span>
          </div>
          <span className="text-xs text-slate-500 truncate max-w-[130px]">
            {snapshot.activeWorkspace.name}
          </span>
        </header>

        {/* Main Viewport + Contextual Right Panel (Email Draft or Lead Details) */}
        <main className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden bg-white">
          {activeNav === 'chat' && (
            <>
              <ChatThreadView
                snapshot={snapshot}
                activeThread={activeThread}
                activeCampaign={activeCampaign}
                activeDraftId={activeDetailLead ? null : activeDraftId}
                threadDraftCount={threadDrafts.length}
                isSending={isSending}
                selectedModel={selectedModel}
                onChangeModel={setSelectedModel}
                onChangeCampaign={(cmpId) =>
                  persistThreadState(activeThread.id, { campaignId: cmpId })
                }
                onSendPrompt={handleSendPrompt}
                onUploadFile={handleUploadFile}
                onControlRun={handleControlRun}
                onToggleSelectLead={(leadId) => {
                  const next = activeThread.selectedLeadIds.includes(leadId)
                    ? activeThread.selectedLeadIds.filter((id) => id !== leadId)
                    : [...activeThread.selectedLeadIds, leadId];
                  persistThreadState(activeThread.id, { selectedLeadIds: next });
                }}
                onSetSelectedLeadIds={(ids) =>
                  persistThreadState(activeThread.id, { selectedLeadIds: ids })
                }
                onOpenLeadDetail={(leadId) =>
                  persistThreadState(activeThread.id, { activeLeadId: leadId })
                }
                onOpenDraft={(draftId) => {
                  setActiveDraftId(draftId);
                  if (activeThread.activeLeadId) {
                    persistThreadState(activeThread.id, { activeLeadId: null });
                  }
                }}
                onOpenLatestDraft={() => {
                  const latest = threadDrafts[threadDrafts.length - 1];
                  if (latest) {
                    setActiveDraftId(latest.id);
                    if (activeThread.activeLeadId) {
                      persistThreadState(activeThread.id, { activeLeadId: null });
                    }
                  }
                }}
                onExportLeads={handleExportLeads}
                onEmailTeam={handleEmailTeam}
                onDraftProspects={handleDraftProspects}
                onSyncCrm={handleSyncCrm}
                onSaveSearch={handleSaveSearch}
                onUpdateCampaignFilters={handleUpdateCampaignFilters}
                onOpenWorkflowTab={() => setActiveNav('workflow')}
              />

              {activeDetailLead ? (
                <LeadDetailsPanel
                  lead={activeDetailLead}
                  leadStages={snapshot.activeWorkspace.leadStages}
                  territories={snapshot.activeWorkspace.territories}
                  customFields={snapshot.activeWorkspace.customFields}
                  hasThreadDraft={threadDrafts.length > 0}
                  onBackToDraft={() => {
                    const latest = threadDrafts[threadDrafts.length - 1];
                    persistThreadState(activeThread.id, { activeLeadId: null });
                    if (latest) setActiveDraftId(latest.id);
                  }}
                  onClose={() =>
                    persistThreadState(activeThread.id, { activeLeadId: null })
                  }
                  onUpdateLead={handleUpdateLead}
                  onSyncSingleLead={(id) => handleSyncCrm([id])}
                  onDraftOutreachForLead={(id) => handleDraftProspects([id])}
                />
              ) : activeDrawerDraft ? (
                <EmailDraftDrawer
                  draft={activeDrawerDraft}
                  allThreadDrafts={threadDrafts}
                  availableMailboxes={availableMailboxes}
                  onSelectDraft={(id) => setActiveDraftId(id)}
                  onClose={() => setActiveDraftId(null)}
                  onUpdateDraft={handleUpdateDraft}
                  onSendDraft={handleSendDraft}
                />
              ) : null}
            </>
          )}

          {activeNav === 'workflow' && (
            <CampaignWorkflowTab
              workspace={snapshot.activeWorkspace}
              thread={activeThread}
              campaign={activeCampaign}
              leads={snapshot.leads}
              runs={snapshot.runs}
              connectedToolNames={snapshot.integrations
                .filter((i) => i.status === 'connected')
                .map((i) => i.name)}
              onControlRun={handleControlRun}
              onReturnToChat={() => setActiveNav('chat')}
              onOpenOutcomes={() => setActiveNav('tasks')}
            />
          )}

          {activeNav === 'tasks' && (
            <TasksMeasurementView
              campaigns={snapshot.campaigns}
              activeCampaign={activeCampaign}
              leads={snapshot.leads}
              tasks={snapshot.tasks}
              sequences={snapshot.sequences}
              templates={snapshot.templates}
              onCreateTask={async (payload) => {
                const resp = await fetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    workspaceId: snapshot.activeWorkspace.id,
                    campaignId: activeCampaign.id,
                    ...payload,
                  }),
                });
                if (resp.ok) {
                  const data = await resp.json();
                  setSnapshot(data.snapshot);
                }
              }}
              onUpdateTaskStatus={async (taskId, status) => {
                const resp = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status }),
                });
                if (resp.ok) {
                  const data = await resp.json();
                  setSnapshot(data.snapshot);
                }
              }}
              onActivateSequence={async (sequenceId, leadIds) => {
                const resp = await fetch(
                  `/api/sequences/${encodeURIComponent(sequenceId)}/activate`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leadIds }),
                  }
                );
                const data = await resp.json();
                if (data.snapshot) setSnapshot(data.snapshot);
                return {
                  ok: resp.ok,
                  message: resp.ok
                    ? `Sequence activated (${data.sequence.enrolledLeadIds.length} leads enrolled).`
                    : data.error || 'Sequence paused.',
                };
              }}
              onLaunchTemplate={handleLaunchTemplate}
            />
          )}

          {activeNav === 'integrations' && (
            <IntegrationsView
              workspace={snapshot.activeWorkspace}
              integrations={snapshot.integrations}
              connectedToolCount={snapshot.connectedToolCount}
              onIntegrationAction={async (integrationId, action, extra) => {
                const resp = await fetch(
                  `/api/integrations/${encodeURIComponent(integrationId)}/action`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, ...extra }),
                  }
                );
                const data = await resp.json();
                if (data.snapshot) setSnapshot(data.snapshot);
                return {
                  ok: resp.ok,
                  message: resp.ok ? data.message : data.error || 'Action failed.',
                };
              }}
              onConnectTool={async (payload) => {
                const resp = await fetch('/api/integrations/connect-tool', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    workspaceId: snapshot.activeWorkspace.id,
                    ...payload,
                  }),
                });
                const data = await resp.json();
                if (resp.ok && data.snapshot) {
                  setSnapshot(data.snapshot);
                }
                return {
                  ok: resp.ok,
                  message: resp.ok
                    ? data.probeMessage || `Connected ${payload.name}.`
                    : data.error || 'Failed to connect tool.',
                };
              }}
              onProbeMcp={async (payload) => {
                const resp = await fetch('/api/integrations/mcp/probe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                return resp.json();
              }}
            />
          )}

          {activeNav === 'settings' && (
            <SettingsView
              workspace={snapshot.activeWorkspace}
              availableModels={snapshot.availableModels}
              auditEvents={snapshot.auditEvents}
              onSaveWorkspace={async (patch: Partial<Workspace>) => {
                const resp = await fetch(
                  `/api/workspaces/${encodeURIComponent(snapshot.activeWorkspace.id)}`,
                  {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                  }
                );
                if (resp.ok) {
                  const data = await resp.json();
                  setSnapshot(data);
                }
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
