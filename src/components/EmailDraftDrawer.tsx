import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileText,
} from 'lucide-react';
import type { EmailDraft, MailboxAccount } from '../types/gtm';
import { ExcelFileIcon, GmailIcon, OutlookIcon } from './BrandMarks';

interface EmailDraftDrawerProps {
  draft: EmailDraft;
  allThreadDrafts: EmailDraft[];
  availableMailboxes: MailboxAccount[];
  onSelectDraft: (draftId: string) => void;
  onClose: () => void;
  onUpdateDraft: (
    draftId: string,
    patch: Partial<
      Pick<EmailDraft, 'subject' | 'body' | 'recipients' | 'mailboxAccount' | 'provider'>
    >
  ) => Promise<void>;
  onSendDraft: (draftId: string) => Promise<{ ok: boolean; message: string }>;
}

export function EmailDraftDrawer({
  draft,
  allThreadDrafts,
  availableMailboxes,
  onSelectDraft,
  onClose,
  onUpdateDraft,
  onSendDraft,
}: EmailDraftDrawerProps) {
  const [recipientsText, setRecipientsText] = useState(draft.recipients.join(', '));
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [mailbox, setMailbox] = useState(draft.mailboxAccount);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [attachmentDismissed, setAttachmentDismissed] = useState(false);

  useEffect(() => {
    setRecipientsText(draft.recipients.join(', '));
    setSubject(draft.subject);
    setBody(draft.body);
    setMailbox(draft.mailboxAccount);
    setFeedback(null);
    setAttachmentDismissed(false);
  }, [draft.id, draft.recipients, draft.subject, draft.body, draft.mailboxAccount]);

  const mailboxOptions =
    availableMailboxes.length > 0
      ? availableMailboxes
      : [
          {
            id: 'local-preview',
            email: draft.mailboxAccount,
            label: `${draft.mailboxAccount} (Local Preview)`,
            provider: 'local_preview' as const,
            dailyLimit: 250,
            sentToday: 0,
          },
        ];

  const selectedMb = mailboxOptions.find((m) => m.email === mailbox);
  const providerLabel =
    (selectedMb?.provider ?? draft.provider) === 'outlook'
      ? 'Outlook'
      : 'Gmail';

  const handleSaveChanges = async () => {
    const parsedRecipients = recipientsText
      .split(/[,;\s]+/)
      .map((r) => r.trim())
      .filter(Boolean);
    await onUpdateDraft(draft.id, {
      recipients: parsedRecipients,
      subject,
      body,
      mailboxAccount: mailbox,
      provider: selectedMb?.provider ?? draft.provider,
    });
  };

  const handleSend = async () => {
    setSending(true);
    setFeedback(null);
    await handleSaveChanges();
    const res = await onSendDraft(draft.id);
    setFeedback({ ok: res.ok, text: res.message });
    setSending(false);
  };

  const isSent = draft.status === 'sent';
  const isBlocked = draft.status === 'blocked_suppressed';
  const isExcelAttachment =
    draft.attachmentFileName?.toLowerCase().endsWith('.xlsx') ||
    draft.attachmentFileName?.toLowerCase().endsWith('.xls');

  return (
    <aside
      aria-label="Email draft panel"
      className="fixed inset-0 z-40 lg:static lg:z-auto flex h-full w-full lg:w-[340px] xl:w-[375px] shrink-0 flex-col border-l border-slate-200 bg-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h2 className="font-display text-lg font-bold tracking-tight text-slate-950">
          Email draft
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close email draft panel"
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Multi-draft selector when a thread has >1 drafts */}
      {allThreadDrafts.length > 1 && (
        <div className="px-6 pb-3">
          <label htmlFor="draft-switcher" className="sr-only">
            Switch draft
          </label>
          <select
            id="draft-switcher"
            value={draft.id}
            onChange={(e) => onSelectDraft(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-[#F6F7F6] px-3 py-1.5 text-xs font-medium text-slate-800"
          >
            {allThreadDrafts.map((d, idx) => (
              <option key={d.id} value={d.id}>
                {idx + 1}. {d.kind === 'team_report' ? 'Team Report' : d.leadName || d.recipients[0]} ({d.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Provider Row */}
      <div className="flex items-center justify-between px-6 pb-4">
        <div className="flex items-center gap-2.5 text-sm">
          {providerLabel === 'Outlook' ? (
            <OutlookIcon className="h-5 w-5 shrink-0" />
          ) : (
            <GmailIcon className="h-5 w-5 shrink-0" />
          )}
          <span className="font-semibold text-slate-900">{providerLabel}</span>
          <span className="text-slate-300" aria-hidden="true">
            |
          </span>
          {isSent ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B6B4E]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Sent</span>
            </span>
          ) : isBlocked ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Blocked</span>
            </span>
          ) : (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Draft
            </span>
          )}
        </div>
        {isSent && draft.providerResponseId && (
          <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
            {draft.providerResponseId}
          </span>
        )}
      </div>

      {/* Scrollable Form Fields */}
      <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-4">
        <div>
          <label
            htmlFor={`drawer-from-${draft.id}`}
            className="block text-xs font-medium text-slate-600 mb-1.5"
          >
            From
          </label>
          <select
            id={`drawer-from-${draft.id}`}
            disabled={isSent}
            value={mailbox}
            onChange={(e) => setMailbox(e.target.value)}
            onBlur={handleSaveChanges}
            className="w-full rounded-lg border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-sm text-slate-900 focus:border-[#0B6B4E] focus:bg-white disabled:opacity-65"
          >
            {mailboxOptions.map((mb) => (
              <option key={mb.id} value={mb.email}>
                {mb.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`drawer-to-${draft.id}`}
            className="block text-xs font-medium text-slate-600 mb-1.5"
          >
            To
          </label>
          <input
            id={`drawer-to-${draft.id}`}
            type="text"
            disabled={isSent}
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            onBlur={handleSaveChanges}
            className="w-full rounded-lg border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-sm text-slate-900 focus:border-[#0B6B4E] focus:bg-white disabled:opacity-65"
          />
        </div>

        <div>
          <label
            htmlFor={`drawer-subject-${draft.id}`}
            className="block text-xs font-medium text-slate-600 mb-1.5"
          >
            Subject
          </label>
          <input
            id={`drawer-subject-${draft.id}`}
            type="text"
            disabled={isSent}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={handleSaveChanges}
            className="w-full rounded-lg border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-sm font-medium text-slate-900 focus:border-[#0B6B4E] focus:bg-white disabled:opacity-65"
          />
        </div>

        <div>
          <label htmlFor={`drawer-body-${draft.id}`} className="sr-only">
            Message body
          </label>
          <textarea
            id={`drawer-body-${draft.id}`}
            rows={7}
            disabled={isSent}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={handleSaveChanges}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800 focus:border-[#0B6B4E] disabled:opacity-65"
          />
        </div>

        {/* Attached File Chip */}
        {draft.attachmentFileName && !attachmentDismissed && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-[#FAFAFA] px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {isExcelAttachment ? (
                <ExcelFileIcon className="h-6 w-6 shrink-0" />
              ) : (
                <FileText className="h-5 w-5 shrink-0 text-[#0B6B4E]" />
              )}
              <span className="truncate text-xs font-medium text-slate-900">
                {draft.attachmentFileName}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {draft.attachmentExportId && (
                <a
                  href={`/api/exports/${draft.attachmentExportId}/download`}
                  download={draft.attachmentFileName}
                  aria-label={`Download ${draft.attachmentFileName}`}
                  className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              )}
              {!isSent && (
                <button
                  type="button"
                  onClick={() => setAttachmentDismissed(true)}
                  aria-label="Hide attachment preview"
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {feedback && (
          <div
            role="status"
            className={`rounded-lg px-3 py-2.5 text-xs ${
              feedback.ok
                ? 'bg-[#E3F7EC] text-[#085840] border border-[#BDE9D1]'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {/* Bottom Sticky Primary Send CTA */}
      <div className="border-t border-slate-100 px-6 py-4 space-y-2">
        <button
          type="button"
          disabled={sending || isSent || isBlocked}
          onClick={handleSend}
          className="w-full rounded-lg bg-[#0B6B4E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#085840] disabled:opacity-50"
        >
          {isSent ? 'Sent' : sending ? 'Sending...' : 'Send'}
        </button>
        <p className="text-center text-[11px] text-slate-500">
          {draft.kind === 'team_report'
            ? 'Team report only · sends 0 prospect messages'
            : 'Honors opt-outs, suppression rules & mailbox limits'}
        </p>
      </div>
    </aside>
  );
}
