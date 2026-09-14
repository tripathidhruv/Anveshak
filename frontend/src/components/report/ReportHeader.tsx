import type { Case } from '../../types'
import styles from './ReportDocument.module.css'

export interface ReportHeaderProps {
  caseData: Case
  generatedAt: string
}

/** KAIZEN wordmark + case id + generated timestamp — the report's masthead. */
export function ReportHeader({ caseData, generatedAt }: ReportHeaderProps) {
  const generatedLabel = new Date(generatedAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <header className={styles.masthead}>
      <div>
        <p className={styles.wordmark}>KAIZEN</p>
        <p className={styles.docType}>Investigation Report</p>
      </div>
      <div className={styles.mastheadMeta}>
        <p>
          Case <span className="mono">{caseData.id}</span>
        </p>
        <p>Generated {generatedLabel}</p>
      </div>
    </header>
  )
}
