import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** The colored circular icon tile used on KPI cards, evidence rows, etc. -- matches the
 * reference dashboard's "Digital Assets / Pending Staking / Funds Available" icon circles. */
const iconTileVariants = cva('flex shrink-0 items-center justify-center rounded-full shadow-sm', {
  variants: {
    color: {
      vermillion: 'bg-vermillion text-white',
      gold: 'bg-gold text-white',
      teal: 'bg-teal text-white',
      violet: 'bg-violet text-white',
      moss: 'bg-moss text-white',
      sky: 'bg-sky text-white',
      primary: 'bg-primary text-white',
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
