import { useState } from 'react'
import { ShieldCheck, Wallet, Timer } from 'lucide-react'
import {
  Card,
  Button,
  Chip,
  Input,
  Well,
  Badge,
  PlainWords,
  Modal,
  ToastHost,
  Gauge,
  Spinner,
} from '../components/ui'
import { useUIStore } from '../store/uiStore'
import { formatINR, truncateAddress, formatDuration } from '../utils/format'
import styles from './_PrimitivesPreview.module.css'

/**
 * Scratch page for visually sanity-checking every UI primitive against the neumorphic
 * surface recipes. Not routed into the real app nav — dev-only.
 */
export default function PrimitivesPreview() {
  const [asset, setAsset] = useState<'USDT' | 'BTC' | 'ETH'>('USDT')
  const [modalOpen, setModalOpen] = useState(false)
  const showToast = useUIStore((state) => state.showToast)

  return (
    <div className={styles.page}>
      <h1 className="page-title">Primitives preview</h1>

      <section className={styles.row}>
        <Card>
          <h2 className="card-title">Card</h2>
          <p className="caption">A .raised panel — {formatINR(1240000)}</p>
        </Card>

        <Card>
          <h2 className="card-title">Buttons</h2>
          <div className={styles.row}>
            <Button variant="primary">Start tracing the money →</Button>
            <Button variant="default">Secondary action</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </Card>
      </section>

      <section className={styles.row}>
        <Card>
          <h2 className="card-title">Chips</h2>
          <div className={styles.row}>
            <Chip variant="segmented" selected={asset === 'USDT'} onClick={() => setAsset('USDT')}>
              USDT (TRC-20)
            </Chip>
            <Chip variant="segmented" selected={asset === 'BTC'} onClick={() => setAsset('BTC')}>
              BTC
            </Chip>
            <Chip variant="segmented" selected={asset === 'ETH'} onClick={() => setAsset('ETH')}>
              ETH
            </Chip>
          </div>
          <div className={styles.row}>
            <Chip colour="info">New</Chip>
            <Chip colour="onchain">Traced</Chip>
            <Chip colour="bridge">Notice sent</Chip>
            <Chip colour="safe">Closed</Chip>
          </div>
        </Card>

        <Card>
          <h2 className="card-title">Badges</h2>
          <div className={styles.row}>
            <Badge colour="criminal">High risk</Badge>
            <Badge colour="exchange">Medium</Badge>
            <Badge colour="safe">Verified</Badge>
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="card-title">Input</h2>
        <Input label="Complainant name" subtitle="Pre-filled from the NCRP record" defaultValue="Rekha Sharma" />
      </Card>

      <section className={styles.row}>
        <Well>Stat well · {truncateAddress('TXk9mR4pQ2vL8nW3sD6fH1jK5bQ2aZ')}</Well>
        <Well>Duration · {formatDuration(1925)}</Well>
      </section>

      <PlainWords>
        This is everything a police station already collects today. Nothing new is asked of the victim.
      </PlainWords>

      <section className={styles.row}>
        <Card>
          <h2 className="card-title">Gauge</h2>
          <Gauge value={0.87} />
        </Card>
        <Card>
          <h2 className="card-title">Spinner</h2>
          <Spinner percent={64} />
        </Card>
      </section>

      <section className={styles.row}>
        <Card>
          <h2 className="card-title">Icon tiles</h2>
          <div className={styles.row}>
            <span className={styles.iconTile}>
              <ShieldCheck size={20} color="var(--ink-mid)" />
            </span>
            <span className={styles.iconTile}>
              <Wallet size={20} color="var(--ink-mid)" />
            </span>
            <span className={styles.iconTile}>
              <Timer size={20} color="var(--ink-mid)" />
            </span>
          </div>
        </Card>

        <Card>
          <h2 className="card-title">Modal &amp; Toast</h2>
          <div className={styles.row}>
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button onClick={() => showToast('Coming in v2')}>Fire toast</Button>
          </div>
        </Card>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Neumorphic modal">
        <p>Closes on backdrop click or Escape. Always has a close button.</p>
      </Modal>

      <ToastHost />
    </div>
  )
}
