'use client'

import { useState } from 'react'
import Layout from '../../components/MainLayout'
import { ShieldCheck, ShieldAlert, Search, Package, Calendar, Factory } from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

export default function DrugVerify() {
    const { signer } = useWeb3()
    const [batchId, setBatchId] = useState('')
    const [drugData, setDrugData] = useState(null)
    const [isSearching, setIsSearching] = useState(false)
    const [error, setError] = useState(null)

    const handleVerify = async (e) => {
        e.preventDefault()
        setIsSearching(true)
        setError(null)
        setDrugData(null)

        try {
            const drugContract = getContract('DrugAuthenticity', signer)
            // Assuming your contract has a mapping: drugs(uint256 batchId)
            const result = await drugContract.getDrugDetails(batchId)

            if (!result.exists) {
                setError("This Batch ID is not found in the Global Ledger. Possible Counterfeit.")
            } else {
                setDrugData({
                    name: result.name,
                    manufacturer: result.manufacturer,
                    expiry: new Date(Number(result.expiryDate) * 1000).toLocaleDateString(),
                    isExpired: Number(result.expiryDate) < Math.floor(Date.now() / 1000),
                    status: result.status // e.g., "Manufactured" or "In Transit"
                })
            }
        } catch (err) {
            setError("Drug not registered or network error.")
        }
        setIsSearching(false)
    }

    return (
        <Layout title="Drug Authenticity" subtitle="Verify pharmaceutical integrity via blockchain supply chain">
            <div className="max-w-3xl mx-auto">
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
                    <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Package size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-[var(--text)] mb-2">Secure Drug Scanner</h2>
                    <p className="text-sm text-[var(--secondary)] mb-8">Enter the 12-digit Batch ID found on the drug packaging.</p>

                    <form onSubmit={handleVerify} className="flex gap-2 max-w-md mx-auto">
                        <input
                            type="text"
                            value={batchId}
                            onChange={(e) => setBatchId(e.target.value)}
                            placeholder="Batch ID (e.g. 1001)"
                            className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] outline-none focus:border-blue-500 font-mono"
                        />
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2">
                            {isSearching ? '...' : <Search size={18} />} Verify
                        </button>
                    </form>
                </div>

                {error && (
                    <div className="mt-6 p-6 bg-red-500/10 border border-red-500/30 rounded-xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                        <ShieldAlert size={48} className="text-red-500 mb-3" />
                        <h3 className="text-red-500 font-bold uppercase tracking-widest text-sm">Authentication Failed</h3>
                        <p className="text-[var(--text)] text-sm mt-2">{error}</p>
                    </div>
                )}

                {drugData && (
                    <div className={`mt-6 p-8 border rounded-xl animate-in slide-in-from-bottom-5 duration-500 ${drugData.isExpired ? 'bg-amber-500/5 border-amber-500/30' : 'bg-green-500/5 border-green-500/30'}`}>
                        <div className="flex flex-col items-center text-center">
                            {drugData.isExpired ? (
                                <ShieldAlert size={48} className="text-amber-500 mb-3" />
                            ) : (
                                <ShieldCheck size={48} className="text-green-500 mb-3" />
                            )}
                            <h3 className={`font-bold uppercase tracking-widest text-sm ${drugData.isExpired ? 'text-amber-500' : 'text-green-500'}`}>
                                {drugData.isExpired ? 'DRUG EXPIRED' : 'AUTHENTIC PRODUCT'}
                            </h3>

                            <div className="grid grid-cols-2 gap-8 w-full mt-8 border-t border-[var(--border)] pt-8">
                                <div className="text-left">
                                    <div className="text-[10px] text-[var(--secondary)] uppercase font-bold mb-1">Product Name</div>
                                    <div className="text-[var(--text)] font-medium">{drugData.name}</div>
                                </div>
                                <div className="text-left">
                                    <div className="text-[10px] text-[var(--secondary)] uppercase font-bold mb-1">Expiry Date</div>
                                    <div className={`text-[var(--text)] font-medium ${drugData.isExpired ? 'text-red-400' : ''}`}>{drugData.expiry}</div>
                                </div>
                                <div className="text-left">
                                    <div className="text-[10px] text-[var(--secondary)] uppercase font-bold mb-1">Manufacturer</div>
                                    <div className="text-[var(--text)] font-medium flex items-center gap-1"><Factory size={12} /> {drugData.manufacturer.substring(0, 10)}...</div>
                                </div>
                                <div className="text-left">
                                    <div className="text-[10px] text-[var(--secondary)] uppercase font-bold mb-1">Current Status</div>
                                    <div className="text-green-400 font-bold text-xs">{drugData.status}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}