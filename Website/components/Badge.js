'use client'

/**
 * Badge — small status label.
 *
 * variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
 * size:    'sm' | 'md'  (default 'sm')
 */
const VARIANTS = {
    success: 'bg-green-100  text-green-700  dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-amber-100  text-amber-700  dark:bg-amber-900/30 dark:text-amber-400',
    danger: 'bg-red-100    text-red-700    dark:bg-red-900/30   dark:text-red-400',
    info: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30  dark:text-blue-400',
    neutral: 'bg-[var(--muted)] text-[var(--secondary)]',
}

export default function Badge({ children, variant = 'neutral', size = 'sm', className = '' }) {
    const base =
        size === 'sm'
            ? 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide'
            : 'inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide'

    return (
        <span className={`${base} ${VARIANTS[variant]} ${className}`}>
            {children}
        </span>
    )
}