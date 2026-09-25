import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Flag, ScrollText, Send } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Well } from '../ui/well'
import { api } from '../../api'
import { useUIStore } from '../../store/uiStore'
import type { AccentColour } from '../../utils/constants'
import type { Case, CampaignSummary, Exchange, NoticeType } from '../../types'
import { formatINR } from '../../utils/format'
import { ActionCard, type ActionStatus } from './ActionCard'
import { noticeBody } from './noticeContent'

interface CardConfig {
  type: NoticeType
  title: string
  subtitle?: string
  caption?: string
  readyLabel: string
  readyAccent: AccentColour
  buttonLabel: string
  confirmLabel: string
  icon: ReactNode
}

export interface LawfulActionTabProps {
  caseId: string
  caseData: Case
  exchange: Exchange
  campaign: CampaignSummary
}

/** Tab 3 — three stacked lawful-action cards, each opening a dialog whose Send/Generate button
 * calls `api.sendNotice` and animates the card's status chip to a moss "SENT ✓". */
export function LawfulActionTab({ caseId, caseData, exchange, campaign }: LawfulActionTabProps) {
  const showToast = useUIStore((s) => s.showToast)
  const [statuses, setStatuses] = useState<Record<NoticeType, ActionStatus>>({
    'exchange-request': 'ready',
    'bnss-notice': 'ready',
    'fiu-report': 'ready',
  })
  const [openType, setOpenType] = useState<NoticeType | null>(null)
  const [bodies, setBodies] = useState<Record<NoticeType, string>>(() => ({
    'exchange-request': noticeBody('exchange-request', caseData, exchange),
    'bnss-notice': noticeBody('bnss-notice', caseData, exchange),
    'fiu-report': noticeBody('fiu-report', caseData, exchange),
  }))

  const cards: CardConfig[] = useMemo(
    () => [
      {
        type: 'exchange-request',
        title: 'Request to the exchange',
        readyLabel: 'READY TO SEND',
        readyAccent: 'sky',
        buttonLabel: 'Preview & send',
        confirmLabel: 'Send',
        icon: <Send size={18} />,
      },
      {
        type: 'bnss-notice',
        title: 'Section 94 BNSS notice',
        subtitle: 'Summons to produce documents — formerly Section 91 CrPC',
        caption: 'Draft only — an officer must review before filing.',
        readyLabel: 'DRAFT',
        readyAccent: 'gold',
        buttonLabel: 'Open draft',
        confirmLabel: 'Generate',
        icon: <ScrollText size={18} />,
      },
      {
        type: 'fiu-report',
        title: 'Report to FIU-IND',
        subtitle: 'Flags an unregistered VASP servicing Indian users',
        readyLabel: 'READY',
        readyAccent: 'moss',
        buttonLabel: 'Generate',
        confirmLabel: 'Generate',
        icon: <Flag size={18} />,
      },
    ],
    [],
  )

  const activeCard = cards.find((c) => c.type === openType) ?? null

  async function handleConfirm(type: NoticeType) {
    setStatuses((prev) => ({ ...prev, [type]: 'sending' }))
    try {
      await api.sendNotice(caseId, type)
      setStatuses((prev) => ({ ...prev, [type]: 'sent' }))
      setOpenType(null)
      showToast(`${cards.find((c) => c.type === type)?.title ?? 'Notice'} sent`)
    } catch {
      setStatuses((prev) => ({ ...prev, [type]: 'ready' }))
      showToast('Something went wrong — please try again')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        {cards.map((card) => (
          <ActionCard
            key={card.type}
            title={card.title}
            subtitle={card.subtitle}
            caption={card.caption}
            bodyPreview={bodies[card.type]}
            buttonLabel={card.buttonLabel}
            readyLabel={card.readyLabel}
            readyAccent={card.readyAccent}
            status={statuses[card.type]}
            onOpen={() => setOpenType(card.type)}
            icon={card.icon}
          />
        ))}
      </div>

      <Well className="border border-moss/20 bg-moss/10 text-sm font-semibold text-foreground">
        Because {campaign.cases} complaints share this wallet, this one action covers {campaign.cases} cases and{' '}
        {formatINR(campaign.totalINR)}.
      </Well>

      <Dialog open={activeCard != null} onOpenChange={(open) => !open && setOpenType(null)}>
        <DialogContent>
          {activeCard && (
            <>
              <DialogHeader>
                <DialogTitle>{activeCard.title}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3.5">
                {activeCard.caption && (
                  <p className="rounded-lg bg-vermillion/10 px-3.5 py-2.5 text-xs font-semibold text-vermillion">
                    {activeCard.caption}
                  </p>
                )}
                <textarea
                  className="w-full resize-y rounded-xl border border-border bg-muted p-4 font-[family-name:var(--font-mono)] text-[12.5px] leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={bodies[activeCard.type]}
                  onChange={(e) => setBodies((prev) => ({ ...prev, [activeCard.type]: e.target.value }))}
                  rows={14}
                  spellCheck={false}
                />
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setOpenType(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleConfirm(activeCard.type)}
                    disabled={statuses[activeCard.type] === 'sending'}
                  >
                    {statuses[activeCard.type] === 'sending' ? 'Sending…' : activeCard.confirmLabel}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
