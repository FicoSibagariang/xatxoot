import { FileText, Paperclip, Smile } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Avatar, Button, ChannelBadge } from '../astryx'
import {
  AiCopilotToolbar,
  AiMagicButton,
  type AutocompleteEntry,
  type CannedItem,
  ChatTimeline,
  type CommandItem,
  type CopilotResultType,
  type CopilotTone,
  DeadlineTimerBadge,
  SlashAutocompletePopup,
  type SuggestedArticle,
  TicketSlaBadge,
  type TimelineMessage,
  applyAutocompleteSelection,
  detectSlashQuery,
  filterAutocompleteEntries,
} from '../chat'
import {
  EmptyConversationState,
  EmptyThreadNotice,
  ReplyPreviewBar,
  ThreadTicketHeaderActions,
  TicketAssignmentLockBanner,
} from './EmptyConversationState'
import {
  COPILOT_TONE_PREFIXES,
  DEFAULT_CANNED_RESPONSES,
  DEFAULT_SLASH_COMMANDS,
  DEFAULT_SUGGESTED_ARTICLES,
} from './constants'
import type { ConversationItem, LayoutUser } from './types'

export { DEFAULT_CANNED_RESPONSES, DEFAULT_SLASH_COMMANDS }

export interface ConversationThreadProps {
  conversation: ConversationItem | null
  currentUser?: LayoutUser
  isDrawerOpen: boolean
  messages?: TimelineMessage[]
  replyingToMessage?: TimelineMessage | null
  onCancelReply?: () => void
  onReplyToMessage?: (message: TimelineMessage) => void
  cannedResponses?: CannedItem[]
  slashCommands?: CommandItem[]
  now?: Date
  onToggleDrawer: () => void
  onSendMessage: (message: string, replyToMessageId?: string | null) => void
  onAssignTicket: () => void
  onResolveTicket: () => void
  onRetryMessage?: (message: TimelineMessage) => void
  onOpenTemplateDialog?: () => void
  onAiSummarize?: () => Promise<string> | undefined
  onAiImproveWriting?: (text: string) => Promise<string> | undefined
  onAiDraftReply?: () => Promise<{ reply: string; articles?: SuggestedArticle[] }> | undefined
  onAiChangeTone?: (text: string, tone: CopilotTone) => Promise<string> | undefined
  onSaveInternalNote?: (note: string) => void
  children?: ReactNode
}

export function ConversationThread(props: ConversationThreadProps) {
  const {
    conversation,
    currentUser,
    isDrawerOpen,
    messages,
    replyingToMessage,
    onCancelReply,
    onReplyToMessage,
    cannedResponses,
    slashCommands,
    now,
    onToggleDrawer,
    onSendMessage,
    onAssignTicket,
    onResolveTicket,
    onRetryMessage,
    onOpenTemplateDialog,
    onAiSummarize,
    onAiImproveWriting,
    onAiDraftReply,
    onAiChangeTone,
    onSaveInternalNote,
    children,
  } = props
  const [inputText, setInputText] = useState('')
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0)

  // AI Copilot state
  const [isAiToolbarOpen, setIsAiToolbarOpen] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiLoadingAction, setAiLoadingAction] = useState('AI sedang memproses...')
  const [aiResultText, setAiResultText] = useState<string | null>(null)
  const [aiResultType, setAiResultType] = useState<CopilotResultType | null>(null)
  const [aiArticles, setAiArticles] = useState<SuggestedArticle[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const isAtBottomRef = useRef(true)
  const prevConvIdRef = useRef<string | null>(null)
  const prevMsgCountRef = useRef<number>(0)

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottomRef.current = distanceFromBottom <= 100
  }

  useEffect(() => {
    const convChanged = conversation?.id !== prevConvIdRef.current
    prevConvIdRef.current = conversation?.id || null

    const msgCount = messages?.length || 0
    const msgCountIncreased = msgCount > prevMsgCountRef.current
    prevMsgCountRef.current = msgCount

    if (convChanged) {
      isAtBottomRef.current = true
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    } else if (msgCountIncreased && isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation?.id, messages])

  const activeCanned = cannedResponses ?? DEFAULT_CANNED_RESPONSES
  const activeCommands = slashCommands ?? DEFAULT_SLASH_COMMANDS

  const slashInfo = detectSlashQuery(inputText)
  const filteredEntries = slashInfo.isActive
    ? filterAutocompleteEntries(activeCanned, activeCommands, slashInfo.query)
    : []

  if (!conversation) {
    return <EmptyConversationState />
  }

  const activeTicket = conversation.ticket
  const isTicketResolved = activeTicket?.status === 'resolved'
  const isTicketAssignedToMe = Boolean(
    activeTicket?.assignedTo && (!currentUser || activeTicket.assignedTo === currentUser.id),
  )
  const isTicketAssignedToOther = Boolean(
    activeTicket?.assignedTo &&
      currentUser &&
      activeTicket.assignedTo !== currentUser.id &&
      !isTicketResolved,
  )
  const isTicketUnassigned = Boolean(
    currentUser && activeTicket && !activeTicket.assignedTo && !isTicketResolved,
  )
  const isTicketLocked = isTicketUnassigned || isTicketAssignedToOther

  const handleSend = () => {
    if (!inputText.trim() || isTicketLocked) return
    onSendMessage(inputText, replyingToMessage?.id)
    setInputText('')
    setIsAutocompleteOpen(false)
    if (onCancelReply) {
      onCancelReply()
    }
  }

  const handleInputChange = (val: string) => {
    setInputText(val)
    const detected = detectSlashQuery(val)
    if (detected.isActive) {
      setIsAutocompleteOpen(true)
      setSelectedAutocompleteIndex(0)
    } else {
      setIsAutocompleteOpen(false)
    }
  }

  const handleSelectEntry = (entry: AutocompleteEntry) => {
    if (!slashInfo.isActive) return
    setInputText(applyAutocompleteSelection(inputText, slashInfo.startIndex, entry))
    setIsAutocompleteOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (isAutocompleteOpen && slashInfo.isActive && filteredEntries.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        return setSelectedAutocompleteIndex((prev) => (prev + 1) % filteredEntries.length)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        return setSelectedAutocompleteIndex(
          (prev) => (prev - 1 + filteredEntries.length) % filteredEntries.length,
        )
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = filteredEntries[selectedAutocompleteIndex]
        if (selected) handleSelectEntry(selected)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        return setIsAutocompleteOpen(false)
      }
    }

    if (e.key === 'Enter') handleSend()
  }

  const handleAiSummarize = async () => {
    setIsAiLoading(true)
    setAiLoadingAction('Sedang merangkum percakapan...')
    setAiError(null)
    try {
      const res = onAiSummarize
        ? await onAiSummarize()
        : `Ringkasan Percakapan: Pelanggan ${conversation.contactName} menanyakan kendala terkait ${conversation.lastMessage || 'layanan'}.`
      if (res) {
        setAiResultText(res)
        setAiResultType('summary')
      }
    } catch {
      setAiError('Gagal merangkum percakapan. Silakan coba lagi.')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleAiImprove = async (text?: string) => {
    const targetText = text || inputText
    if (!targetText.trim()) {
      setAiError('Tulis draf pesan terlebih dahulu sebelum meminta perbaikan bahasa.')
      return
    }
    setIsAiLoading(true)
    setAiLoadingAction('Sedang memperbaiki bahasa draf...')
    setAiError(null)
    try {
      const res = onAiImproveWriting
        ? await onAiImproveWriting(targetText)
        : `Halo Kak, ${targetText.trim().charAt(0).toUpperCase() + targetText.trim().slice(1)}. Terima kasih telah menghubungi kami.`
      if (res) {
        setAiResultText(res)
        setAiResultType('improve')
      }
    } catch {
      setAiError('Gagal memperbaiki bahasa.')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleAiDraftReply = async () => {
    setIsAiLoading(true)
    setAiLoadingAction('Menyusun draf balasan dengan Help Center KB...')
    setAiError(null)
    try {
      if (onAiDraftReply) {
        const res = await onAiDraftReply()
        if (res) {
          setAiResultText(res.reply)
          setAiResultType('draft')
          if (res.articles) setAiArticles(res.articles)
        }
      } else {
        setAiResultText(
          `Halo Kak ${conversation.contactName}, terima kasih telah menghubungi kami. Terkait kendala yang disampaikan, tim kami sedang memprosesnya. Mohon ditunggu ya!`,
        )
        setAiResultType('draft')
        setAiArticles(DEFAULT_SUGGESTED_ARTICLES)
      }
    } catch {
      setAiError('Gagal membuat draf balasan.')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleAiChangeTone = async (tone: CopilotTone) => {
    if (!inputText.trim()) {
      setAiError('Ketik draf pesan terlebih dahulu untuk mengubah nada bicara.')
      return
    }
    setIsAiLoading(true)
    setAiLoadingAction(`Menyesuaikan gaya bahasa (${tone})...`)
    setAiError(null)
    try {
      const res = onAiChangeTone
        ? await onAiChangeTone(inputText, tone)
        : `${COPILOT_TONE_PREFIXES[tone] || ''}${inputText.trim()}`
      if (res) {
        setAiResultText(res)
        setAiResultType('tone')
      }
    } catch {
      setAiError('Gagal mengubah gaya bahasa.')
    } finally {
      setIsAiLoading(false)
    }
  }

  return (
    <main
      data-testid="conversation-thread"
      className="flex-1 h-full flex flex-col bg-wa-chat-bg overflow-hidden"
    >
      {/* Header Percakapan */}
      <header
        data-testid="thread-header"
        className="h-16 bg-wa-header-bg px-4 flex items-center justify-between border-b border-wa-border shrink-0 z-10"
      >
        {/* Contact info pill (Click to open Drawer) */}
        <button
          type="button"
          data-testid="btn-toggle-drawer"
          onClick={onToggleDrawer}
          className="flex items-center gap-3 text-left focus:outline-none hover:bg-slate-200/50 p-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Avatar
            name={conversation.contactName}
            src={conversation.contactAvatarUrl}
            channel={conversation.channel}
            size="md"
          />
          <div>
            <h3 className="font-semibold text-sm text-wa-text-primary flex items-center gap-1.5 leading-tight">
              <span>{conversation.contactName}</span>
              <ChannelBadge channel={conversation.channel} />
              {conversation.contactPhone && (
                <span className="text-xs font-normal text-wa-text-secondary">
                  ({conversation.contactPhone})
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1.5 leading-tight mt-0.5">
              {conversation.inboxName && (
                <span
                  data-testid="thread-inbox-name"
                  className="text-[11px] font-medium text-slate-500"
                >
                  {conversation.inboxName} •
                </span>
              )}
              <p className="text-[11px] text-wa-teal-primary font-medium">
                {conversation.presence === 'typing'
                  ? 'mengetik...'
                  : conversation.presence || 'online'}
              </p>
            </div>
          </div>
        </button>

        {/* Quick Ticket Actions (Only rendered if conversation has an active ticket) */}
        {conversation.ticket && (
          <ThreadTicketHeaderActions
            ticket={conversation.ticket}
            now={now}
            isTicketAssignedToMe={isTicketAssignedToMe}
            isTicketAssignedToOther={isTicketAssignedToOther}
            isTicketResolved={isTicketResolved}
            onAssignTicket={onAssignTicket}
            onResolveTicket={onResolveTicket}
          />
        )}
      </header>

      {/* Canvas Obrolan (Doodle Wallpaper Background) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        data-testid="doodle-canvas"
        className="flex-1 overflow-y-auto p-4 wa-doodle-pattern"
      >
        {messages && messages.length > 0 ? (
          <>
            <ChatTimeline
              messages={messages}
              onRetryMessage={onRetryMessage}
              onReplyToMessage={onReplyToMessage}
            />
            <div ref={messagesEndRef} />
          </>
        ) : children ? (
          children
        ) : (
          <EmptyThreadNotice ticketNumber={conversation.ticket?.ticketNumber} />
        )}
      </div>

      {/* Quoted Reply Preview Bar */}
      {replyingToMessage && (
        <ReplyPreviewBar replyingTo={replyingToMessage} onCancel={onCancelReply} />
      )}

      {/* Bottom Input Bar */}
      <footer
        data-testid="thread-input-bar"
        className="bg-wa-header-bg px-4 py-2.5 flex items-center gap-2.5 border-t border-wa-border shrink-0 relative"
      >
        {isTicketLocked ? (
          <TicketAssignmentLockBanner
            isUnassigned={isTicketUnassigned}
            assignedAgentName={activeTicket?.assignedAgentName}
            onAssignTicket={onAssignTicket}
          />
        ) : (
          <>
            <button
              type="button"
              title="Emoji"
              className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 cursor-pointer"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              type="button"
              title="Lampiran Gambar/File"
              className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <button
              type="button"
              data-testid="btn-open-template-dialog"
              title="Template Pesan WhatsApp Resmi"
              onClick={onOpenTemplateDialog}
              className="p-2 text-slate-500 hover:text-emerald-700 rounded-full hover:bg-slate-200/60 cursor-pointer"
            >
              <FileText className="w-5 h-5" />
            </button>

            <AiMagicButton
              isOpen={isAiToolbarOpen}
              onToggle={() => setIsAiToolbarOpen(!isAiToolbarOpen)}
              isLoading={isAiLoading}
              hasResult={Boolean(aiResultText)}
            />

            <AiCopilotToolbar
              isOpen={isAiToolbarOpen}
              isLoading={isAiLoading}
              loadingAction={aiLoadingAction}
              errorMessage={aiError}
              resultText={aiResultText}
              resultType={aiResultType}
              suggestedArticles={aiArticles}
              currentText={inputText}
              onToggle={() => setIsAiToolbarOpen(false)}
              onSummarize={handleAiSummarize}
              onImproveWriting={handleAiImprove}
              onDraftReply={handleAiDraftReply}
              onChangeTone={handleAiChangeTone}
              onApplyText={(text) => {
                setInputText(text)
                setIsAiToolbarOpen(false)
              }}
              onInjectNote={onSaveInternalNote}
              onClearResult={() => setAiResultText(null)}
            />

            <div className="relative flex-1">
              <SlashAutocompletePopup
                isOpen={isAutocompleteOpen && slashInfo.isActive}
                query={slashInfo.query}
                entries={filteredEntries}
                selectedIndex={selectedAutocompleteIndex}
                onSelect={handleSelectEntry}
                onHover={setSelectedAutocompleteIndex}
                onClose={() => setIsAutocompleteOpen(false)}
              />

              <input
                type="text"
                placeholder="Ketik pesan atau ketik / untuk balasan cepat..."
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white text-sm text-wa-text-primary rounded-lg px-4 py-2 border border-wa-border focus:outline-none focus:border-wa-teal-primary"
              />
            </div>

            <Button variant="teal" size="sm" onClick={handleSend} className="rounded-lg px-4 py-2">
              Kirim
            </Button>
          </>
        )}
      </footer>
    </main>
  )
}

export default ConversationThread
