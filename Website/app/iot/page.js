'use client'

import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/MainLayout'
import {
    Activity, Wifi, WifiOff, HeartPulse, Wind,
    Droplets, Save, Database, X, ShieldAlert, Check
} from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

export default function IoTDataLogger() {
    const { signer, account } = useWeb3()

    const [patients, setPatients] = useState([])
    const [selectedPatient, setSelectedPatient] = useState('')
    const [isLoadingPatients, setIsLoadingPatients] = useState(true)

    const [isStreaming, setIsStreaming] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [sessionLogs, setSessionLogs] = useState([])

    const [copyStatus, setCopyStatus] = useState(null)

    const [vitals, setVitals] = useState({ hr: '--', spo2: '--', sys: '--', dia: '--' })
    const streamInterval = useRef(null)

    useEffect(() => {
        if (signer) loadPatients()
    }, [signer])

    const loadPatients = async () => {
        try {
            const identityContract = getContract('PatientIdentity', signer)
            const filter = identityContract.filters.PatientRegistered()
            const events = await identityContract.queryFilter(filter)
            const addresses = [...new Set(events.map(e => e.args.patient))]

            const loadedPatients = await Promise.all(addresses.map(async (addr) => {
                let pName = "Unknown Patient"
                try {
                    const hash = await identityContract.patientMetadata(addr)
                    if (hash) {
                        const res = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`)
                        const data = await res.json()
                        pName = data.name || "Unknown"
                    }
                } catch (e) { }
                return { name: pName, wallet: addr }
            }))

            setPatients(loadedPatients)
            if (loadedPatients.length > 0) setSelectedPatient(loadedPatients[0].wallet)

        } catch (error) {
            console.error("Failed to load patients:", error)
        }
        setIsLoadingPatients(false)
    }

    const toggleStream = () => {
        if (!selectedPatient) return alert("Select a patient first.")

        if (isStreaming) {
            clearInterval(streamInterval.current)
            setIsStreaming(false)
        } else {
            setSessionLogs([])
            setIsStreaming(true)

            streamInterval.current = setInterval(() => {
                const currentHr = Math.floor(Math.random() * (95 - 65 + 1)) + 65
                const currentSpo2 = Math.floor(Math.random() * (100 - 95 + 1)) + 95
                const currentSys = Math.floor(Math.random() * (125 - 110 + 1)) + 110
                const currentDia = Math.floor(Math.random() * (80 - 70 + 1)) + 70

                const reading = {
                    timestamp: new Date().toLocaleTimeString(),
                    hr: currentHr,
                    spo2: currentSpo2,
                    bp: `${currentSys}/${currentDia}`
                }

                setVitals({ hr: currentHr, spo2: currentSpo2, sys: currentSys, dia: currentDia })
                setSessionLogs(prev => [...prev, reading])
            }, 2000)
        }
    }

    useEffect(() => {
        return () => clearInterval(streamInterval.current)
    }, [])

    const handleAnchorSession = async () => {
        if (sessionLogs.length === 0) return
        setIsSaving(true)

        try {
            const patientObj = patients.find(p => p.wallet === selectedPatient)
            const payload = {
                patient: patientObj.name,
                patientWallet: selectedPatient,
                sessionDate: new Date().toLocaleString(),
                type: "IOT_TELEMETRY_SESSION",
                readingCount: sessionLogs.length,
                data: sessionLogs
            }

            const pinataRes = await fetch('/api/pinata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const pinataData = await pinataRes.json()
            if (!pinataData.success) throw new Error("Pinata Upload Failed")

            const recordsContract = getContract('MedicalRecords', signer)
            const tx = await recordsContract.addMedicalRecord(selectedPatient, pinataData.ipfsHash, "IOT_TELEMETRY")

            await tx.wait()

            setCopyStatus('success')
            setTimeout(() => setCopyStatus(null), 4000)

            setSessionLogs([])
            setVitals({ hr: '--', spo2: '--', sys: '--', dia: '--' })

        } catch (error) {
            console.error("Save failed", error)
            setCopyStatus('error')
            setTimeout(() => setCopyStatus(null), 4000)
        }
        setIsSaving(false)
    }

    return (
        <Layout title="IoT Data Logger" subtitle="Live edge-computing vitals batched securely to the blockchain">
            <div className="max-w-[1000px] mx-auto pb-20 page-transition space-y-8 relative">

                {/* HERO SECTION */}
                <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl heading-display mb-3">Edge Telemetry</h1>
                    <p className="text-[14px] text-[#86868b] max-w-lg mx-auto">
                        Monitor live patient vitals and anchor cryptographic batches to Sepolia.
                    </p>
                </div>

                {/* CONTROL PANEL */}
                <div className="apple-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-5 w-full md:w-auto">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${isStreaming ? 'bg-[#00ff41]/20 text-[#00ff41] shadow-[0_0_20px_rgba(0,255,65,0.2)]' : 'bg-black border border-[#424245] text-[#86868b]'}`}>
                            {isStreaming ? <Wifi size={20} className="animate-pulse" /> : <WifiOff size={20} />}
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Target IoT Device</label>
                            <select
                                value={selectedPatient}
                                onChange={(e) => setSelectedPatient(e.target.value)}
                                disabled={isStreaming || isLoadingPatients}
                                className="w-full min-w-[280px] bg-black border border-[#424245] rounded-xl py-3 px-4 text-[14px] text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors appearance-none disabled:opacity-50"
                            >
                                {isLoadingPatients ? (
                                    <option>Syncing network devices...</option>
                                ) : patients.length === 0 ? (
                                    <option>No active nodes found</option>
                                ) : (
                                    patients.map((p, idx) => (
                                        <option key={idx} value={p.wallet}>
                                            {p.name} — {p.wallet.substring(0, 6)}...{p.wallet.substring(p.wallet.length - 4)}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={toggleStream}
                        disabled={isLoadingPatients || patients.length === 0}
                        className={`w-full md:w-auto px-8 py-3.5 rounded-full text-[14px] font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${isStreaming
                                ? 'bg-transparent border border-[#ff3b30] text-[#ff3b30] hover:bg-[#ff3b30]/10 active:scale-95'
                                : 'bg-[#0071e3] hover:bg-[#0066cc] text-white border border-transparent active:scale-95 shadow-[0_4px_20px_rgba(0,113,227,0.3)]'
                            }`}
                    >
                        {isStreaming ? 'Terminate Stream' : 'Initialize IoT Stream'}
                    </button>
                </div>

                {/* LIVE METRICS DASHBOARD */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in-95 duration-700">
                    {/* Heart Rate */}
                    <div className={`apple-card p-8 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-500 ${isStreaming ? 'border-[#ff3b30]/30 shadow-[0_0_30px_rgba(255,59,48,0.05)]' : ''}`}>
                        {isStreaming && <div className="absolute top-0 left-0 w-full h-1 bg-[#ff3b30] animate-pulse"></div>}
                        <HeartPulse size={36} className={`mb-4 transition-colors ${isStreaming ? 'text-[#ff3b30]' : 'text-[#424245]'}`} />
                        <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1">Heart Rate</div>
                        <div className="text-4xl heading-display text-[#f5f5f7] tracking-tight">{vitals.hr} <span className="text-sm font-medium text-[#86868b]">BPM</span></div>
                    </div>

                    {/* SPO2 */}
                    <div className={`apple-card p-8 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-500 ${isStreaming ? 'border-[#0071e3]/30 shadow-[0_0_30px_rgba(0,113,227,0.05)]' : ''}`}>
                        {isStreaming && <div className="absolute top-0 left-0 w-full h-1 bg-[#0071e3] animate-pulse"></div>}
                        <Wind size={36} className={`mb-4 transition-colors ${isStreaming ? 'text-[#0071e3]' : 'text-[#424245]'}`} />
                        <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1">Blood Oxygen</div>
                        <div className="text-4xl heading-display text-[#f5f5f7] tracking-tight">{vitals.spo2} <span className="text-sm font-medium text-[#86868b]">%</span></div>
                    </div>

                    {/* Blood Pressure */}
                    <div className={`apple-card p-8 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-500 ${isStreaming ? 'border-[#bf5af2]/30 shadow-[0_0_30px_rgba(191,90,242,0.05)]' : ''}`}>
                        {isStreaming && <div className="absolute top-0 left-0 w-full h-1 bg-[#bf5af2] animate-pulse"></div>}
                        <Droplets size={36} className={`mb-4 transition-colors ${isStreaming ? 'text-[#bf5af2]' : 'text-[#424245]'}`} />
                        <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1">Blood Pressure</div>
                        <div className="text-4xl heading-display text-[#f5f5f7] tracking-tight">{vitals.sys === '--' ? '--' : `${vitals.sys}/${vitals.dia}`} <span className="text-sm font-medium text-[#86868b]">mmHg</span></div>
                    </div>
                </div>

                {/* SESSION TERMINAL */}
                <div className="apple-card overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-5 border-b border-[#424245] flex justify-between items-center bg-[#1d1d1f]/80">
                        <div className="flex items-center gap-3">
                            <Database size={16} className="text-[#86868b]" />
                            <h3 className="font-bold text-[#86868b] text-[10px] uppercase tracking-widest">Clinical Session Log</h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-mono bg-black border border-[#424245] px-3 py-1.5 rounded-md text-[#f5f5f7]">
                                {sessionLogs.length} READINGS
                            </span>

                            {!isStreaming && sessionLogs.length > 0 && (
                                <button
                                    onClick={handleAnchorSession}
                                    disabled={isSaving}
                                    className="bg-[#0071e3] hover:bg-[#0066cc] text-white px-5 py-2 rounded-full text-[12px] font-bold transition-all active:scale-95 flex items-center gap-2"
                                >
                                    {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} />}
                                    Anchor to Ledger
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-6 h-[280px] overflow-y-auto bg-black font-mono text-[12px] text-[#f5f5f7] shadow-inner">
                        {sessionLogs.length === 0 ? (
                            <div className="flex flex-col h-full items-center justify-center opacity-40">
                                <Activity size={32} className="mb-3" />
                                <p>Awaiting telemetry sequence...</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {sessionLogs.map((log, i) => (
                                    <div key={i} className="flex gap-6 p-1.5 hover:bg-[#1d1d1f] rounded transition-colors">
                                        <span className="text-[#86868b] w-24">[{log.timestamp}]</span>
                                        <span className="text-[#ff3b30] w-20">HR: {log.hr}</span>
                                        <span className="text-[#0071e3] w-24">SPO2: {log.spo2}%</span>
                                        <span className="text-[#bf5af2]">BP: {log.bp}</span>
                                    </div>
                                ))}
                                {/* Dummy element to ensure scrolling reaches the bottom natively */}
                                <div className="h-2"></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* APPLE STYLE FLOATING TOAST */}
                {copyStatus && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1d1d1f]/90 backdrop-blur-md border border-[#424245] text-[#f5f5f7] px-6 py-3.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${copyStatus === 'success' ? 'bg-[#00ff41]/20 text-[#00ff41]' : 'bg-[#ff3b30]/20 text-[#ff3b30]'}`}>
                            {copyStatus === 'success' ? <Database size={14} strokeWidth={2.5} /> : <ShieldAlert size={14} strokeWidth={2.5} />}
                        </div>
                        <div>
                            <p className="text-[13px] font-semibold tracking-wide leading-tight">
                                {copyStatus === 'success' ? 'Telemetry Anchored' : 'Transaction Failed'}
                            </p>
                            <p className="text-[10px] text-[#86868b] leading-tight mt-0.5">
                                {copyStatus === 'success' ? 'Session successfully written to Sepolia.' : 'Check MetaMask and try again.'}
                            </p>
                        </div>
                        <button onClick={() => setCopyStatus(null)} className="ml-2 text-[#86868b] hover:text-white transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                )}

            </div>
        </Layout>
    )
}