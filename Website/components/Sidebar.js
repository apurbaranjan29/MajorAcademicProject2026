'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Users,
    Upload,
    Download,
    ShieldCheck,
    FileSearch,
    Activity,
    Stethoscope,
    PackageCheck,
} from 'lucide-react'

const NAV_ITEMS = [
    {
        section: 'Overview',
        links: [
            { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        section: 'Core Functions',
        links: [
            { href: '/registry', label: 'Patient Registry', icon: Users },
            { href: '/upload', label: 'Data Upload', icon: Upload },
            { href: '/retrieve', label: 'Data Retrieval', icon: Download },
            { href: '/consent', label: 'Consent Manager', icon: ShieldCheck },
            { href: '/provider', label: 'Provider Portal', icon: Stethoscope },
            { href: '/verify', label: 'Drug Authenticity', icon: PackageCheck },
            { href: '/tamper', label: 'Tamper Detection', icon: FileSearch },
        ],
    },
    {
        section: 'Monitor',
        links: [
            { href: '/iot', label: 'IoT Vitals', icon: Activity },
        ],
    },
]

export default function Sidebar() {
    const pathname = usePathname()

    return (
        <aside
            className="
                fixed top-0 left-0 h-screen z-30 flex flex-col
                w-[240px]
                bg-black
                border-r border-[#1d1d1f]
                transition-all duration-300
            "
        >
            {/* Apple-Style Brand Block */}
            <div className="flex items-center gap-3 px-6 py-8">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="black" strokeWidth="1.5" />
                        <rect x="8" y="8" width="5" height="5" rx="1.5" stroke="black" strokeWidth="1.5" />
                        <path d="M5.5 3.5H7a3.5 3.5 0 013.5 3.5V8.5" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </div>
                <div>
                    <p className="font-semibold text-[15px] text-white tracking-tight leading-none">
                        B-IoT
                    </p>
                    <p className="text-[10px] text-[#86868b] font-medium tracking-wide mt-1 uppercase">
                        Blockchain Healthcare Node
                    </p>
                </div>
            </div>

            {/* Navigation Gear */}
            <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-8">
                {NAV_ITEMS.map((group) => (
                    <div key={group.section}>
                        <p className="px-4 mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#424245]">
                            {group.section}
                        </p>
                        <ul className="space-y-1">
                            {group.links.map(({ href, label, icon: Icon }) => {
                                const active = pathname === href
                                return (
                                    <li key={href}>
                                        <Link
                                            href={href}
                                            className={`
                                                flex items-center gap-3 px-4 py-2.5 rounded-full
                                                text-[13px] font-medium transition-all duration-300
                                                ${active
                                                    ? 'bg-white text-black shadow-lg scale-[1.02]'
                                                    : 'text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1d1d1f]'
                                                }
                                            `}
                                        >
                                            <Icon
                                                size={16}
                                                strokeWidth={active ? 2.5 : 1.8}
                                                className="flex-shrink-0"
                                            />
                                            {label}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Network Forensic Status */}
            <div className="mx-4 my-6 p-4 rounded-2xl bg-[#1d1d1f] border border-[#272729]">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <span className="block w-2 h-2 rounded-full bg-[#00ff41]" />
                        <span className="absolute inset-0 w-2 h-2 rounded-full bg-[#00ff41] animate-ping opacity-40" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#f5f5f7]">
                        Network Secure
                    </span>
                </div>
                <div className="mt-3 space-y-1">
                    <p className="font-mono text-[9px] text-[#86868b] uppercase tracking-tighter">
                        Current Block
                    </p>
                    <p className="font-mono text-[10px] text-[#00ff41] leading-none">
                        #7,234,891
                    </p>
                </div>
            </div>
        </aside>
    )
}