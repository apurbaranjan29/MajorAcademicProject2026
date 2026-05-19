'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import Layout from '../../components/MainLayout'
import {
    Activity, FileText, CheckCircle, XCircle,
    Coins, ShieldCheck, ShieldAlert, Database, X, ChevronRight, Globe, Wifi, WifiOff
} from 'lucide-react'
import { useWeb3 } from '../../context/Web3Context'
import { getContract } from '../../lib/contracts'

// Fallback rates in case the live API fails during the panel presentation
const FALLBACK_CURRENCIES = [
    { code: 'USD', symbol: '$', rate: 3000, name: 'US Dollar' },
    { code: 'INR', symbol: '₹', rate: 250000, name: 'Indian Rupee' },
    { code: 'EUR', symbol: '€', rate: 2750, name: 'Euro' },
    { code: 'GBP', symbol: '£', rate: 2350, name: 'British Pound' },
    { code: 'JPY', symbol: '¥', rate: 450000, name: 'Japanese Yen' },
    { code: 'CAD', symbol: 'CA$', rate: 4050, name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'AU$', rate: 4500, name: 'Australian Dollar' },
    { code: 'CHF', symbol: '₣', rate: 2700, name: 'Swiss Franc' },
    { code: 'CNY', symbol: '¥', rate: 21600, name: 'Chinese Yuan' },
    { code: 'HKD', symbol: 'HK$', rate: 23400, name: 'Hong Kong Dollar' },
    { code: 'NZD', symbol: 'NZ$', rate: 4900, name: 'New Zealand Dollar' },
    { code: 'KRW', symbol: '₩', rate: 4000000, name: 'South Korean Won' },
    { code: 'SGD', symbol: 'S$', rate: 4000, name: 'Singapore Dollar' },
    { code: 'MXN', symbol: 'Mex$', rate: 50000, name: 'Mexican Peso' },
    { code: 'BRL', symbol: 'R$', rate: 15000, name: 'Brazilian Real' },
    { code: 'ZAR', symbol: 'R', rate: 56000, name: 'South African Rand' },
    { code: 'RUB', symbol: '₽', rate: 270000, name: 'Russian Ruble' },
    { code: 'SEK', symbol: 'kr', rate: 31000, name: 'Swedish Krona' },
    { code: 'TRY', symbol: '₺', rate: 96000, name: 'Turkish Lira' },
    { code: 'AED', symbol: 'د.إ', rate: 11000, name: 'UAE Dirham' }
];

export default function InsuranceClaims() {
    const { signer, account } = useWeb3()

    const [patients, setPatients] = useState([])
    const [selectedPatient, setSelectedPatient] = useState('')

    const [fiatAmount, setFiatAmount] = useState('')

    // Dynamic Currency State
    const [currencies, setCurrencies] = useState(FALLBACK_CURRENCIES)
    const [selectedCurrency, setSelectedCurrency] = useState(FALLBACK_CURRENCIES[0])
    const [isLiveRates, setIsLiveRates] = useState(false) // Tracks if API succeeded

    const [diagnosisHash, setDiagnosisHash] = useState('QmDemoHashPlaceholder1234567890')
    const [claims, setClaims] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [actionStatus, setActionStatus] = useState(null)
    const [isProcessing, setIsProcessing] = useState(false)

    // Calculate ETH equivalent based on the currently selected currency's live rate
    const ethAmount = fiatAmount ? (Number(fiatAmount) / selectedCurrency.rate).toFixed(6) : '0.00';

    //REAL-TIME EXCHANGE RATE FETCHER
    useEffect(() => {
        const fetchLiveRates = async () => {
            try {
                // Fetch real-time ETH prices against all our target fiat currencies via CoinGecko
                const vs_currencies = FALLBACK_CURRENCIES.map(c => c.code.toLowerCase()).join(',');
                const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=${vs_currencies}`);

                if (!response.ok) throw new Error("API Limit Reached");

                const data = await response.json();
                const liveEthRates = data.ethereum;

                if (liveEthRates) {
                    const updatedCurrencies = FALLBACK_CURRENCIES.map(curr => ({
                        ...curr,
                        rate: liveEthRates[curr.code.toLowerCase()] || curr.rate // update with live, or keep fallback
                    }));

                    setCurrencies(updatedCurrencies);
                    setSelectedCurrency(updatedCurrencies.find(c => c.code === selectedCurrency.code) || updatedCurrencies[0]);
                    setIsLiveRates(true);
                }
            } catch (error) {
                console.warn("Using offline fallback rates. CoinGecko API failed or rate-limited:", error);
                setIsLiveRates(false);
            }
        };

        fetchLiveRates();

        //Refresh rates every 60 seconds
        const interval = setInterval(fetchLiveRates, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (signer) {
            loadPatients()
            loadClaims()
        }
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
    }

    const loadClaims = async () => {
        setIsLoading(true)
        try {
            const insuranceContract = getContract('InsuranceClaims', signer)
            const count = await insuranceContract.claimCount()

            let loadedClaims = []
            for (let i = 1; i <= Number(count); i++) {
                const claim = await insuranceContract.getClaim(i)
                const weiVal = claim.amount.toString()
                const ethVal = ethers.formatEther(weiVal)

                loadedClaims.push({
                    id: Number(claim.claimId),
                    patient: claim.patient,
                    hospital: claim.hospital,
                    amountEth: ethVal,
                    status: Number(claim.status),
                    diagnosisHash: claim.diagnosisHash,
                    submittedAt: new Date(Number(claim.submittedAt) * 1000).toLocaleString()
                })
            }
            setClaims(loadedClaims.reverse())
        } catch (error) {
            console.error("Failed to load claims:", error)
        }
        setIsLoading(false)
    }

    const showToast = (type, message) => {
        setActionStatus({ type, message })
        setTimeout(() => setActionStatus(null), 4000)
    }
    const submitClaim = async (e) => {
        e.preventDefault()
        if (!selectedPatient || !fiatAmount || !diagnosisHash) return
        setIsProcessing(true)

        try {
            const insuranceContract = getContract('InsuranceClaims', signer)
            const weiAmountToSubmit = ethers.parseEther(ethAmount.toString())

            const tx = await insuranceContract.submitClaim(selectedPatient, weiAmountToSubmit, diagnosisHash)
            showToast('info', 'Broadcasting transaction to Sepolia...')
            await tx.wait()

            showToast('success', 'Claim submitted successfully!')
            setFiatAmount('')
            loadClaims()
        } catch (error) {
            console.error(error)
            showToast('error', 'Submission failed. Check consent or cooldown.')
        }
        setIsProcessing(false)
    }

    const handleAction = async (actionType, claimId) => {
        setIsProcessing(true)
        try {
            const insuranceContract = getContract('InsuranceClaims', signer)
            let tx;

            if (actionType === 'Approve') {
                tx = await insuranceContract.approveClaim(claimId)
            } else if (actionType === 'Reject') {
                tx = await insuranceContract.rejectClaim(claimId, "Discrepancy in diagnosis records")
            } else if (actionType === 'Pay') {
                tx = await insuranceContract.payClaim(claimId)
            }

            showToast('info', `${actionType} transaction broadcasting...`)
            await tx.wait()

            showToast('success', `Claim #${claimId} successfully ${actionType}ed!`)
            loadClaims()
        } catch (error) {
            console.error(error)
            showToast('error', `${actionType} failed. Ensure you have the Insurer Role.`)
        }
        setIsProcessing(false)
    }

    const getStatusBadge = (statusCode) => {
        switch (statusCode) {
            case 0: return <span className="bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">Submitted</span>
            case 1: return <span className="bg-[#00ff41]/20 text-[#00ff41] border border-[#00ff41]/30 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">Approved</span>
            case 2: return <span className="bg-[#ff3b30]/20 text-[#ff3b30] border border-[#ff3b30]/30 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">Rejected</span>
            case 3: return <span className="bg-[#0071e3]/20 text-[#0071e3] border border-[#0071e3]/30 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">Paid</span>
            default: return <span>Unknown</span>
        }
    }

    return (
        <Layout title="Claims Automation" subtitle="Submit, verify, and settle insurance claims via smart contracts">
            <div className="max-w-[1000px] mx-auto pb-20 page-transition space-y-8 relative">

                <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl heading-display mb-3">Claims Adjudication</h1>
                    <p className="text-[14px] text-[#86868b] max-w-lg mx-auto">
                        A decentralized clearinghouse for medical claims. Features automated fraud cooldowns, real-time global currency matching, and direct ETH settlement.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    <div className="lg:col-span-1 space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                        <div className="apple-card p-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0071e3] to-[#bf5af2]"></div>
                            <div className="flex items-center gap-3 mb-6">
                                <FileText size={20} className="text-[#0071e3]" />
                                <h3 className="font-bold text-[#f5f5f7] tracking-wide">Submit New Claim</h3>
                            </div>

                            <form onSubmit={submitClaim} className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Patient</label>
                                    <select
                                        value={selectedPatient}
                                        onChange={(e) => setSelectedPatient(e.target.value)}
                                        className="w-full bg-black border border-[#424245] rounded-xl py-3 px-4 text-[13px] text-[#f5f5f7] outline-none focus:border-[#0071e3] transition-colors appearance-none"
                                    >
                                        {patients.map((p, idx) => (
                                            <option key={idx} value={p.wallet}>
                                                {p.name} ({p.wallet.substring(0, 4)}...{p.wallet.substring(p.wallet.length - 4)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block">Claim Amount</label>
                                        <div className={`flex items-center gap-1 text-[9px] uppercase tracking-widest font-bold ${isLiveRates ? 'text-[#00ff41]' : 'text-[#f59e0b]'}`}>
                                            {isLiveRates ? <><Wifi size={10} /> Live FX</> : <><WifiOff size={10} /> Offline FX</>}
                                        </div>
                                    </div>

                                    <div className="flex bg-black border border-[#424245] rounded-xl overflow-hidden focus-within:border-[#0071e3] transition-colors">
                                        <select
                                            value={selectedCurrency.code}
                                            onChange={(e) => setSelectedCurrency(currencies.find(c => c.code === e.target.value))}
                                            className="bg-[#1d1d1f] border-r border-[#424245] py-3 pl-3 pr-2 text-[13px] font-bold text-[#f5f5f7] outline-none appearance-none cursor-pointer"
                                        >
                                            {currencies.map((curr) => (
                                                <option key={curr.code} value={curr.code}>
                                                    {curr.code}
                                                </option>
                                            ))}
                                        </select>

                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] font-mono text-[14px]">
                                                {selectedCurrency.symbol}
                                            </span>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={fiatAmount}
                                                onChange={(e) => setFiatAmount(e.target.value)}
                                                className="w-full bg-transparent py-3 pl-8 pr-4 text-[13px] text-[#f5f5f7] outline-none font-mono"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-2 px-1">
                                        <p className="text-[10px] text-[#86868b] font-mono">
                                            1 ETH = {selectedCurrency.symbol}{selectedCurrency.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                        {fiatAmount && (
                                            <p className="text-[11px] text-[#00ff41] font-mono font-bold">
                                                ≈ {ethAmount} ETH
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest block mb-2">Diagnosis Hash (IPFS)</label>
                                    <input
                                        type="text"
                                        value={diagnosisHash}
                                        onChange={(e) => setDiagnosisHash(e.target.value)}
                                        className="w-full bg-black border border-[#424245] rounded-xl py-3 px-4 text-[13px] text-[#86868b] outline-none focus:border-[#0071e3] transition-colors font-mono"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="w-full mt-2 bg-[#0071e3] hover:bg-[#0066cc] text-white py-3.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-[0_4px_20px_rgba(0,113,227,0.3)]"
                                >
                                    {isProcessing ? <Activity size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                                    Broadcast Claim
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="lg:col-span-2 animate-in slide-in-from-bottom-10 duration-700 delay-100">
                        <div className="apple-card overflow-hidden flex flex-col shadow-2xl h-full min-h-[500px]">
                            <div className="p-5 border-b border-[#424245] flex justify-between items-center bg-[#1d1d1f]/80">
                                <div className="flex items-center gap-3">
                                    <Database size={16} className="text-[#86868b]" />
                                    <h3 className="font-bold text-[#86868b] text-[10px] uppercase tracking-widest">Global Claims Ledger</h3>
                                </div>
                                <span className="text-[10px] font-mono bg-black border border-[#424245] px-3 py-1.5 rounded-md text-[#f5f5f7]">
                                    {claims.length} ACTIVE
                                </span>
                            </div>

                            <div className="p-6 overflow-y-auto bg-black flex-1">
                                {isLoading ? (
                                    <div className="flex flex-col h-full items-center justify-center opacity-40 py-20">
                                        <Activity size={32} className="mb-3 animate-spin" />
                                        <p className="text-[12px]">Syncing ledger state...</p>
                                    </div>
                                ) : claims.length === 0 ? (
                                    <div className="flex flex-col h-full items-center justify-center opacity-40 py-20">
                                        <ShieldCheck size={32} className="mb-3" />
                                        <p className="text-[12px]">No claims on the network.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {claims.map((claim) => {
                                            // Dynamically calculate local fiat value based on currently selected LIVE currency
                                            const localFiatValue = (Number(claim.amountEth) * selectedCurrency.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                                            return (
                                                <div key={claim.id} className="border border-[#424245] rounded-xl p-5 bg-[#1d1d1f] hover:border-[#86868b] transition-colors">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <span className="text-[#f5f5f7] font-bold text-lg">Claim #{claim.id}</span>
                                                                {getStatusBadge(claim.status)}
                                                            </div>
                                                            <p className="text-[11px] text-[#86868b] font-mono">Patient: {claim.patient}</p>
                                                        </div>

                                                        <div className="text-right">
                                                            <span className="block text-[#00ff41] font-mono font-bold text-lg">
                                                                {selectedCurrency.symbol}{localFiatValue}
                                                            </span>
                                                            <span className="text-[10px] text-[#86868b] font-mono">{Number(claim.amountEth).toFixed(4)} ETH</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-center gap-2 mb-5 p-3 bg-black rounded-lg border border-[#424245]">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <FileText size={14} className="text-[#86868b] shrink-0" />
                                                            <span className="text-[11px] font-mono text-[#86868b] truncate">Doc: {claim.diagnosisHash}</span>
                                                        </div>
                                                        <span className="text-[9px] text-[#86868b] shrink-0">{claim.submittedAt}</span>
                                                    </div>

                                                    <div className="flex justify-end gap-3 pt-4 border-t border-[#424245]/50">
                                                        {claim.status === 0 && (
                                                            <>
                                                                <button onClick={() => handleAction('Reject', claim.id)} disabled={isProcessing} className="px-4 py-2 rounded-lg text-[11px] font-bold border border-[#ff3b30] text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors flex items-center gap-1">
                                                                    <XCircle size={14} /> Reject
                                                                </button>
                                                                <button onClick={() => handleAction('Approve', claim.id)} disabled={isProcessing} className="px-4 py-2 rounded-lg text-[11px] font-bold bg-[#00ff41]/20 text-[#00ff41] hover:bg-[#00ff41]/30 transition-colors flex items-center gap-1">
                                                                    <CheckCircle size={14} /> Approve
                                                                </button>
                                                            </>
                                                        )}
                                                        {claim.status === 1 && (
                                                            <button onClick={() => handleAction('Pay', claim.id)} disabled={isProcessing} className="px-6 py-2 rounded-lg text-[11px] font-bold bg-[#0071e3] text-white hover:bg-[#0066cc] transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(0,113,227,0.3)]">
                                                                <Coins size={14} /> Execute Payout
                                                            </button>
                                                        )}
                                                        {claim.status > 1 && (
                                                            <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-widest flex items-center gap-1">
                                                                <ShieldCheck size={14} /> Settlement Closed
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {actionStatus && (
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1d1d1f]/90 backdrop-blur-md border border-[#424245] text-[#f5f5f7] px-6 py-3.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center 
                            ${actionStatus.type === 'success' ? 'bg-[#00ff41]/20 text-[#00ff41]' :
                                actionStatus.type === 'error' ? 'bg-[#ff3b30]/20 text-[#ff3b30]' :
                                    'bg-[#0071e3]/20 text-[#0071e3]'}`}>
                            {actionStatus.type === 'success' ? <CheckCircle size={14} /> :
                                actionStatus.type === 'error' ? <ShieldAlert size={14} /> :
                                    <Activity size={14} className="animate-spin" />}
                        </div>
                        <div>
                            <p className="text-[13px] font-semibold tracking-wide leading-tight">
                                {actionStatus.type === 'success' ? 'Success' : actionStatus.type === 'error' ? 'Transaction Failed' : 'Processing...'}
                            </p>
                            <p className="text-[10px] text-[#86868b] leading-tight mt-0.5">
                                {actionStatus.message}
                            </p>
                        </div>
                        <button onClick={() => setActionStatus(null)} className="ml-2 text-[#86868b] hover:text-white transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                )}

            </div>
        </Layout>
    )
}