'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import Layout from '../../components/MainLayout'
import { Key, ShieldCheck, ShieldAlert, Activity, Trash2, Clock, Lock } from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

export default function PatientConsentManager() {
    const { signer, account } = useWeb3()

    // Page Access State
    const [isCheckingAccess, setIsCheckingAccess] = useState(true)
    const [isRegisteredPatient, setIsRegisteredPatient] = useState(false)

    // Form State
    const [delegateWallet, setDelegateWallet] = useState('')
    const [durationText, setDurationText] = useState('180') // e.g., 6 months = 180 days
    const [isGranting, setIsGranting] = useState(false)

    // List State
    const [activeConsents, setActiveConsents] = useState([])
    const [isLoadingList, setIsLoadingList] = useState(true)

    useEffect(() => {
        if (signer && account) {
            verifyAccessAndLoadData()
        } else {
            setIsCheckingAccess(false)
            setIsLoadingList(false)
        }
    }, [signer, account])

    const verifyAccessAndLoadData = async () => {
        setIsCheckingAccess(true)
        try {
            const identityContract = getContract('PatientIdentity', signer)
            const isPatient = await identityContract.isRegisteredPatient(account)
            setIsRegisteredPatient(isPatient)

            if (isPatient) {
                await fetchActiveConsents(identityContract)
            }
        } catch (error) {
            console.error("Access verification failed:", error)
        }
        setIsCheckingAccess(false)
    }

    const fetchActiveConsents = async (identityContract) => {
        setIsLoadingList(true)
        try {
            const filter = identityContract.filters.ConsentGranted(account, null)
            const events = await identityContract.queryFilter(filter)
            const uniqueDelegates = [...new Set(events.map(e => e.args.delegate))]

            const validConsents = []

            for (let delegate of uniqueDelegates) {
                const details = await identityContract.getConsentDetails(account, delegate)
                if (details.granted && !details.isExpired) {
                    validConsents.push({
                        delegate: delegate,
                        shortDelegate: `${delegate.substring(0, 6)}...${delegate.substring(delegate.length - 4)}`,
                        expiresAt: new Date(Number(details.expiresAt) * 1000).toLocaleDateString()
                    })
                }
            }

            setActiveConsents(validConsents)
        } catch (error) {
            console.error("Failed to fetch consents:", error)
        }
        setIsLoadingList(false)
    }

    const handleGrantConsent = async (e) => {
        e.preventDefault()
        if (!signer || !ethers.isAddress(delegateWallet)) return alert("Invalid wallet address")

        setIsGranting(true)
        try {
            const identityContract = getContract('PatientIdentity', signer)
            const days = parseInt(durationText)
            const tx = await identityContract.grantConsent(delegateWallet, days)
            await tx.wait()

            setDelegateWallet('')
            await fetchActiveConsents(identityContract)
        } catch (error) {
            console.error("Grant failed:", error)
            alert(error.reason || "Transaction failed")
        }
        setIsGranting(false)
    }

    const handleRevoke = async (delegateToRevoke) => {
        if (!confirm("Revoke access immediately? This will permanently sever their decryption rights.")) return
        try {
            const identityContract = getContract('PatientIdentity', signer)
            const tx = await identityContract.revokeConsent(delegateToRevoke)
            await tx.wait()
            await fetchActiveConsents(identityContract)
        } catch (error) {
            console.error("Revoke failed:", error)
            alert(error.reason || "Failed to revoke consent")
        }
    }

    // --- RENDER ACCESS DENIED SCREEN (LOCKED VAULT STYLE) ---
    if (!isCheckingAccess && !isRegisteredPatient) {
        return (
            <Layout title="Access Denied" subtitle="Patient Portal Only">
                <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 page-transition">
                    <div className="max-w-md w-full bg-[#1d1d1f] border border-[#424245] rounded-[24px] p-10 text-center shadow-2xl">
                        <div className="w-20 h-20 bg-[#ff3b30]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#ff3b30]/20">
                            <Lock size={36} className="text-[#ff3b30]" />
                        </div>
                        <h2 className="text-2xl heading-display text-[#f5f5f7] mb-3">Restricted Access</h2>
                        <p className="text-[13px] text-[#86868b] leading-relaxed mb-6">
                            This cryptographic privacy manager is restricted to registered patients.
                            Your current wallet <span className="font-mono text-[#f5f5f7] bg-black px-1.5 py-0.5 rounded border border-[#424245] mx-1">{account ? account.substring(0, 6) + '...' : 'None'}</span>
                            is not recognized by the master ledger.
                        </p>
                    </div>
                </div>
            </Layout>
        )
    }

    // --- RENDER PATIENT DASHBOARD ---
    return (
        <Layout title="Consent Manager" subtitle="Patient-controlled cryptographic access rights">
            <div className="max-w-[1000px] mx-auto pb-20 page-transition space-y-8">

                {/* HERO SECTION */}
                <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl heading-display mb-3">Privacy & Cryptography</h1>
                    <p className="text-[14px] text-[#86868b] max-w-lg mx-auto">
                        Delegate and revoke decryption rights to your clinical data on the blockchain.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

                    {/* LEFT PANEL: Grant Access Form */}
                    <div className="md:col-span-5 apple-card overflow-hidden h-fit shadow-2xl animate-in slide-in-from-left-8 duration-700">
                        <div className="p-5 border-b border-[#424245] bg-[#1d1d1f]/80 flex items-center gap-3">
                            <Key size={16} className="text-[#0071e3]" />
                            <h3 className="font-bold text-[#86868b] text-[10px] uppercase tracking-widest">Delegate Access</h3>
                        </div>

                        <form onSubmit={handleGrantConsent} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Provider Wallet</label>
                                <input
                                    type="text" required value={delegateWallet} onChange={(e) => setDelegateWallet(e.target.value.trim())}
                                    placeholder="0x..."
                                    className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-3.5 text-[14px] text-[#f5f5f7] outline-none font-mono transition-all shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Assign Role</label>
                                <select className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-3.5 text-[14px] text-[#f5f5f7] outline-none transition-all shadow-inner appearance-none">
                                    <option value="Doctor">Doctor</option>
                                    <option value="Specialist">Specialist</option>
                                    <option value="Insurer">Insurer</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Time Limit</label>
                                <select value={durationText} onChange={(e) => setDurationText(e.target.value)} className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-3.5 text-[14px] text-[#f5f5f7] outline-none transition-all shadow-inner appearance-none">
                                    <option value="1">24 Hours (Emergency)</option>
                                    <option value="7">1 Week</option>
                                    <option value="30">1 Month</option>
                                    <option value="180">6 Months</option>
                                    <option value="365">1 Year</option>
                                </select>
                            </div>

                            <button
                                type="submit" disabled={isGranting}
                                className="w-full bg-[#0071e3] hover:bg-[#0066cc] text-white btn-pill text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-[0_4px_20px_rgba(0,113,227,0.3)] mt-8 h-[48px]"
                            >
                                {isGranting ? <Activity size={16} className="animate-spin" /> : 'Sign Consent Smart Contract'}
                            </button>
                        </form>
                    </div>

                    {/* RIGHT PANEL: Active Consents List */}
                    <div className="md:col-span-7 apple-card overflow-hidden flex flex-col h-[500px] shadow-2xl animate-in slide-in-from-right-8 duration-700">
                        <div className="p-5 border-b border-[#424245] flex justify-between items-center bg-[#1d1d1f]/80">
                            <div className="flex items-center gap-3">
                                <ShieldCheck size={16} className="text-[#00ff41]" />
                                <h3 className="font-bold text-[#86868b] text-[10px] uppercase tracking-widest">Active Cryptographic Consents</h3>
                            </div>
                            <div className="px-3 py-1 bg-[#00ff41]/10 rounded-full border border-[#00ff41]/20 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] pulse-success" />
                                <span className="text-[9px] font-bold text-[#00ff41] tracking-widest uppercase">
                                    {activeConsents.length} ACTIVE
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto bg-black/20">
                            {isLoadingList ? (
                                <div className="flex flex-col justify-center items-center h-full text-[#86868b]">
                                    <Activity className="animate-spin text-[#0071e3] mb-3" size={24} />
                                    <span className="text-[11px] uppercase tracking-widest font-bold">Querying Ledger</span>
                                </div>
                            ) : activeConsents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-[#86868b]">
                                    <ShieldAlert size={40} className="mb-4 opacity-20" />
                                    <p className="text-[13px] font-medium mb-1 text-[#f5f5f7]">No Active Decryption Rights</p>
                                    <p className="text-[11px]">Grant access to a provider to populate this list.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {activeConsents.map((consent, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-4 bg-black border border-[#424245] rounded-[14px] hover:border-[#86868b] transition-colors">
                                            <div>
                                                <div className="text-[14px] font-mono text-[#0071e3] font-semibold">{consent.shortDelegate}</div>
                                                <div className="text-[11px] text-[#86868b] flex items-center gap-1.5 mt-2 font-medium">
                                                    <Clock size={12} /> Auto-Revokes: {consent.expiresAt}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRevoke(consent.delegate)}
                                                className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[#ff3b30] hover:text-white border border-[#ff3b30]/30 hover:bg-[#ff3b30] hover:border-[#ff3b30] rounded-full transition-all active:scale-95"
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </Layout>
    )
}