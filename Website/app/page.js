'use client'

import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Layout from '../components/MainLayout'
import { Users, FileText, ShieldCheck, Activity, RefreshCw, ExternalLink } from 'lucide-react'
import { useWeb3 } from '../context/Web3Context'
import { getContract, getReadProvider, CONTRACT_ADDRESSES } from '../lib/contracts'

const LOOKBACK_BLOCKS = 20000
const NETWORK_NAME = 'Sepolia Testnet'

function normalizeAddress(value) {
    if (typeof value !== 'string') return ''
    const trimmed = value.trim()
    if (!trimmed.startsWith('0x') || trimmed.length !== 42) return ''
    if (trimmed.toLowerCase().includes('yourdeployed')) return ''
    return trimmed
}

function shortHash(value) {
    if (!value) return '--'
    if (value.length <= 12) return value
    return `${value.slice(0, 10)}...`
}

function formatRelativeTime(timestampMs) {
    const secsAgo = Math.floor((Date.now() - timestampMs) / 1000)
    if (secsAgo < 60) return `${secsAgo} secs ago`
    const minsAgo = Math.floor(secsAgo / 60)
    if (minsAgo < 60) return `${minsAgo} min${minsAgo !== 1 ? 's' : ''} ago`
    const hrsAgo = Math.floor(minsAgo / 60)
    if (hrsAgo < 24) return `${hrsAgo} hr${hrsAgo !== 1 ? 's' : ''} ago`
    const daysAgo = Math.floor(hrsAgo / 24)
    return `${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`
}

function getEventCategory(contractKey, eventName = '') {
    const name = eventName.toLowerCase()
    if (contractKey === 'PatientIdentity') {
        if (name.includes('register') || name.includes('metadata')) return 'registration'
        if (name.includes('consent')) return 'consent'
    }
    if (contractKey === 'MedicalRecords') {
        if (
            name.includes('record') ||
            name.includes('prescription') ||
            name.includes('add') ||
            name.includes('store')
        ) {
            return 'record'
        }
    }
    return 'other'
}

function buildTrackedContracts() {
    const patientIdentityAddress =
        normalizeAddress(CONTRACT_ADDRESSES.PatientIdentity) ||
        normalizeAddress(CONTRACT_ADDRESSES.PatientIdentityAndConsent) ||
        normalizeAddress(CONTRACT_ADDRESSES.Identity) ||
        ''

    const medicalRecordsAddress =
        normalizeAddress(CONTRACT_ADDRESSES.MedicalRecords) ||
        normalizeAddress(CONTRACT_ADDRESSES.MedicalRecordsAndAccess) ||
        normalizeAddress(CONTRACT_ADDRESSES.Records) ||
        ''

    return [
        {
            key: 'PatientIdentity',
            label: 'PatientIdentityAndConsent',
            address: patientIdentityAddress,
        },
        {
            key: 'MedicalRecords',
            label: 'MedicalRecordsAndAccess',
            address: medicalRecordsAddress,
        },
    ].filter(item => item.address)
}

async function readContractEvents(contract, contractKey, contractLabel, fromBlock, toBlock) {
    const collected = []
    const eventFragments = contract.interface.fragments.filter(f => f.type === 'event')

    for (const fragment of eventFragments) {
        try {
            const logs = await contract.queryFilter(fragment.name, fromBlock, toBlock)
            for (const log of logs) {
                collected.push({
                    id: `${log.transactionHash}-${log.index ?? 0}-${fragment.name}`,
                    event: fragment.name,
                    contract: contractLabel,
                    contractKey,
                    tx: log.transactionHash,
                    block: log.blockNumber,
                    logIndex: Number(log.index ?? 0),
                    category: getEventCategory(contractKey, fragment.name),
                    status: 'CONFIRMED',
                })
            }
        } catch (err) {
            console.warn(`[${contractLabel}] failed on ${fragment.name}:`, err.message)
        }
    }
    return collected
}

export default function DashboardPage() {
    const { provider } = useWeb3()

    const [liveStats, setLiveStats] = useState({ block: '--', gas: '--', chainId: '--' })
    const [isRefreshing, setIsRefreshing] = useState(false)

    const [recentTxs, setRecentTxs] = useState([])
    const [isLoadingTxs, setIsLoadingTxs] = useState(true)

    const fetchLiveStats = async () => {
        if (!provider) return
        setIsRefreshing(true)
        try {
            const currentBlock = await provider.getBlockNumber()
            const feeData = await provider.getFeeData()
            const gasInGwei = ethers.formatUnits(
                feeData.gasPrice || feeData.maxFeePerGas || 0n,
                'gwei'
            )
            const networkDetails = await provider.getNetwork()

            setLiveStats({
                block: currentBlock.toLocaleString(),
                gas: parseFloat(gasInGwei).toFixed(2),
                chainId: networkDetails.chainId.toString(),
            })
        } catch (error) {
            console.error('Failed to fetch network stats:', error)
        } finally {
            setTimeout(() => setIsRefreshing(false), 400)
        }
    }

    const fetchRealTransactions = async () => {
        try {
            setIsLoadingTxs(true)
            const readProvider = getReadProvider()

            const trackedContracts = buildTrackedContracts()
            if (trackedContracts.length === 0) {
                setRecentTxs([])
                return
            }

            const currentBlock = await provider.getBlockNumber()
            const fromBlock = Math.max(0, currentBlock - LOOKBACK_BLOCKS)

            const rawEntriesNested = await Promise.all(
                trackedContracts.map(async (contractInfo) => {
                    const contract = getContract(contractInfo.key, provider)
                    if (!contract) return []
                    return readContractEvents(
                        contract,
                        contractInfo.key,
                        contractInfo.label,
                        fromBlock,
                        currentBlock
                    )
                })
            )

            const rawEntries = rawEntriesNested.flat()
            if (rawEntries.length === 0) {
                setRecentTxs([])
                return
            }

            const uniqueBlocks = [...new Set(rawEntries.map(entry => entry.block))]
            const blockTimestampPairs = await Promise.all(
                uniqueBlocks.map(async (blockNumber) => {
                    try {
                        const block = await readProvider.getBlock(blockNumber)
                        return [blockNumber, block?.timestamp ? block.timestamp * 1000 : null]
                    } catch {
                        return [blockNumber, null]
                    }
                })
            )

            const blockTimestampMap = new Map(blockTimestampPairs)

            const formattedTxs = rawEntries
                .map((entry) => {
                    const timestampMs = blockTimestampMap.get(entry.block)
                    return {
                        ...entry,
                        time: timestampMs ? formatRelativeTime(timestampMs) : 'On-chain',
                    }
                })
                .sort((a, b) => {
                    const blockDiff = Number(b.block) - Number(a.block)
                    if (blockDiff !== 0) return blockDiff
                    return Number(b.logIndex) - Number(a.logIndex)
                })

            setRecentTxs(formattedTxs.slice(0, 10))
        } catch (error) {
            console.error('Failed to fetch transactions:', error)
            setRecentTxs([])
        } finally {
            setIsLoadingTxs(false)
        }
    }

    useEffect(() => {
        fetchLiveStats()
        fetchRealTransactions()

        if (!provider) return

        const onBlock = (newBlockNumber) => {
            setLiveStats(prev => ({ ...prev, block: newBlockNumber.toLocaleString() }))
        }

        provider.on('block', onBlock)

        return () => {
            provider.removeListener?.('block', onBlock)
            provider.removeAllListeners?.('block')
        }
    }, [provider])

    const registrations = recentTxs.filter(tx => tx.category === 'registration').length
    const recordsAnchored = recentTxs.filter(tx => tx.category === 'record').length
    const consentsHandled = recentTxs.filter(tx => tx.category === 'consent').length
    const totalCalls = recentTxs.length

    const firstTrackedAddress = buildTrackedContracts()[0]?.address || ''

    return (
        <Layout title="Network Dashboard" subtitle="Live protocol and transaction analytics">
            <div className="dashboard-bg max-w-[1200px] mx-auto pb-20 page-transition space-y-10">

                {/* --- TOPOGRAPHIC TELEMETRY CLUSTER --- */}
                <div className="relative rounded-[24px] overflow-hidden border border-[#424245] shadow-2xl animate-in slide-in-from-bottom-6 duration-700 bg-[#0a0a0c]">

                    {/* The Background Image Layer */}
                    <div
                        className="absolute inset-0 z-0 opacity-25 pointer-events-none mix-blend-screen"
                        style={{
                            backgroundImage: 'url(/website_back.jpeg)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundAttachment: 'fixed'

                        }}
                    />
                    {/* Subtle Gradient to ensure text pops */}
                    <div className="absolute inset-0 z-0 bg-gradient-to-br from-black/80 via-black/40 to-transparent pointer-events-none" />

                    <div className="relative z-10 p-6 md:p-8 space-y-6">

                        {/* Status Bar */}
                        <div className="bg-[#1d1d1f]/60 backdrop-blur-xl border border-[#424245] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
                            <div className="flex flex-wrap items-center gap-6 font-mono text-[12px]">
                                <span className="text-[#86868b]">
                                    Network <span className="text-[#f5f5f7] ml-1">{NETWORK_NAME}</span>
                                </span>
                                <span className="text-[#86868b]">
                                    Chain ID <span className="text-[#f5f5f7] ml-1">{liveStats.chainId}</span>
                                </span>
                                <span className="text-[#86868b] flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${provider ? 'bg-[#00ff41] pulse-success' : 'bg-[#ff3b30]'}`} />
                                    Block <span className="text-[#f5f5f7]">#{liveStats.block}</span>
                                </span>
                                <span className="text-[#86868b]">
                                    Gas <span className="text-[#f5f5f7] ml-1">{liveStats.gas} gwei</span>
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-[11px] text-[#86868b] hidden sm:block font-medium tracking-wide">
                                    {provider ? 'Synced just now' : 'Connect Wallet to Sync'}
                                </span>
                                <button
                                    onClick={() => {
                                        fetchLiveStats()
                                        fetchRealTransactions()
                                    }}
                                    disabled={!provider || isRefreshing}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#f5f5f7] rounded-lg text-[12px] font-semibold transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#0071e3]' : ''} />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {/* The 4 Analytics Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Card 1 */}
                            <div className="bg-[#1d1d1f]/60 backdrop-blur-xl border border-[#424245] rounded-[18px] p-6 flex flex-col justify-between hover:border-[#0071e3]/50 transition-colors shadow-lg">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">Registrations</h3>
                                    <Users size={16} className="text-[#0071e3]" />
                                </div>
                                <div>
                                    <div className="text-5xl heading-display text-[#f5f5f7] tracking-tight">
                                        {isLoadingTxs ? '--' : registrations}
                                    </div>
                                    <p className="text-[11px] text-[#00ff41] font-semibold mt-2">Live from Chain</p>
                                </div>
                                <p className="text-[9px] font-mono text-[#86868b] border-t border-[#424245]/50 pt-4 mt-6 truncate">Via PatientIdentityAndConsent.sol</p>
                            </div>

                            {/* Card 2 */}
                            <div className="bg-[#1d1d1f]/60 backdrop-blur-xl border border-[#424245] rounded-[18px] p-6 flex flex-col justify-between hover:border-[#0071e3]/50 transition-colors shadow-lg">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">Records Anchored</h3>
                                    <FileText size={16} className="text-[#0071e3]" />
                                </div>
                                <div>
                                    <div className="text-5xl heading-display text-[#f5f5f7] tracking-tight">
                                        {isLoadingTxs ? '--' : recordsAnchored}
                                    </div>
                                    <p className="text-[11px] text-[#00ff41] font-semibold mt-2">Live from Chain</p>
                                </div>
                                <p className="text-[9px] font-mono text-[#86868b] border-t border-[#424245]/50 pt-4 mt-6 truncate">Via MedicalRecordsAndAccess.sol</p>
                            </div>

                            {/* Card 3 */}
                            <div className="bg-[#1d1d1f]/60 backdrop-blur-xl border border-[#424245] rounded-[18px] p-6 flex flex-col justify-between hover:border-[#0071e3]/50 transition-colors shadow-lg">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">Consents Handled</h3>
                                    <ShieldCheck size={16} className="text-[#0071e3]" />
                                </div>
                                <div>
                                    <div className="text-5xl heading-display text-[#f5f5f7] tracking-tight">
                                        {isLoadingTxs ? '--' : consentsHandled}
                                    </div>
                                    <p className="text-[11px] text-[#f5f5f7] font-semibold mt-2">Cryptographically verified</p>
                                </div>
                                <p className="text-[9px] font-mono text-[#86868b] border-t border-[#424245]/50 pt-4 mt-6 truncate">Via PatientIdentityAndConsent.sol</p>
                            </div>

                            {/* Card 4 */}
                            <div className="bg-[#1d1d1f]/60 backdrop-blur-xl border border-[#424245] rounded-[18px] p-6 flex flex-col justify-between hover:border-[#0071e3]/50 transition-colors shadow-lg">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">Total Contract Calls</h3>
                                    <Activity size={16} className="text-[#0071e3]" />
                                </div>
                                <div>
                                    <div className="text-5xl heading-display text-[#f5f5f7] tracking-tight">
                                        {isLoadingTxs ? '--' : totalCalls}
                                    </div>
                                    <p className="text-[11px] text-[#0071e3] font-semibold mt-2">Verified on Sepolia</p>
                                </div>
                                <p className="text-[9px] font-mono text-[#86868b] border-t border-[#424245]/50 pt-4 mt-6 truncate">Direct RPC event scan</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- REAL-TIME TRANSACTIONS TABLE --- */}
                <div className="apple-card overflow-hidden animate-in slide-in-from-bottom-8 duration-700 delay-100">
                    <div className="px-6 py-5 border-b border-[#424245] flex items-center justify-between bg-[#1d1d1f]/80">
                        <h2 className="font-bold text-[#f5f5f7] text-[14px] tracking-tight">Real-Time Transactions</h2>
                        <a
                            href={firstTrackedAddress ? `https://sepolia.etherscan.io/address/${firstTrackedAddress}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold uppercase tracking-widest text-[#0071e3] hover:text-white flex items-center gap-1.5 transition-colors"
                        >
                            View on Etherscan <ExternalLink size={12} />
                        </a>
                    </div>

                    <div className="overflow-x-auto min-h-[300px] bg-black">
                        {isLoadingTxs ? (
                            <div className="flex flex-col items-center justify-center h-[300px] text-[#86868b]">
                                <Activity className="animate-spin mb-3 text-[#0071e3]" size={24} />
                                <span className="text-[11px] font-bold uppercase tracking-widest">Fetching from Sepolia...</span>
                            </div>
                        ) : recentTxs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[300px] text-[#86868b]">
                                <p className="text-[13px] font-medium text-[#f5f5f7] mb-1">No recent transactions found.</p>
                                <p className="text-[11px]">Interact with the contracts to see them appear here.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-[#1d1d1f]/50 text-[#86868b] text-[9px] uppercase tracking-widest font-bold border-b border-[#424245]">
                                    <tr>
                                        <th className="px-6 py-3">Tx Hash</th>
                                        <th className="px-6 py-3">Event</th>
                                        <th className="px-6 py-3">Contract</th>
                                        <th className="px-6 py-3 hidden sm:table-cell">Block</th>
                                        <th className="px-6 py-3">Time</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#424245] font-mono text-[12px] text-[#f5f5f7]">
                                    {recentTxs.map(tx => (
                                        <tr key={tx.id} className="hover:bg-[#1d1d1f]/60 transition-colors">
                                            <td className="px-6 py-4">
                                                <a
                                                    href={`https://sepolia.etherscan.io/tx/${tx.tx}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#0071e3] hover:text-[#2997ff] transition-colors"
                                                >
                                                    {shortHash(tx.tx)}
                                                </a>
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-[#f5f5f7]">
                                                {tx.event}
                                            </td>
                                            <td className="px-6 py-4 text-[#86868b]">
                                                {tx.contract}
                                            </td>
                                            <td className="px-6 py-4 text-[#86868b] hidden sm:table-cell">
                                                #{tx.block}
                                            </td>
                                            <td className="px-6 py-4 text-[#86868b]">
                                                {tx.time}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 border rounded-md text-[9px] uppercase tracking-wider font-bold ${tx.status === 'CONFIRMED'
                                                    ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/30'
                                                    : 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/30'
                                                    }`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    )
}