'use client'

import { Moon, Sun, Wallet } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useWeb3 } from '../context/Web3Context'

export default function Topbar({ title, subtitle }) {
    const { theme, toggleTheme } = useTheme()
    const { account, connectWallet, isConnecting } = useWeb3()

    return (
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--card)]">
            <div>
                <h1 className="text-sm font-semibold text-[var(--text)]">{title}</h1>
                <p className="text-xs text-[var(--secondary)]">{subtitle}</p>
            </div>

            <div className="flex items-center gap-3">
                {account ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-green-500/30 bg-green-50 dark:bg-green-900/10 text-xs shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-mono font-medium text-green-700 dark:text-green-400">
                            {account.substring(0, 6)}...{account.substring(account.length - 4)}
                        </span>
                    </div>
                ) : (
                    <button
                        onClick={connectWallet}
                        disabled={isConnecting}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-[var(--primary)] hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-sm"
                    >
                        <Wallet size={14} />
                        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                )}

                <button
                    onClick={toggleTheme}
                    className="p-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors shadow-sm"
                    aria-label="Toggle Theme"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
        </div>
    )
}