import { useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'
import type { ReportData } from '../../types'
import { formatINR } from '../../utils/format'
import { HopTable } from './HopTable'
import { ReportHeader } from './ReportHeader'
import styles from './ReportDocument.module.css'

export interface ReportDocumentProps {
  data: ReportData
}

/** A4-proportioned, real-HTML report preview (so `html2pdf.js` can export it faithfully) —
 * every value is read straight off the `ReportData` the API returned, nothing re-derived by
 * hand. Lives inside the `.pressed` scroll well the Evidence page's report tab renders. */
export function ReportDocument({ data }: ReportDocumentProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const { case: caseData, routeA, routeB, exchange, risk, campaign, integrityHash, generatedAt } = data
  const assetShort = caseData.asset.split(' ')[0]

  async function handleDownload() {
    if (!printRef.current || downloading) return
    setDownloading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      await html2pdf()
        .set({
          filename: `ANVESHAK-${caseData.id}-report.pdf`,
          margin: 10,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(printRef.current)
        .save()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={handleDownload} disabled={downloading}>
          {downloading ? <Spinner percent={70} size={16} strokeWidth={3} label="" /> : <Download size={16} />}
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </Button>
      </div>

      <div className="flex max-h-[720px] justify-center overflow-y-auto rounded-2xl border border-border bg-muted p-6">
        <div className={styles.page} ref={printRef}>
          <ReportHeader caseData={caseData} generatedAt={generatedAt} />

          <section className={styles.section}>
            <h3 className={styles.heading}>Complainant &amp; case details</h3>
            <div className={styles.factGrid}>
              <div>
                <dt>Complainant</dt>
                <dd>{caseData.complainant}</dd>
              </div>
              <div>
                <dt>NCRP reference</dt>
                <dd className="font-[family-name:var(--font-mono)]">{caseData.ncrp}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{caseData.location}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd className="font-[family-name:var(--font-mono)]">{caseData.phone}</dd>
              </div>
              <div>
                <dt>Incident</dt>
                <dd>{caseData.incidentAt}</dd>
              </div>
              <div>
                <dt>Reported</dt>
                <dd>{caseData.reportedAt}</dd>
              </div>
              <div>
                <dt>Fraud type</dt>
                <dd>{caseData.fraudType}</dd>
              </div>
              <div>
                <dt>Amount reported</dt>
                <dd>
                  {formatINR(caseData.amountINR)} ({caseData.amountCrypto.toLocaleString('en-IN')} {assetShort})
                </dd>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.heading}>Suspect wallet</h3>
            <p className="font-[family-name:var(--font-mono)]">{caseData.suspectWallet}</p>
          </section>

          <HopTable routeLabel="Route A" route={routeA} assetShort={assetShort} />
          <HopTable routeLabel="Route B" route={routeB} assetShort={assetShort} />

          <section className={styles.section}>
            <h3 className={styles.heading}>Exchange attribution</h3>
            <p>
              <strong>{exchange.name}</strong> ({exchange.jurisdiction}) — deposit address{' '}
              <span className="font-[family-name:var(--font-mono)]">{exchange.depositAddr}</span>. FIU-IND registered:{' '}
              {exchange.fiuRegistered ? 'Yes' : 'No'}. Estimated Indian users: {exchange.indianUsers}.
            </p>
            <ul className={styles.evidenceList}>
              {exchange.evidence.map((item) => (
                <li key={item.label}>
                  {item.label} — {Math.round(item.conf * 100)}% confidence
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.heading}>Risk score</h3>
            <p>
              <strong>{risk.score.toFixed(2)}</strong> out of 1 — {risk.band} RISK
            </p>
            <ul className={styles.evidenceList}>
              {risk.factors.map((factor) => (
                <li key={factor.plain}>
                  {factor.plain} ({factor.tech}) — weight +{factor.w.toFixed(2)}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h3 className={styles.heading}>Methodology</h3>
            <p className={styles.methodology}>
              This report was compiled by tracing on-chain transfers outward from the suspect wallet across every
              hop until funds reached an address matching a known exchange deposit pattern. Two independent paths
              were followed to the same cash-out point, including one that crossed a cross-chain bridge. Every
              address, amount, and timestamp above is presented exactly as returned by the trace — none of it is
              re-derived or estimated by hand. This case is one of {campaign.cases} sharing the same downstream
              wallet, together totalling {formatINR(campaign.totalINR)} across {campaign.states} states.
              <br />
              <strong>This is a demonstration report generated from synthetic prototype data</strong> — no real
              complainant, wallet, or exchange information is included; see the DEMO DATA marker in the ANVESHAK
              application for this case.
            </p>
          </section>

          <section className={styles.integrityBlock}>
            <h3 className={styles.heading}>Integrity</h3>
            <p>
              SHA-256 of the evidence set: <span className={`font-[family-name:var(--font-mono)] ${styles.hashValue}`}>{integrityHash}</span>
            </p>
            <p className={styles.footerLine}>Generated by ANVESHAK v1.0 — reproducible, no third-party data.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
