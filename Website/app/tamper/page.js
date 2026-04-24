'use client'

import { useState } from 'react'
import { ethers } from 'ethers'
import Layout from '../../components/MainLayout'
import {
    FileSearch, ShieldCheck, ShieldAlert,
    Activity, Database, Link as LinkIcon,
    AlertTriangle, RefreshCcw, Cpu
} from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

export default function TamperDetection() {
    const { signer } = useWeb3()

    // State
    const [searchRecordId, setSearchRecordId] = useState('')
    const [isFetching, setIsFetching] = useState(false)
    const [fetchError, setFetchError] = useState('')
    const [originalRecordData, setOriginalRecordData] = useState(null)
    const [originalHash, setOriginalHash] = useState('')
    const [editableJson, setEditableJson] = useState('')
    const [currentLocalHash, setCurrentLocalHash] = useState('')

    const calculateEthereumHash = (text) => {
        try {
            const bytes = ethers.toUtf8Bytes(text)
            return ethers.keccak256(bytes)
        } catch (e) {
            return "0x..."
        }
    }

    const handleFetchRecord = async (e) => {
        e.preventDefault()
        if (!signer || !searchRecordId) return
        setIsFetching(true)
        setFetchError('')

        try {
            const recordsContract = getContract('MedicalRecords', signer)
            const ipfsHash = await recordsContract.viewMedicalRecord.staticCall(searchRecordId, "Doctor")
            const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`)
            const data = await res.json()
            const jsonString = JSON.stringify(data, null, 2)
            const trueHash = calculateEthereumHash(jsonString)

            setOriginalRecordData({ id: searchRecordId, ipfs: ipfsHash })
            setOriginalHash(trueHash)
            setEditableJson(jsonString)
            setCurrentLocalHash(trueHash)
        } catch (err) {
            setFetchError("Access Denied: Record not found or no consent.")
        }
        setIsFetching(false)
    }

    const handleJsonChange = (e) => {
        const newValue = e.target.value
        setEditableJson(newValue)
        setCurrentLocalHash(calculateEthereumHash(newValue))
    }

    const isAuthentic = originalHash === currentLocalHash

    return (
        <Layout title="Tamper Detection" subtitle="Forensic integrity engine">
            <div className="max-w-[1100px] mx-auto px-6 pb-20 page-transition">

                {/* HERO SEARCH SECTION */}
                <div className="text-center py-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <h1 className="text-5xl heading-display mb-6">Integrity. Verified.</h1>
                    <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-10">
                        Compare local database states against immutable blockchain anchors in real-time.
                    </p>

                    <form onSubmit={handleFetchRecord} className="flex max-w-md mx-auto bg-[#1d1d1f] p-2 rounded-full border border-[#424245] shadow-2xl">
                        <div className="flex-1 flex items-center px-4 gap-3">
                            <FileSearch size={18} className="text-[#86868b]" />
                            <input
                                type="number"
                                value={searchRecordId}
                                onChange={(e) => setSearchRecordId(e.target.value)}
                                placeholder="Enter Record ID"
                                className="bg-transparent border-none text-white text-sm outline-none w-full font-medium"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isFetching}
                            className="bg-white text-black btn-pill text-[13px] font-bold hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {isFetching ? <RefreshCcw size={14} className="animate-spin" /> : 'Fetch Anchor'}
                        </button>
                    </form>
                    {fetchError && <p className="text-[#ff3b30] text-xs font-medium mt-4">{fetchError}</p>}
                </div>

                {originalRecordData && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in zoom-in duration-700">

                        {/* LOCAL DATABASE PANEL */}
                        <div className="apple-card overflow-hidden flex flex-col h-full">
                            <div className="p-4 border-b border-[#424245] flex justify-between items-center bg-[#1d1d1f]/50">
                                <div className="flex items-center gap-2">
                                    <Database size={14} className="text-blue-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">Hospital Database</span>
                                </div>
                                <div className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[#ffcc00] text-[9px] font-bold">
                                    LIVE SIMULATOR
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-[11px] text-[#86868b] leading-relaxed">
                                    Modify the clinical record below to simulate a database breach.
                                </p>
                                <textarea
                                    value={editableJson}
                                    onChange={handleJsonChange}
                                    className="w-full h-64 bg-black/40 border border-[#424245] rounded-xl p-4 text-[13px] font-mono text-blue-400 focus:border-blue-500 outline-none resize-none transition-all"
                                    spellCheck="false"
                                />

                                <div className="pt-4 space-y-2">
                                    <span className="text-[10px] font-bold text-[#424245] uppercase tracking-widest">Local Keccak-256 Hash</span>
                                    <div className={`p-3 rounded-lg font-mono text-[10px] break-all transition-all duration-500 ${isAuthentic ? 'bg-black text-[#86868b] border border-[#424245]' : 'bg-red-500/10 text-[#ff3b30] border border-[#ff3b30]/30 shadow-[0_0_15px_rgba(255,59,48,0.1)]'
                                        }`}>
                                        {currentLocalHash}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BLOCKCHAIN ANCHOR PANEL */}
                        <div className={`apple-card overflow-hidden flex flex-col h-full transition-all duration-700 ${isAuthentic ? 'border-[#00ff41]/30 shadow-[0_0_40px_rgba(0,255,65,0.05)]' : 'border-[#ff3b30]/30 shadow-[0_0_40px_rgba(255,59,48,0.05)]'
                            }`}>
                            <div className="p-4 border-b border-[#424245] flex justify-between items-center bg-[#1d1d1f]/50">
                                <div className="flex items-center gap-2">
                                    <LinkIcon size={14} className="text-[#0071e3]" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">Blockchain State</span>
                                </div>
                                <div className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#0071e3] text-[9px] font-bold">
                                    SEPOLIA ANCHOR
                                </div>
                            </div>

                            <div className="p-6 flex-1 flex flex-col">
                                <div className="space-y-2 mb-8">
                                    <span className="text-[10px] font-bold text-[#424245] uppercase tracking-widest">On-Chain Reference Hash</span>
                                    <div className="p-3 bg-black border border-[#424245] rounded-lg font-mono text-[10px] text-blue-400 break-all">
                                        {originalHash}
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                                    {isAuthentic ? (
                                        <div className="animate-in zoom-in duration-500 flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-full bg-[#00ff41]/10 border border-[#00ff41]/40 flex items-center justify-center mb-6 pulse-success">
                                                <ShieldCheck size={40} className="text-[#00ff41]" />
                                            </div>
                                            <h3 className="text-2xl heading-display text-[#00ff41] mb-2 tracking-tight">Authentic</h3>
                                            <p className="text-[12px] text-[#86868b] max-w-[220px]">
                                                The local record matches the immutable blockchain signature.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="animate-in shake duration-500 flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-full bg-[#ff3b30]/10 border border-[#ff3b30]/40 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,59,48,0.2)]">
                                                <AlertTriangle size={40} className="text-[#ff3b30]" />
                                            </div>
                                            <h3 className="text-2xl heading-display text-[#ff3b30] mb-2 tracking-tight">Compromised</h3>
                                            <p className="text-[12px] text-[#86868b] max-w-[220px]">
                                                Forensic mismatch detected. The local database has been tampered with.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 pt-6 border-t border-[#424245] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Cpu size={14} className="text-[#86868b]" />
                                        <span className="text-[9px] text-[#86868b] font-bold uppercase tracking-widest">Keccak-256 Engine</span>
                                    </div>
                                    <span className="text-[9px] font-mono text-blue-500 uppercase">Ver: 1.0.4-forensic</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}