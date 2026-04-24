'use client'

import { useState } from 'react'
import { ethers } from 'ethers'
import Layout from '../../components/MainLayout'
import {
    Search, LockOpen, Activity, ShieldAlert, Edit,
    X, Save, FileText, Database, Clock, HeartPulse, ShieldCheck
} from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

export default function DataRetrieval() {
    const { signer, account } = useWeb3()

    const [searchAddress, setSearchAddress] = useState('')
    const [searchRole, setSearchRole] = useState('Doctor')
    const [isSearching, setIsSearching] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const [patientInfo, setPatientInfo] = useState(null)
    const [recordList, setRecordList] = useState([])
    const [selectedRecord, setSelectedRecord] = useState(null)

    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [editForm, setEditForm] = useState({ diagnosis: '', medication: '', notes: '' })

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!signer || !ethers.isAddress(searchAddress)) return setErrorMsg("Invalid wallet address.")

        setIsSearching(true)
        setErrorMsg('')
        setPatientInfo(null)
        setRecordList([])
        setSelectedRecord(null)

        try {
            const identityContract = getContract('PatientIdentity', signer)
            const recordsContract = getContract('MedicalRecords', signer)

            const hasConsent = await identityContract.hasValidConsent(searchAddress, account)
            if (!hasConsent) throw new Error("Access Denied: No valid consent from this patient.")

            const patientIpfsHash = await identityContract.patientMetadata(searchAddress)
            let pName = "Unknown", pAge = "--"
            if (patientIpfsHash) {
                const res = await fetch(`https://gateway.pinata.cloud/ipfs/${patientIpfsHash}`)
                const data = await res.json()
                pName = data.name || "Unknown"; pAge = data.age || "--"
            }
            setPatientInfo({ name: pName, age: pAge, wallet: searchAddress })

            const recordIds = await recordsContract.getRecordsByPatient(searchAddress)
            if (recordIds.length === 0) {
                setErrorMsg("No records found for this patient.")
                setIsSearching(false)
                return
            }

            const loadedRecords = await Promise.all(recordIds.map(async (idBigInt) => {
                const id = Number(idBigInt)
                try {
                    const ipfsHash = await recordsContract.viewMedicalRecord.staticCall(id, searchRole)
                    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`)
                    const payload = await res.json()
                    const recordStruct = await recordsContract.medicalRecords(id)

                    return {
                        id: id,
                        version: Number(recordStruct.version) || 1,
                        recordType: recordStruct.recordType,
                        date: payload.date || payload.sessionDate || new Date().toLocaleString(),
                        diagnosis: payload.diagnosis || "",
                        medication: payload.medication || "",
                        notes: payload.notes || "",
                        iotData: payload.data || [],
                        doctorWallet: recordStruct.uploadedBy,
                        ipfsHash: ipfsHash
                    }
                } catch (e) { return null }
            }))

            const validRecords = loadedRecords.filter(r => r !== null)
            setRecordList(validRecords.reverse())
            if (validRecords.length > 0) setSelectedRecord(validRecords[0])

        } catch (error) {
            setErrorMsg(error.message || "Retrieval failed.")
        }
        setIsSearching(false)
    }

    const openEditModal = () => {
        setEditForm({
            diagnosis: selectedRecord.diagnosis,
            medication: selectedRecord.medication,
            notes: selectedRecord.notes
        })
        setIsEditModalOpen(true)
    }

    const handleUpdateRecord = async () => {
        setIsUpdating(true)
        try {
            const newPayload = {
                patient: patientInfo.name,
                age: patientInfo.age,
                date: new Date().toLocaleString(),
                diagnosis: editForm.diagnosis,
                medication: editForm.medication,
                notes: editForm.notes,
                type: "MEDICAL_RECORD_UPDATE"
            }

            const pinataRes = await fetch('/api/pinata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPayload)
            })
            const pinataData = await pinataRes.json()
            if (!pinataData.success) throw new Error("Pinata Failed")

            const recordsContract = getContract('MedicalRecords', signer)
            const tx = await recordsContract.updateMedicalRecord(selectedRecord.id, pinataData.ipfsHash)
            await tx.wait()

            setIsEditModalOpen(false)
            document.getElementById('searchFormBtn').click()
        } catch (error) {
            alert(error.message)
        }
        setIsUpdating(false)
    }

    return (
        <Layout title="Data Retrieval" subtitle="Secure clinical data decryption and patient history">
            {/* FULL BLEED LIGHT BACKGROUND FOR TRANSACTION MODE */}
            <div className="bg-[#f5f5f7] min-h-screen -m-6 p-6 md:p-10 text-[#1d1d1f] page-transition rounded-tl-3xl border-l border-t border-[#424245]">
                <div className="max-w-6xl mx-auto">

                    {/* SEARCH BAR (Apple Store Configurator Style) */}
                    <div className="bg-white rounded-2xl p-3 mb-8 shadow-sm border border-[#d2d2d7] flex flex-col md:flex-row gap-3 animate-in slide-in-from-top-5 duration-500">
                        <form className="flex w-full gap-3 items-center" onSubmit={handleSearch}>
                            <div className="relative flex-1 flex items-center bg-[#f5f5f7] rounded-xl px-4 py-3 border border-transparent focus-within:border-[#0071e3] transition-colors">
                                <Search size={18} className="text-[#86868b] mr-3" />
                                <input
                                    type="text"
                                    required
                                    value={searchAddress}
                                    onChange={(e) => setSearchAddress(e.target.value.trim())}
                                    placeholder="Enter Patient Wallet Address..."
                                    className="w-full bg-transparent text-[15px] font-medium text-[#1d1d1f] outline-none font-mono"
                                />
                            </div>
                            <select
                                value={searchRole}
                                onChange={(e) => setSearchRole(e.target.value)}
                                className="bg-[#f5f5f7] rounded-xl px-4 py-3 border border-transparent focus:border-[#0071e3] text-sm font-semibold text-[#1d1d1f] outline-none"
                            >
                                <option value="Doctor">Doctor Role</option>
                                <option value="Specialist">Specialist Role</option>
                            </select>
                            <button id="searchFormBtn" type="submit" disabled={isSearching} className="bg-[#0071e3] hover:bg-[#0066cc] text-white px-8 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center gap-2 shadow-md">
                                {isSearching ? <Activity size={18} className="animate-spin" /> : 'Decrypt & Retrieve'}
                            </button>
                        </form>
                    </div>

                    {errorMsg && (
                        <div className="mb-8 p-4 bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-xl text-[#ff3b30] text-sm font-medium flex items-center gap-3 animate-in shake">
                            <ShieldAlert size={20} />
                            {errorMsg}
                        </div>
                    )}

                    {/* MAIN CONTENT AREA */}
                    {patientInfo && recordList.length > 0 && selectedRecord && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">

                            {/* LEFT: PATIENT SUMMARY & RECORD LIST */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className="bg-white border border-[#d2d2d7] rounded-[18px] p-6 shadow-sm">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center font-bold text-xl">
                                            {patientInfo.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg text-[#1d1d1f] leading-tight">{patientInfo.name}</h3>
                                            <p className="text-sm text-[#86868b]">Age: {patientInfo.age}</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-mono text-[#86868b] break-all bg-[#f5f5f7] p-2 rounded-lg">
                                        {patientInfo.wallet}
                                    </div>
                                </div>

                                <div className="bg-white border border-[#d2d2d7] rounded-[18px] overflow-hidden shadow-sm">
                                    <div className="px-5 py-3 border-b border-[#d2d2d7] bg-[#f5f5f7]/50">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">Clinical History</span>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {recordList.map((rec) => (
                                            <button
                                                key={rec.id}
                                                onClick={() => setSelectedRecord(rec)}
                                                className={`w-full p-4 rounded-xl text-left flex justify-between items-center transition-all ${selectedRecord.id === rec.id
                                                        ? 'bg-[#0071e3]/10 border border-[#0071e3]/20 shadow-inner'
                                                        : 'hover:bg-[#f5f5f7] border border-transparent'
                                                    }`}
                                            >
                                                <div>
                                                    <div className={`text-[13px] font-semibold ${selectedRecord.id === rec.id ? 'text-[#0071e3]' : 'text-[#1d1d1f]'}`}>
                                                        #{rec.id} - {rec.recordType.replace('_', ' ')}
                                                    </div>
                                                    <div className="text-[11px] text-[#86868b] mt-1 font-medium">v{rec.version} • {rec.date.split(',')[0]}</div>
                                                </div>
                                                {rec.recordType === "IOT_TELEMETRY" ? <HeartPulse size={16} className={selectedRecord.id === rec.id ? 'text-[#0071e3]' : 'text-[#86868b]'} /> : <FileText size={16} className={selectedRecord.id === rec.id ? 'text-[#0071e3]' : 'text-[#86868b]'} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: DECRYPTED RECORD VIEW */}
                            <div className="lg:col-span-8 bg-white border border-[#d2d2d7] rounded-[24px] shadow-sm flex flex-col overflow-hidden">

                                {/* Header with Matrix Green Success Signal */}
                                <div className="px-8 py-6 border-b border-[#d2d2d7] flex justify-between items-start bg-white">
                                    <div>
                                        <h2 className="text-2xl font-bold text-[#1d1d1f] tracking-tight mb-2">Decrypted Record</h2>
                                        <div className="flex items-center gap-2 text-[#86868b] font-mono text-[10px]">
                                            <Database size={12} /> HASH: {selectedRecord.ipfsHash}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-3">
                                        {/* THE GREEN PROGRESS INDICATOR */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black border border-[#424245] shadow-lg animate-in zoom-in">
                                            <ShieldCheck size={14} className="text-[#00ff41]" />
                                            <span className="text-[9px] font-bold text-[#00ff41] tracking-widest uppercase pulse-success">
                                                Verified & Secured
                                            </span>
                                        </div>

                                        {account && selectedRecord.doctorWallet.toLowerCase() === account.toLowerCase() && selectedRecord.recordType !== "IOT_TELEMETRY" && (
                                            <button onClick={openEditModal} className="text-[#0071e3] hover:text-[#0066cc] text-xs font-semibold flex items-center gap-1 transition-colors">
                                                <Edit size={12} /> Correct Record
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="p-8 flex-1 bg-[#fcfcfc]">
                                    {/* CONDITIONAL RENDERING FOR IOT VS CLINICAL */}
                                    {selectedRecord.recordType === "IOT_TELEMETRY" ? (
                                        <div className="space-y-6 animate-in fade-in">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="p-2.5 rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                                                    <Activity size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="text-base font-semibold text-[#1d1d1f]">IoT Telemetry Batch</h4>
                                                    <p className="text-xs text-[#86868b] font-medium">Continuous Edge-Computing Session</p>
                                                </div>
                                            </div>

                                            <div className="border border-[#d2d2d7] rounded-[12px] overflow-hidden bg-white shadow-sm">
                                                <table className="w-full text-left text-[13px]">
                                                    <thead className="bg-[#f5f5f7] text-[#86868b] text-[10px] uppercase font-bold tracking-wider border-b border-[#d2d2d7]">
                                                        <tr>
                                                            <th className="px-5 py-3"><div className="flex items-center gap-1"><Clock size={12} /> Timestamp</div></th>
                                                            <th className="px-5 py-3">Heart Rate</th>
                                                            <th className="px-5 py-3">Blood Oxygen</th>
                                                            <th className="px-5 py-3">Blood Pressure</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#f5f5f7] font-mono text-[#1d1d1f]">
                                                        {selectedRecord.iotData.map((row, i) => (
                                                            <tr key={i} className="hover:bg-[#f5f5f7]/50 transition-colors">
                                                                <td className="px-5 py-3 text-[#0071e3] font-semibold">{row.timestamp}</td>
                                                                <td className="px-5 py-3">{row.hr} <span className="text-[10px] text-[#86868b]">BPM</span></td>
                                                                <td className="px-5 py-3">{row.spo2} <span className="text-[10px] text-[#86868b]">%</span></td>
                                                                <td className="px-5 py-3">{row.bp}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-8 animate-in fade-in">
                                            <div className="grid grid-cols-2 gap-8">
                                                <div>
                                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Diagnosis</label>
                                                    <div className="p-5 bg-white border border-[#d2d2d7] rounded-[12px] text-[14px] text-[#1d1d1f] shadow-sm leading-relaxed">
                                                        {selectedRecord.diagnosis || "No diagnosis provided."}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Medication (RX)</label>
                                                    <div className="p-5 bg-white border border-[#d2d2d7] rounded-[12px] text-[14px] font-mono text-[#0071e3] shadow-sm leading-relaxed">
                                                        {selectedRecord.medication || "No prescription provided."}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Clinical Notes</label>
                                                <div className="p-5 bg-white border border-[#d2d2d7] rounded-[12px] text-[14px] text-[#1d1d1f] shadow-sm leading-relaxed whitespace-pre-wrap min-h-[120px]">
                                                    {selectedRecord.notes || "No clinical notes found."}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="px-8 py-4 bg-[#f5f5f7] border-t border-[#d2d2d7] text-[10px] font-mono text-[#86868b] flex justify-between items-center">
                                    <div>Provider Signature: <span className="text-[#1d1d1f] font-semibold">{selectedRecord.doctorWallet}</span></div>
                                    <div>Date: {selectedRecord.date}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* EDIT MODAL (High Contrast Override) */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border border-[#d2d2d7] rounded-[24px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-[#d2d2d7] flex justify-between items-center bg-[#f5f5f7]">
                            <h3 className="font-bold text-[#1d1d1f] flex items-center gap-2"><Edit size={18} className="text-[#0071e3]" /> Correct Record #{selectedRecord.id}</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-[#86868b] hover:text-[#1d1d1f] transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 font-medium leading-relaxed">
                                <strong>AUDIT TRAIL NOTICE:</strong> Every update generates a new cryptographically signed version. Previous versions remain permanently visible in the blockchain history to prevent tampering.
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Diagnosis</label>
                                <textarea value={editForm.diagnosis} onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value })} className="w-full bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] rounded-xl p-4 text-[14px] text-[#1d1d1f] outline-none transition-colors" rows="2" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Medication</label>
                                <textarea value={editForm.medication} onChange={(e) => setEditForm({ ...editForm, medication: e.target.value })} className="w-full bg-[#f5f5f7] border border-transparent focus:border-[#0071e3] rounded-xl p-4 text-[14px] font-mono text-[#0071e3] outline-none transition-colors" rows="3" />
                            </div>
                        </div>
                        <div className="p-5 border-t border-[#d2d2d7] flex justify-end gap-3 bg-[#f5f5f7]">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors">Cancel</button>
                            <button onClick={handleUpdateRecord} disabled={isUpdating} className="bg-[#0071e3] hover:bg-[#0066cc] text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 active:scale-95 transition-all shadow-md">
                                {isUpdating ? <Activity size={16} className="animate-spin" /> : <Save size={16} />}
                                Sign & Publish Version
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}