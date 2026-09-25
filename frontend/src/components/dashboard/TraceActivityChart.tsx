import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'

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
    <div className="rounded-full bg-foreground px-3.5 py-1.5 shadow-md flex items-baseline gap-1.5">
      <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-card">{value}</span>
      <span className="text-xs text-card/70">traces</span>
    </div>
  )
}

/** "Trace activity, last 14 days" — dark line, soft blue gradient-fill area chart on a plain white card. */
export function TraceActivityChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={TRACE_ACTIVITY} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="traceActivityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-sky)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-sky)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          interval={1}
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} width={28} />
        <Tooltip content={ChartTooltip} cursor={{ stroke: 'var(--color-foreground)', strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Area
          type="monotone"
          dataKey="traces"
          stroke="var(--color-foreground)"
          strokeWidth={2.5}
          fill="url(#traceActivityFill)"
          dot={false}
          activeDot={{ r: 5, fill: 'var(--color-foreground)', stroke: 'var(--color-card)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
