'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import Layout from '../../components/MainLayout'
import {
    UploadCloud, Fingerprint, Stethoscope,
    FileText, Activity, CheckCircle2, AlertTriangle, Link as LinkIcon
} from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

export default function UploadPage() {
    const { signer, account } = useWeb3()

    const [patientWallet, setPatientWallet] = useState('')
    const [diagnosis, setDiagnosis] = useState('')
    const [medication, setMedication] = useState('')
    const [notes, setNotes] = useState('')
    const [status, setStatus] = useState({ loading: false, error: '', success: '' })

    useEffect(() => {
        const savedWallet = sessionStorage.getItem('savedPatientWallet')
        if (savedWallet) setPatientWallet(savedWallet)
    }, [])

    const handleWalletChange = (e) => {
        const val = e.target.value
        setPatientWallet(val)
        sessionStorage.setItem('savedPatientWallet', val)
    }

    const resolvePatientIdentity = async (walletAddress) => {
        const fallback = { patientName: '', patientAge: '', patientWard: '' }
        try {
            const identityContract = getContract('PatientIdentity', signer)
            const profileHash = await identityContract.patientMetadata(walletAddress)

            if (!profileHash || profileHash.length < 10) return fallback

            const res = await fetch(`https://gateway.pinata.cloud/ipfs/${profileHash}`)
            if (!res.ok) return fallback
            const data = await res.json()

            return {
                patientName: data?.name || '',
                patientAge: data?.age || '',
                patientWard: data?.ward || ''
            }
        } catch (err) {
            return fallback
        }
    }

    const handleUpload = async (e) => {
        e.preventDefault()

        if (!signer) return setStatus({ loading: false, error: 'MetaMask connection required to sign records.', success: '' })
        if (!ethers.isAddress(patientWallet)) return setStatus({ loading: false, error: 'Invalid Ethereum wallet address format.', success: '' })

        setStatus({ loading: true, error: '', success: 'Awaiting doctor signature in MetaMask...' })

        try {
            await signer.signMessage(`Authorize medical record upload for ${patientWallet}`)

            setStatus({ loading: true, error: '', success: 'Resolving patient cryptographic identity...' })
            const patientIdentity = await resolvePatientIdentity(patientWallet)

            setStatus({ loading: true, error: '', success: 'Encrypting and anchoring payload to IPFS...' })

            const recordPayload = {
                patient: patientWallet,
                patientName: patientIdentity.patientName || '',
                patientAge: patientIdentity.patientAge || '',
                patientWard: patientIdentity.patientWard || '',
                doctor: account,
                diagnosis,
                medication,
                notes,
                date: new Date().toISOString()
            }

            const ipfsRes = await fetch('/api/pinata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recordPayload)
            })

            const ipfsData = await ipfsRes.json()
            if (!ipfsData.success) throw new Error(ipfsData.error)

            const ipfsHash = ipfsData.ipfsHash

            setStatus({ loading: true, error: '', success: 'Awaiting Sepolia gas confirmation...' })

            const recordsContract = getContract('MedicalRecords', signer)
            const tx = await recordsContract.addMedicalRecord(patientWallet, ipfsHash, 'PRESCRIPTION')

            setStatus({ loading: true, error: '', success: 'Transaction submitted. Writing to block...' })

            await tx.wait()

            setStatus({
                loading: false,
                error: '',
                success: `Record anchored successfully. CID: ${ipfsHash}`
            })

            setDiagnosis('')
            setMedication('')
            setNotes('')

        } catch (error) {
            console.error(error)
            setStatus({
                loading: false,
                error: error.reason || error.message || 'Transaction rejected or failed.',
                success: ''
            })
        }
    }

    return (
        <Layout title="Clinical Data Upload" subtitle="Anchor encrypted medical data to IPFS & Sepolia">
            <div className="max-w-[800px] mx-auto pb-20 page-transition">

                {/* HERO SECTION */}
                <div className="text-center py-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl heading-display mb-3">Secure Clinical Entry</h1>
                    <p className="text-[14px] text-[#86868b] max-w-lg mx-auto">
                        Cryptographically sign and anchor patient prescriptions to the decentralized ledger.
                    </p>
                </div>

                <div className="apple-card overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-[#424245] bg-[#1d1d1f]/80 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <UploadCloud size={16} className="text-[#0071e3]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">New Medical Record</span>
                        </div>
                        {account && (
                            <div className="flex items-center gap-2 text-[10px] text-[#86868b] font-mono">
                                <LinkIcon size={12} />
                                Doctor: {account.substring(0, 6)}...{account.substring(account.length - 4)}
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleUpload} className="p-8 md:p-10 space-y-8">

                        {/* WALLET INPUT */}
                        <div>
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2 flex items-center gap-2">
                                <Fingerprint size={12} /> Patient Identity (Wallet)
                            </label>
                            <input
                                type="text"
                                required
                                value={patientWallet}
                                onChange={handleWalletChange}
                                placeholder="0x..."
                                className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-4 text-[14px] text-[#f5f5f7] font-mono outline-none transition-all shadow-inner"
                            />
                        </div>

                        {/* DIAGNOSIS INPUT */}
                        <div>
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2 flex items-center gap-2">
                                <Stethoscope size={12} /> Primary Diagnosis
                            </label>
                            <input
                                type="text"
                                required
                                value={diagnosis}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                placeholder="e.g. Acute Bronchitis"
                                className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-4 text-[14px] text-[#f5f5f7] outline-none transition-all shadow-inner"
                            />
                        </div>

                        {/* MEDICATION INPUT */}
                        <div>
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2 flex items-center gap-2">
                                <FileText size={12} /> Medication (Rx)
                            </label>
                            <input
                                type="text"
                                required
                                value={medication}
                                onChange={(e) => setMedication(e.target.value)}
                                placeholder="e.g. Amoxicillin 500mg, 3x daily"
                                className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-4 text-[14px] font-mono text-[#0071e3] outline-none transition-all shadow-inner"
                            />
                        </div>

                        {/* CLINICAL NOTES */}
                        <div>
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Clinical Notes & Observations</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Enter detailed observations..."
                                className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-4 text-[14px] text-[#f5f5f7] outline-none transition-all shadow-inner resize-y min-h-[120px]"
                            ></textarea>
                        </div>

                        {/* DYNAMIC STATUS FEEDBACK */}
                        <div className="pt-2">
                            {status.error && (
                                <div className="p-4 bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-xl flex items-start gap-3 animate-in shake">
                                    <AlertTriangle size={18} className="text-[#ff3b30] shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-[12px] font-bold text-[#ff3b30] uppercase tracking-wider mb-1">Upload Failed</h4>
                                        <p className="text-[12px] text-[#ff3b30]/80">{status.error}</p>
                                    </div>
                                </div>
                            )}

                            {status.loading && (
                                <div className="p-4 bg-[#0071e3]/10 border border-[#0071e3]/30 rounded-xl flex items-center gap-4 animate-in fade-in">
                                    <Activity size={20} className="text-[#0071e3] animate-spin shrink-0" />
                                    <p className="text-[13px] font-medium text-[#0071e3]">{status.success}</p>
                                </div>
                            )}

                            {status.success && !status.loading && (
                                <div className="p-4 bg-[#00ff41]/10 border border-[#00ff41]/30 rounded-xl flex items-start gap-3 animate-in zoom-in duration-300">
                                    <CheckCircle2 size={20} className="text-[#00ff41] shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-[12px] font-bold text-[#00ff41] uppercase tracking-wider mb-1">Transaction Verified</h4>
                                        <p className="text-[11px] text-[#00ff41]/80 font-mono break-all">{status.success}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SUBMIT ACTION */}
                        <button
                            type="submit"
                            disabled={status.loading}
                            className="w-full bg-[#0071e3] hover:bg-[#0066cc] text-white btn-pill text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-[0_4px_20px_rgba(0,113,227,0.3)] mt-6"
                        >
                            {status.loading ? <Activity size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                            {status.loading ? 'Processing Transaction...' : 'Sign & Anchor Record'}
                        </button>
                    </form>
                </div>
            </div>
        </Layout>
    )
}