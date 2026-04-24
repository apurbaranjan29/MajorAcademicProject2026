'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/**
 * StatCard — reusable metric display card.
 *
 * Props:
 *   label   {string}  — card heading
 *   value   {string}  — large primary number/text
 *   change  {string}  — sub-label below value
 *   trend   {'up' | 'down' | 'neutral'}
 *   detail  {string}  — small footnote (contract name etc.)
 *   icon    {LucideIcon} — optional icon component
 */
export default function StatCard({ label, value, change, trend = 'neutral', detail, icon: Icon }) {
    const trendColor = {
        up: 'text-[var(--success)]',
        down: 'text-[var(--danger)]',
        neutral: 'text-[var(--secondary)]',
    }[trend]

    const TrendIcon = {
        up: TrendingUp,
        down: TrendingDown,
        neutral: Minus,
    }[trend]

    return (
        <div
            className="
        card p-4 flex flex-col gap-3
        hover:shadow-card-md transition-shadow duration-150
      "
        >
            {/* Header row */}
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--secondary)]">
                    {label}
                </span>
                {Icon && (
                    <Icon
                        size={15}
                        strokeWidth={1.8}
                        className="text-[var(--secondary)] flex-shrink-0"
                    />
                )}
            </div>

            {/* Value */}
            <div>
                <p className="font-heading font-bold text-[28px] leading-none text-[var(--text)]">
                    {value}
                </p>
            </div>

            {/* Trend + change */}
            <div className="flex items-center gap-1.5">
                <TrendIcon size={12} strokeWidth={2} className={trendColor} />
                <span className={`text-[11px] font-medium ${trendColor}`}>
                    {change}
                </span>
            </div>

            {/* Detail footnote */}
            {detail && (
                <>
                    <div className="border-t border-[var(--border)]" />
                    <p className="text-[10px] text-[var(--secondary)] leading-snug font-mono">
                        {detail}
                    </p>
                </>
            )}
        </div>
    )
}