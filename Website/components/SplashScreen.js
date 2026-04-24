'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'

export default function SplashScreen() {
    const [isVisible, setIsVisible] = useState(true)
    const [isFading, setIsFading] = useState(false)

    useEffect(() => {
        // Start the fade-out effect after 2 seconds
        const fadeTimer = setTimeout(() => setIsFading(true), 2000)

        // Completely remove the component from the DOM after 2.5 seconds
        const removeTimer = setTimeout(() => setIsVisible(false), 2000)

        return () => {
            clearTimeout(fadeTimer)
            clearTimeout(removeTimer)
        }
    }, [])

    if (!isVisible) return null

    return (
        <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>

            <div className="relative flex items-center justify-center mb-8 animate-in zoom-in duration-700">
                {/* Subtle blue ambient glow behind the logo */}
                <div className="absolute inset-0 bg-[#0071e3] blur-[60px] opacity-20 rounded-full w-32 h-32" />

                {/* The Blockchain Node Icon (From your 2nd image) */}
                <div className="relative z-10 w-20 h-20 rounded-[20px] bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                    <svg width="40" height="40" viewBox="0 0 14 14" fill="none" className="text-black">
                        <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M5.5 3.5H7a3.5 3.5 0 013.5 3.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>

                {/* The IoT Pulse Badge (From your 1st image) */}
                <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-xl bg-[#0071e3] flex items-center justify-center shadow-lg border-[3px] border-black z-20">
                    <Activity size={18} className="text-white" strokeWidth={3} />
                </div>
            </div>

            <div className="text-center animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-300">
                <h1 className="text-2xl heading-display text-[#f5f5f7] mb-3 tracking-tight">
                    SC-BHIoT
                </h1>

                {/* Boot Sequence Text */}
                <div className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-ping" />
                    <p className="text-[10px] text-[#86868b] font-mono uppercase tracking-widest">
                        Initializing BLOCKCHAIN Secure Environment...
                    </p>
                </div>
            </div>

        </div>
    )
}