import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Megaphone,
  Bookmark,
  Plug,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Layers,
  ChevronDown,
  Settings,
  Check,
} from 'lucide-react';
import type {
  Campaign,
  ChatThread,
  NavSection,
  SavedSearch,
  Workspace,
} from '../types/gtm';
import { GtmBrandMark } from './BrandMarks';

interface ChatSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  onSwitchWorkspace: (workspaceId: string) => void;
  connectedToolCount: number;
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  campaigns: Campaign[];
  activeCampaignId: string;
  onSelectCampaign: (campaignId: string) => void;
  savedSearches: SavedSearch[];
  onRunSavedSearch: (search: SavedSearch) => void;
  onRefreshSavedSearch: (searchId: string) => void;
  onResetDemo: () => void;
}

export function ChatSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  workspaces,
  activeWorkspace,
  onSwitchWorkspace,
  connectedToolCount,
  activeNav,
  onSelectNav,
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  savedSearches,
  onRunSavedSearch,
  onRefreshSavedSearch,
  onResetDemo,
}: ChatSidebarProps) {
  const [savedOpen, setSavedOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const sidebarInner = (
    <div className="flex h-full flex-col bg-[#F6F7F6] border-r border-slate-200/90 text-slate-900 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <GtmBrandMark className="h-6 w-6 shrink-0" />
            <span className="font-display text-[17px] font-bold tracking-tight text-slate-950 whitespace-nowrap">
              AI GTM Engineer
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70"
        >
          Close
        </button>
      </div>

      {/* Primary New Chat CTA */}
      <div className="px-3.5 pt-1 pb-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onSelectNav('chat');
            onCloseMobile();
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B6B4E] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#085840] whitespace-nowrap ${
            collapsed ? 'px-2' : ''
          }`}
          title="Start a new chat"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Primary Navigation Links */}
      <nav aria-label="Primary navigation" className="px-3 space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onSelectNav('tasks');
            onCloseMobile();
          }}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeNav === 'tasks'
              ? 'bg-[#DCF5E7] text-slate-950 font-semibold'
              : 'text-slate-800 hover:bg-slate-200/60'
          }`}
          title="Campaigns & Tasks"
        >
          <span className="flex items-center gap-3 min-w-0">
            <Megaphone className="h-4 w-4 shrink-0 text-slate-600" />
            {!collapsed && <span className="truncate">Campaigns</span>}
          </span>
          {!collapsed && (
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {campaigns.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSavedOpen((v) => !v)}
          aria-expanded={savedOpen}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            savedOpen
              ? 'bg-slate-200/70 text-slate-950'
              : 'text-slate-800 hover:bg-slate-200/60'
          }`}
          title="Saved searches"
        >
          <span className="flex items-center gap-3 min-w-0">
            <Bookmark className="h-4 w-4 shrink-0 text-slate-600" />
            {!collapsed && <span className="truncate">Saved searches</span>}
          </span>
          {!collapsed && savedSearches.length > 0 && (
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {savedSearches.length}
            </span>
          )}
        </button>

        {/* Collapsible Saved Searches Drawer */}
        {!collapsed && savedOpen && (
          <div className="ml-2 mr-1 my-1 rounded-lg border border-slate-200 bg-white p-2 space-y-1">
            {savedSearches.length === 0 ? (
              <p className="px-2 py-1 text-xs text-slate-500">
                No saved searches yet. Save one from any lead table.
              </p>
            ) : (
              savedSearches.map((ss) => (
                <div
                  key={ss.id}
                  className="rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onRunSavedSearch(ss);
                        onSelectNav('chat');
                        onCloseMobile();
                      }}
                      className="min-w-0 truncate text-left text-xs font-medium text-slate-800 hover:text-[#0B6B4E]"
                    >
                      {ss.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRefreshSavedSearch(ss.id)}
                      aria-label={`Refresh saved search ${ss.name}`}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 shrink-0"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {ss.schedule} ·{' '}
                    <span className="font-mono tabular-nums">{ss.lastMatchCount}</span> matches
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onSelectNav('integrations');
            onCloseMobile();
          }}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeNav === 'integrations'
              ? 'bg-[#DCF5E7] text-slate-950 font-semibold'
              : 'text-slate-800 hover:bg-slate-200/60'
          }`}
          title="Integrations"
        >
          <span className="flex items-center gap-3 min-w-0">
            <Plug className="h-4 w-4 shrink-0 text-slate-600" />
            {!collapsed && <span className="truncate">Integrations</span>}
          </span>
          {!collapsed && (
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {connectedToolCount}
            </span>
          )}
        </button>
      </nav>

      {/* Hairline Divider & Recent Chats */}
      {!collapsed ? (
        <div className="mt-4 flex-1 overflow-y-auto border-t border-slate-200/80 px-3 pt-4 pb-3 space-y-5">
          <div>
            <div className="px-2.5 pb-2 text-xs font-medium text-slate-500">
              Recent chats
            </div>
            <div className="space-y-1">
              {threads.map((t) => {
                const isActive =
                  (activeNav === 'chat' || activeNav === 'workflow') &&
                  t.id === activeThreadId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectThread(t.id);
                      onSelectNav('chat');
                      onCloseMobile();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-[#DCF5E7] text-slate-950 font-semibold'
                        : 'text-slate-800 hover:bg-slate-200/60'
                    }`}
                  >
                    <MessageSquare
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{t.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Campaigns Quick Context */}
          {campaigns.length > 0 && (
            <div>
              <div className="px-2.5 pb-1.5 text-xs font-medium text-slate-500">
                Active campaigns
              </div>
              <div className="space-y-0.5">
                {campaigns.map((cmp) => {
                  const selected = cmp.id === activeCampaignId;
                  return (
                    <button
                      key={cmp.id}
                      type="button"
                      onClick={() => {
                        onSelectCampaign(cmp.id);
                        onCloseMobile();
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        selected
                          ? 'bg-white text-slate-950 font-semibold border border-slate-200/90'
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <span className="truncate">{cmp.name}</span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                        {cmp.leadIds.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Bottom Pinned Footer: Workspace Switcher & User/Settings */}
      <div className="relative border-t border-slate-200/80 px-3 py-3 space-y-1.5">
        {!collapsed && workspaceMenuOpen && (
          <div
            role="menu"
            aria-label="Switch workspace"
            className="absolute bottom-[104px] left-3 right-3 z-30 rounded-xl border border-slate-200 bg-white p-1.5 shadow-md space-y-1"
          >
            {workspaces.map((ws) => {
              const isCurrent = ws.id === activeWorkspace.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSwitchWorkspace(ws.id);
                    setWorkspaceMenuOpen(false);
                    onCloseMobile();
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    isCurrent
                      ? 'bg-[#E3F7EC] text-slate-950 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate">{ws.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {ws.mode === 'demo' ? 'Demo fixtures' : 'Live organization'} · {ws.currency}
                    </div>
                  </div>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-[#0B6B4E] shrink-0" />}
                </button>
              );
            })}
            {activeWorkspace.mode === 'demo' && (
              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onResetDemo();
                    setWorkspaceMenuOpen(false);
                    onCloseMobile();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Demo Workspace</span>
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setWorkspaceMenuOpen((v) => !v)}
          aria-expanded={workspaceMenuOpen}
          aria-label="Switch workspace"
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200/60"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Layers className="h-4 w-4 shrink-0 text-slate-600" />
            {!collapsed && (
              <span className="truncate">{activeWorkspace.name}</span>
            )}
          </span>
          {!collapsed && (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onSelectNav('settings');
            onCloseMobile();
          }}
          aria-label="Open workspace settings"
          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors ${
            activeNav === 'settings'
              ? 'bg-[#DCF5E7] text-slate-950 font-semibold'
              : 'text-slate-800 hover:bg-slate-200/60'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D4F3E2] text-xs font-bold text-[#0B6B4E]">
              AW
            </span>
            {!collapsed && <span className="truncate font-medium">Aakash</span>}
          </span>
          {!collapsed && <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Primary sidebar"
        className={`hidden lg:block shrink-0 transition-all duration-150 ${
          collapsed ? 'w-16' : 'w-60 xl:w-64'
        }`}
      >
        {sidebarInner}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-72 max-w-[85vw] h-full">
            {sidebarInner}
          </aside>
        </div>
      )}
    </>
  );
}
