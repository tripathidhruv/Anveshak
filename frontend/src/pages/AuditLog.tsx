import { useEffect, useState } from 'react'
import { CheckCircle2, ScrollText, ShieldAlert, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { PlainWords } from '@/components/ui/plain-words'
import { Spinner } from '@/components/ui/spinner'
import {
  getAuditLog as getAuditLogHttp,
  verifyAuditChain as verifyAuditChainHttp,
  type AuditLogEntryOut,
  type AuditVerifyOut,
} from '../api/httpApi'
import { getAuditLog as getAuditLogMock, verifyAuditChain as verifyAuditChainMock } from '../api/mock'

/** Same locally-resolved one-env-var switch as `OperatorFingerprint.tsx`/`SanctionsScreening.tsx`
 * -- neither `getAuditLog` nor `verifyAuditChain` is part of the shared `AnveshakApi` surface. Both
 * are system-wide (no `caseId` argument, matching the real endpoints' own signatures exactly). */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchAuditLog: () => Promise<AuditLogEntryOut[]> = USE_MOCK ? getAuditLogMock : getAuditLogHttp
const runVerifyAuditChain: () => Promise<AuditVerifyOut> = USE_MOCK ? verifyAuditChainMock : verifyAuditChainHttp

function EntryRow({ entry }: { entry: AuditLogEntryOut }) {
  return (
    <tr>
      <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-muted-foreground">
        {new Date(entry.createdAt).toLocaleString()}
      </td>
      <td className="border-b border-border px-3 py-3 text-sm text-foreground">{entry.actor}</td>
      <td className="whitespace-nowrap border-b border-border px-3 py-3">
        <Badge variant="secondary">{entry.action}</Badge>
      </td>
      <td className="border-b border-border px-3 py-3 text-sm text-foreground">
        {entry.objectType} · <span className="font-[family-name:var(--font-mono)] text-xs">{entry.objectId}</span>
      </td>
      <td
        className="whitespace-nowrap border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-xs text-muted-foreground"
        title={entry.hash}
      >
        {entry.hash.slice(0, 10)}…{entry.hash.slice(-6)}
      </td>
    </tr>
  )
}

/**
 * Audit log page -- surfaces `GET /api/v1/audit` and `GET /api/v1/audit/verify`
 * (`app/audit/chain.py`'s hash-chained trail), previously computed with no UI at all. System-wide
 * and standalone (matches `FlaggedWallets.tsx`'s pattern): the real endpoints take no case id, so
 * there's nothing to key a `/case/:id/...` route off in the first place.
 */
export default function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntryOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<AuditVerifyOut | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAuditLog()
      .then((result) => {
        if (cancelled) return
        setEntries(result)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load the audit log. Try again in a moment.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleVerify() {
    setVerifying(true)
    setVerifyError(null)
    runVerifyAuditChain()
      .then((result) => setVerifyResult(result))
      .catch(() => setVerifyError('Could not verify the audit chain. Try again in a moment.'))
      .finally(() => setVerifying(false))
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex max-w-2xl flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            Everything ANVESHAK has done, in order
          </h1>
          <Badge variant="outline">DEMO DATA</Badge>
        </div>
        <p className="text-[15px] text-muted-foreground">
          Every action any officer or the system itself took is recorded here, in the order it happened, and each
          entry is cryptographically linked to the one before it — so nobody, including ANVESHAK's own operators, can
          quietly edit or remove a past entry without it showing up as broken below.
        </p>
        <p className="text-xs text-muted-foreground">
          Technical name: append-only, hash-chained audit log.
        </p>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
            Verify chain integrity
          </h2>
          <Button onClick={handleVerify} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify integrity'}
          </Button>
        </div>

        {verifyError && <p className="text-sm font-medium text-destructive">{verifyError}</p>}

        {verifyResult && (
          <div
            className={`flex items-center gap-3 rounded-xl border-2 p-4 ${
              verifyResult.valid ? 'border-moss bg-moss/5' : 'border-vermillion bg-vermillion/5'
            }`}
          >
            <IconTile color={verifyResult.valid ? 'moss' : 'vermillion'}>
              {verifyResult.valid ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            </IconTile>
            <div>
              <p className="font-semibold text-foreground">
                {verifyResult.valid ? 'Chain valid — nothing has been tampered with' : 'Chain broken'}
              </p>
              <p className="text-sm text-muted-foreground">
                {verifyResult.checkedEntries} {verifyResult.checkedEntries === 1 ? 'entry' : 'entries'} checked
                {!verifyResult.valid && verifyResult.brokenAtEntryId != null
                  ? ` — the break starts at entry #${verifyResult.brokenAtEntryId}.`
                  : '.'}
              </p>
            </div>
          </div>
        )}

        {!verifyResult && !verifyError && (
          <p className="text-sm text-muted-foreground">Not verified yet this session.</p>
        )}
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm font-medium text-destructive">
          {error}
        </Card>
      )}

      {!error && !entries && (
        <Card className="mx-auto flex max-w-[420px] flex-col items-center gap-4 p-10 text-center text-muted-foreground">
          <Spinner percent={70} label="Loading" />
          <p>Loading the audit trail…</p>
        </Card>
      )}

      {!error && entries && (
        <Card className="flex flex-col gap-4 p-6">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <IconTile color="sky">
                <ScrollText size={20} />
              </IconTile>
              <p>No audit entries yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      When
                    </th>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Actor
                    </th>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Action
                    </th>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Object
                    </th>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Hash
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <EntryRow key={`${entry.objectId}::${entry.hash}`} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <PlainWords>
        Each row's hash is built from that row's own details plus the previous row's hash — so changing, inserting,
        or deleting any past entry would break every hash after it. "Verify integrity" above re-checks the whole
        chain right now and tells you the moment it stops matching, if it ever does.
      </PlainWords>

      {!error && entries && entries.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert size={14} />
          This log itself proves nothing about the underlying case facts — it only proves that ANVESHAK's own
          records haven't been silently altered after the fact.
        </div>
      )}
    </div>
  )
}
