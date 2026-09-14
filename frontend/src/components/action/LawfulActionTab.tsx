import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Flag, ScrollText, Send } from 'lucide-react'
import { Button, Modal, Well } from '../ui'
import { api } from '../../api'
import { useUIStore } from '../../store/uiStore'
import type { Case, CampaignSummary, Exchange, NoticeType } from '../../types'
import { formatINR } from '../../utils/format'
import { ActionCard, type ActionStatus } from './ActionCard'
import { noticeBody } from './noticeContent'
import styles from './LawfulActionTab.module.css'

interface CardConfig {
  type: NoticeType
  title: string
  subtitle?: string
  caption?: string
  readyLabel: string
  readyColour: string
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

/** Tab 3 — three stacked lawful-action cards, each opening a modal whose Send/Generate button
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
        readyColour: 'var(--sky)',
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
        readyColour: 'var(--gold)',
        buttonLabel: 'Open draft',
        confirmLabel: 'Generate',
        icon: <ScrollText size={18} />,
      },
      {
        type: 'fiu-report',
        title: 'Report to FIU-IND',
        subtitle: 'Flags an unregistered VASP servicing Indian users',
        readyLabel: 'READY',
        readyColour: 'var(--moss)',
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
    <div className={styles.wrapper}>
      <div className={styles.cards}>
        {cards.map((card) => (
          <ActionCard
            key={card.type}
            title={card.title}
            subtitle={card.subtitle}
            caption={card.caption}
            bodyPreview={bodies[card.type]}
            buttonLabel={card.buttonLabel}
            readyLabel={card.readyLabel}
            readyColour={card.readyColour}
            status={statuses[card.type]}
            onOpen={() => setOpenType(card.type)}
            icon={card.icon}
          />
        ))}
      </div>

      <Well className={styles.impactStrip}>
        Because {campaign.cases} complaints share this wallet, this one action covers {campaign.cases} cases and{' '}
        {formatINR(campaign.totalINR)}.
      </Well>

      <Modal open={activeCard != null} onClose={() => setOpenType(null)} title={activeCard?.title}>
        {activeCard && (
          <div className={styles.modalBody}>
            {activeCard.caption && <p className={styles.modalCaption}>{activeCard.caption}</p>}
            <textarea
              className={styles.textarea}
              value={bodies[activeCard.type]}
              onChange={(e) => setBodies((prev) => ({ ...prev, [activeCard.type]: e.target.value }))}
              rows={14}
              spellCheck={false}
            />
            <div className={styles.modalActions}>
              <Button onClick={() => setOpenType(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => handleConfirm(activeCard.type)}
                disabled={statuses[activeCard.type] === 'sending'}
              >
                {statuses[activeCard.type] === 'sending' ? 'Sending…' : activeCard.confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
