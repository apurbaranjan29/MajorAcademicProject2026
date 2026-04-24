'use client'

import { useState, useEffect } from 'react'
import Layout from '../../components/MainLayout'
import { Activity, Users, ShieldAlert, Copy, Check, Lock } from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

export default function ProviderDashboard() {
    const { signer, account } = useWeb3()

    const [authorizedPatients, setAuthorizedPatients] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    // New State for our custom Copy UI
    const [copiedWallet, setCopiedWallet] = useState(null)

    useEffect(() => {
        if (signer && account) {
            loadAuthorizedPatients()
        } else {
            setIsLoading(false)
        }
    }, [signer, account])

    const loadAuthorizedPatients = async () => {
        setIsLoading(true)
        try {
            const identityContract = getContract('PatientIdentity', signer)
            const filter = identityContract.filters.ConsentGranted(null, account)
            const events = await identityContract.queryFilter(filter)
            const uniquePatients = [...new Set(events.map(e => e.args.patient))]

            const validPatients = []
            for (let patientWallet of uniquePatients) {
                const details = await identityContract.getConsentDetails(patientWallet, account)

                if (details.granted && !details.isExpired) {
                    let pName = "On-Chain Patient"
                    let pAge = "--"
                    let pWard = "Unknown"

                    try {
                        const hash = await identityContract.patientMetadata(patientWallet)
                        if (hash) {
                            const res = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`)
                            const data = await res.json()
                            if (data.name) pName = data.name
                            if (data.age) pAge = data.age
                            if (data.ward) pWard = data.ward
                        }
                    } catch (e) {
                        console.log("Could not fetch IPFS metadata for", patientWallet)
                    }

                    validPatients.push({
                        name: pName,
                        age: pAge,
                        ward: pWard,
                        wallet: patientWallet,
                        expiresAt: new Date(Number(details.expiresAt) * 1000).toLocaleDateString()
                    })
                }
            }
            setAuthorizedPatients(validPatients)
        } catch (error) {
            console.error("Failed to load authorized patients:", error)
        }
        setIsLoading(false)
    }

    // Modern Copy Function
    const handleCopy = (walletAddress) => {
        navigator.clipboard.writeText(walletAddress)
        setCopiedWallet(walletAddress)

        // Reset the icon and hide the popup after 2 seconds
        setTimeout(() => {
            setCopiedWallet(null)
        }, 2000)
    }

    return (
        <Layout title="Provider Portal" subtitle="View your cryptographically authorized patients">
            <div className="max-w-[1000px] mx-auto pb-20 page-transition space-y-8">

                {/* HERO SECTION */}
                <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl heading-display mb-3">Authorized Roster</h1>
                    <p className="text-[14px] text-[#86868b] max-w-lg mx-auto">
                        A secure overview of patients who have granted your wallet active decryption rights.
                    </p>
                </div>

                {/* MAIN CONTAINER */}
                <div className="apple-card overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-700">

                    {/* HEADER */}
                    <div className="p-5 border-b border-[#424245] flex justify-between items-center bg-[#1d1d1f]/80">
                        <div className="flex items-center gap-3">
                            <Users size={16} className="text-[#0071e3]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">Patient Authorizations</span>
                        </div>
                        <div className="px-3 py-1 bg-[#00ff41]/10 rounded-full border border-[#00ff41]/20 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] pulse-success" />
                            <span className="text-[9px] font-bold text-[#00ff41] tracking-widest uppercase">
                                {authorizedPatients.length} ACTIVE
                            </span>
                        </div>
                    </div>

                    {/* CONTENT */}
                    <div className="bg-black/20 min-h-[400px]">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-[#86868b]">
                                <Activity size={32} className="animate-spin text-[#0071e3] mb-4" />
                                <p className="text-[12px] font-medium tracking-wide uppercase">Scanning Sepolia Testnet...</p>
                            </div>
                        ) : authorizedPatients.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-[#86868b]">
                                <ShieldAlert size={48} className="mb-4 opacity-20" />
                                <h3 className="text-lg font-semibold text-[#f5f5f7] mb-2">No Active Authorizations</h3>
                                <p className="text-[13px] text-center max-w-sm">
                                    No patients have currently granted this wallet access to their medical records.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 md:p-8">
                                {authorizedPatients.map((p, idx) => (
                                    <div key={idx} className="bg-black border border-[#424245] rounded-[20px] p-6 hover:border-[#86868b] transition-all duration-300 flex flex-col justify-between">

                                        {/* Patient Identity Header */}
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-[#0071e3]/20 border border-[#0071e3]/30 text-[#0071e3] flex items-center justify-center font-bold text-[14px]">
                                                    {p.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[15px] text-[#f5f5f7] tracking-tight">{p.name}</div>
                                                    <div className="text-[11px] text-[#86868b] mt-0.5 uppercase tracking-wide">
                                                        Age: {p.age} • Ward: {p.ward}
                                                    </div>
                                                </div>
                                            </div>
                                            <Lock size={14} className="text-[#00ff41] opacity-50" />
                                        </div>

                                        <div className="space-y-5">
                                            {/* Wallet Address Field */}
                                            <div>
                                                <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">
                                                    Patient Cryptographic Identity
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[12px] font-mono text-[#f5f5f7] bg-[#1d1d1f] px-3 py-2.5 rounded-lg flex-1 truncate border border-[#424245]">
                                                        {p.wallet}
                                                    </div>
                                                    <button
                                                        onClick={() => handleCopy(p.wallet)}
                                                        className={`p-2.5 rounded-lg border transition-all duration-200 active:scale-90 ${copiedWallet === p.wallet
                                                                ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/30'
                                                                : 'bg-[#1d1d1f] text-[#0071e3] hover:bg-[#0071e3] hover:text-white border-[#424245]'
                                                            }`}
                                                        title="Copy Full Address"
                                                    >
                                                        {copiedWallet === p.wallet ? <Check size={16} /> : <Copy size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expiry Details */}
                                            <div className="pt-5 border-t border-[#424245] flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">
                                                        Access Expires
                                                    </div>
                                                    <div className="text-[13px] font-mono text-[#f5f5f7] mt-1">
                                                        {p.expiresAt}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] pulse-success" />
                                                    <span className="text-[9px] font-bold text-[#00ff41] uppercase tracking-widest">
                                                        Decryption Active
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* CUSTOM FLOATING TOAST NOTIFICATION (Apple Style) */}
                {copiedWallet && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#1d1d1f]/90 backdrop-blur-md border border-[#424245] text-[#f5f5f7] px-6 py-3 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <div className="w-6 h-6 rounded-full bg-[#00ff41]/20 flex items-center justify-center text-[#00ff41]">
                            <Check size={14} strokeWidth={3} />
                        </div>
                        <span className="text-[13px] font-semibold tracking-wide">Wallet Copied to Clipboard</span>
                    </div>
                )}

            </div>
        </Layout>
    )
}