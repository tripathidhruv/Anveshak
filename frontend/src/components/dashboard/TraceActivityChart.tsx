import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import styles from './TraceActivityChart.module.css'

/**
 * 14 synthetic-but-plausible daily trace counts (illustrative only — this field doesn't exist
 * in `DEMO`, there's no per-day trace log in the mock dataset). Scaled to sit under the
 * dashboard's "147 active cases" KPI. Not surfaced as real data anywhere in the UI copy.
 */
const TRACE_ACTIVITY = [
  { day: '1', traces: 6 }, { day: '2', traces: 8 }, { day: '3', traces: 7 }, { day: '4', traces: 9 },
  { day: '5', traces: 11 }, { day: '6', traces: 8 }, { day: '7', traces: 10 }, { day: '8', traces: 13 },
  { day: '9', traces: 12 }, { day: '10', traces: 15 }, { day: '11', traces: 14 }, { day: '12', traces: 17 },
  { day: '13', traces: 16 }, { day: '14', traces: 19 },
]

function ChartTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipValue}>{value}</span>
      <span className={styles.tooltipLabel}>traces that day</span>
    </div>
  )
}

/** "Trace activity, last 14 days" — the pressed-well line chart per the Global Constraints chart rules. */
export function TraceActivityChart() {
  return (
    <div className={styles.well}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={TRACE_ACTIVITY} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="traceActivityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#CDD5E0" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
            interval={1}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} width={28} />
          <Tooltip content={ChartTooltip} cursor={{ stroke: 'var(--teal)', strokeWidth: 1, strokeDasharray: '3 3' }} />
          <Area
            type="monotone"
            dataKey="traces"
            stroke="var(--teal)"
            strokeWidth={2.5}
            fill="url(#traceActivityFill)"
            dot={false}
            activeDot={{ r: 5, fill: 'var(--teal)', stroke: 'var(--bg)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
