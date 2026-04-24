'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { useWeb3 } from '../context/Web3Context'
import { Sun, Moon } from 'lucide-react'

export default function MainLayout({ children, title, subtitle }) {
  const { account } = useWeb3()
  const [isDark, setIsDark] = useState(true)

  // Apply theme on mount and when toggled
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') {
      setIsDark(false)
      document.body.classList.add('light-theme')
    }
  }, [])

  const toggleTheme = () => {
    if (isDark) {
      document.body.classList.add('light-theme')
      localStorage.setItem('theme', 'light')
    } else {
      document.body.classList.remove('light-theme')
      localStorage.setItem('theme', 'dark')
    }
    setIsDark(!isDark)
  }

  return (
    // Added 'theme-transition' for smooth Apple-style fading
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--text-primary)] theme-transition">
      <Sidebar />

      <main className="flex-1 ml-[240px] flex flex-col relative">

        {/* STICKY HEADER - Now with functional toggle */}
        <header className="sticky top-0 z-40 w-full bg-[var(--background)]/60 backdrop-blur-xl border-b border-[var(--border)] theme-transition">
          <div className="max-w-[1200px] mx-auto px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-[19px] font-semibold tracking-tight leading-tight">
                {title}
              </h1>
              <p className="text-[12px] text-[var(--text-secondary)] font-medium leading-tight mt-0.5">
                {subtitle}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Wallet Status */}
              <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-full shadow-inner theme-transition">
                <div className={`w-1.5 h-1.5 rounded-full ${account ? 'bg-[#00ff41] pulse-success' : 'bg-[#ff3b30]'}`} />
                <span className="text-[11px] font-mono">
                  {account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 'No Connection'}
                </span>
              </div>

              {/* THE TOGGLE BUTTON */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-[var(--card)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-all active:scale-90 border border-transparent hover:border-[var(--border)]"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  )
}