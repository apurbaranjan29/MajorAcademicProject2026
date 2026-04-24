'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import Layout from '../../components/MainLayout'
import {
    UserPlus, Database, Copy, Lock, Activity,
    ShieldCheck, CheckCircle2, AlertTriangle
} from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

export default function RegistryPage() {
    const { signer, account } = useWeb3()

    // Form State
    const [fullName, setFullName] = useState('')
    const [age, setAge] = useState('')
    const [ward, setWard] = useState('General Ward')
    const [patientWallet, setPatientWallet] = useState('')
    const [isRegistering, setIsRegistering] = useState(false)
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' })

    // Ledger State
    const [patients, setPatients] = useState([])
    const [isLoadingLedger, setIsLoadingLedger] = useState(true)

    // LOAD PATIENTS FROM SEPOLIA ON MOUNT
    useEffect(() => {
        if (signer) {
            fetchPatientLedger()
        } else {
            setIsLoadingLedger(false)
        }
    }, [signer])

    const fetchPatientLedger = async () => {
        setIsLoadingLedger(true)
        try {
            const identityContract = getContract('PatientIdentity', signer)
            const recordsContract = getContract('MedicalRecords', signer)

            const filter = identityContract.filters.PatientRegistered()
            const events = await identityContract.queryFilter(filter)
            const addresses = [...new Set(events.map(e => e.args.patient))]

            if (!addresses || addresses.length === 0) {
                setPatients([])
                setIsLoadingLedger(false)
                return
            }

            const loadedPatients = await Promise.all(addresses.map(async (addr, index) => {
                let name = "Unknown"
                let patientAge = "--"
                let ipfsHash = ""
                let recCount = 0

                try {
                    ipfsHash = await identityContract.patientMetadata(addr)
                    if (ipfsHash) {
                        const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`)
                        const data = await res.json()
                        name = data.name || "Unknown"
                        patientAge = data.age || "--"
                    }
                    const countBigInt = await recordsContract.getRecordCount(addr)
                    recCount = Number(countBigInt)
                } catch (err) {
                    console.log(`Failed to fetch full data for ${addr}`, err)
                }

                return {
                    id: `P${String(index + 1).padStart(3, '0')}`,
                    name: name,
                    age: patientAge,
                    wallet: addr,
                    shortWallet: `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`,
                    ipfsHash: ipfsHash,
                    shortHash: ipfsHash ? `${ipfsHash.substring(0, 16)}...` : 'No Hash',
                    records: recCount,
                    consents: 1
                }
            }))

            setPatients(loadedPatients.reverse())
        } catch (error) {
            console.error("Error fetching ledger from events:", error)
        }
        setIsLoadingLedger(false)
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        if (!signer) return setStatusMsg({ text: 'Please connect MetaMask.', type: 'error' })

        setIsRegistering(true)
        setStatusMsg({ text: '', type: '' })

        try {
            setStatusMsg({ text: 'Encrypting Identity and Uploading to IPFS...', type: 'loading' })
            const identityPayload = { name: fullName, age, ward, type: "PATIENT_REGISTRY" }
            const pinataRes = await fetch('/api/pinata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(identityPayload)
            })
            const pinataData = await pinataRes.json()
            if (!pinataData.success) throw new Error("Pinata Upload Failed")

            setStatusMsg({ text: 'Awaiting signature to anchor to Sepolia...', type: 'loading' })
            const identityContract = getContract('PatientIdentity', signer)
            const tx = await identityContract.registerPatient(patientWallet, pinataData.ipfsHash)

            setStatusMsg({ text: 'Transaction processing on blockchain...', type: 'loading' })
            await tx.wait()

            setStatusMsg({ text: 'Patient successfully onboarded to Sepolia!', type: 'success' })

            setFullName('')
            setAge('')
            setPatientWallet('')
            fetchPatientLedger()

        } catch (error) {
            console.error(error)
            setStatusMsg({ text: error.reason || error.message || 'Transaction failed', type: 'error' })
        }
        setIsRegistering(false)
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
    }

    return (
        <Layout title="Patient Registry" subtitle="Identity Management & Access Control">
            <div className="max-w-[1000px] mx-auto pb-20 page-transition space-y-10">

                {/* HERO SECTION */}
                <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl heading-display mb-3">Global Patient Ledger</h1>
                    <p className="text-[14px] text-[#86868b] max-w-lg mx-auto">
                        Register cryptographic identities to the decentralized healthcare network.
                    </p>
                </div>

                {/* ONBOARDING FORM */}
                <div className="apple-card overflow-hidden shadow-2xl">
                    <div className="p-5 border-b border-[#424245] bg-[#1d1d1f]/80 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <UserPlus size={16} className="text-[#0071e3]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">New Identity Registration</span>
                        </div>
                    </div>

                    <form onSubmit={handleRegister} className="p-6 md:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Full Name *</label>
                                <input
                                    type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-3.5 text-[14px] text-[#f5f5f7] outline-none transition-all shadow-inner"
                                />
                            </div>

                            <div className="col-span-1 lg:col-span-1 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Age</label>
                                    <input
                                        type="number" required value={age} onChange={(e) => setAge(e.target.value)}
                                        placeholder="00"
                                        className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-3.5 text-[14px] text-[#f5f5f7] outline-none transition-all shadow-inner"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Ward</label>
                                    <select
                                        value={ward}
                                        onChange={(e) => setWard(e.target.value)}
                                        className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-3.5 text-[14px] text-[#f5f5f7] outline-none transition-all shadow-inner appearance-none"
                                    >
                                        <option value="General Ward">General</option>
                                        <option value="ICU (Intensive Care)">ICU</option>
                                        <option value="Emergency (ER)">ER</option>
                                        <option value="Pediatrics">Pediatrics</option>
                                        <option value="Cardiology">Cardiology</option>
                                        <option value="Neurology">Neurology</option>
                                        <option value="Oncology">Oncology</option>
                                        <option value="Maternity">Maternity</option>
                                    </select>
                                </div>
                            </div>

                            <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Patient Wallet *</label>
                                <input
                                    type="text" required value={patientWallet} onChange={(e) => setPatientWallet(e.target.value.trim())}
                                    placeholder="0x..."
                                    className="w-full bg-black border border-[#424245] focus:border-[#0071e3] rounded-xl p-3.5 text-[14px] font-mono text-[#f5f5f7] outline-none transition-all shadow-inner"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-4 lg:col-span-1 h-[52px]">
                                <button
                                    type="submit" disabled={isRegistering}
                                    className="w-full h-full bg-[#0071e3] hover:bg-[#0066cc] text-white btn-pill text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-[0_4px_20px_rgba(0,113,227,0.3)]"
                                >
                                    {isRegistering ? <Activity size={16} className="animate-spin" /> : 'Anchor Identity'}
                                </button>
                            </div>
                        </div>

                        {/* STATUS FEEDBACK */}
                        {statusMsg.text && (
                            <div className="mt-6 pt-6 border-t border-[#424245]">
                                {statusMsg.type === 'error' && (
                                    <div className="p-4 bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-xl flex items-center gap-3 animate-in shake">
                                        <AlertTriangle size={18} className="text-[#ff3b30]" />
                                        <p className="text-[12px] text-[#ff3b30] font-medium">{statusMsg.text}</p>
                                    </div>
                                )}
                                {statusMsg.type === 'loading' && (
                                    <div className="p-4 bg-[#0071e3]/10 border border-[#0071e3]/30 rounded-xl flex items-center gap-3 animate-in fade-in">
                                        <Activity size={18} className="text-[#0071e3] animate-spin" />
                                        <p className="text-[12px] text-[#0071e3] font-medium">{statusMsg.text}</p>
                                    </div>
                                )}
                                {statusMsg.type === 'success' && (
                                    <div className="p-4 bg-[#00ff41]/10 border border-[#00ff41]/30 rounded-xl flex items-center gap-3 animate-in zoom-in">
                                        <CheckCircle2 size={18} className="text-[#00ff41]" />
                                        <p className="text-[12px] text-[#00ff41] font-medium">{statusMsg.text}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {/* DYNAMIC LEDGER LIST */}
                <div className="apple-card overflow-hidden">
                    <div className="p-5 border-b border-[#424245] flex justify-between items-center bg-[#1d1d1f]/80">
                        <div className="flex items-center gap-3">
                            <Database size={16} className="text-[#86868b]" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">Immutable Network Ledger</span>
                        </div>
                        <div className="px-3 py-1 bg-black rounded-full border border-[#424245] text-[#f5f5f7] text-[10px] font-mono">
                            {patients.length} NODES
                        </div>
                    </div>

                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#424245] text-[9px] font-bold text-[#86868b] uppercase tracking-widest bg-black/40">
                        <div className="col-span-4 lg:col-span-3">Patient Profile</div>
                        <div className="col-span-4 lg:col-span-3">Public Address</div>
                        <div className="col-span-4 lg:col-span-3 hidden lg:block">IPFS Anchor</div>
                        <div className="col-span-2 text-center hidden md:block">Datasets</div>
                        <div className="col-span-4 md:col-span-2 lg:col-span-1 text-center">Network</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-[#424245] max-h-[600px] overflow-y-auto">
                        {isLoadingLedger ? (
                            <div className="p-16 flex flex-col items-center justify-center text-[#86868b]">
                                <Activity size={28} className="animate-spin mb-4 text-[#0071e3]" />
                                <p className="text-[12px] font-medium tracking-wide">Syncing with Sepolia Testnet...</p>
                            </div>
                        ) : patients.length === 0 ? (
                            <div className="p-16 text-center text-[#86868b] text-[12px]">
                                No cryptographic identities found on the blockchain.
                            </div>
                        ) : (
                            patients.map((patient, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-[#f5f5f7]/5 transition-colors cursor-default">

                                    {/* Patient Details */}
                                    <div className="col-span-4 lg:col-span-3 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#0071e3]/20 border border-[#0071e3]/30 text-[#0071e3] flex items-center justify-center font-bold text-[13px] shrink-0">
                                            {patient.name.charAt(0)}
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="font-semibold text-[13px] text-[#f5f5f7] truncate">{patient.name}</div>
                                            <div className="text-[10px] text-[#86868b] font-mono mt-0.5">{patient.id} • {patient.age}Y</div>
                                        </div>
                                    </div>

                                    {/* Wallet Address */}
                                    <div className="col-span-4 lg:col-span-3 flex items-center gap-2 text-[12px] font-mono text-[#f5f5f7]">
                                        {patient.shortWallet}
                                        <button onClick={() => copyToClipboard(patient.wallet)} className="text-[#86868b] hover:text-[#0071e3] transition-colors ml-1 active:scale-90">
                                            <Copy size={13} />
                                        </button>
                                    </div>

                                    {/* IPFS Hash */}
                                    <div className="col-span-3 hidden lg:block">
                                        <div className="inline-flex items-center gap-2 bg-black border border-[#424245] rounded-md px-2.5 py-1.5 text-[10px] font-mono text-[#86868b]">
                                            <Lock size={10} className="text-[#f59e0b]" />
                                            {patient.shortHash}
                                        </div>
                                    </div>

                                    {/* Metrics */}
                                    <div className="col-span-2 hidden md:flex justify-center gap-6">
                                        <div className="text-center">
                                            <div className="font-semibold text-[#f5f5f7] text-[13px]">{patient.records}</div>
                                            <div className="text-[8px] text-[#86868b] uppercase tracking-widest mt-0.5">Recs</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="font-semibold text-[#f5f5f7] text-[13px]">{patient.consents}</div>
                                            <div className="text-[8px] text-[#86868b] uppercase tracking-widest mt-0.5">Cons</div>
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-4 md:col-span-2 lg:col-span-1 flex justify-center">
                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#00ff41]/10 border border-[#00ff41]/20">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] pulse-success" />
                                            <span className="text-[9px] font-bold text-[#00ff41] uppercase tracking-wider">
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    )
}