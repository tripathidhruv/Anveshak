import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** The colored circular icon tile used on KPI cards, evidence rows, etc. -- matches the
 * reference dashboard's "Digital Assets / Pending Staking / Funds Available" icon circles. */
const iconTileVariants = cva('flex shrink-0 items-center justify-center rounded-full', {
  variants: {
    color: {
      vermillion: 'bg-vermillion/12 text-vermillion',
      gold: 'bg-gold/12 text-gold',
      teal: 'bg-teal/12 text-teal',
      violet: 'bg-violet/12 text-violet',
      moss: 'bg-moss/12 text-moss',
      sky: 'bg-sky/12 text-sky',
      primary: 'bg-primary/10 text-primary',
    },
    size: {
      sm: 'h-9 w-9',
      default: 'h-11 w-11',
      lg: 'h-14 w-14',
    },
  },
  defaultVariants: { color: 'primary', size: 'default' },
})

interface IconTileProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof iconTileVariants> {}

function IconTile({ className, color, size, ...props }: IconTileProps) {
  return <div className={cn(iconTileVariants({ color, size }), className)} {...props} />
}

export { IconTile, iconTileVariants }
