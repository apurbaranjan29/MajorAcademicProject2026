'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { getContract } from '../lib/contracts'
import { useWeb3 } from '../context/Web3Context'

export function usePatients() {
    const { provider } = useWeb3()
    const [dynamicPatients, setDynamicPatients] = useState([])
    const [isLoadingData, setIsLoadingData] = useState(true)

    useEffect(() => {
        const fetchAllPatientsFromChain = async () => {
            if (!provider) return

            try {
                setIsLoadingData(true)
                // 1. Connect to PatientIdentity Contract
                const identityContract = getContract('PatientIdentity', provider)

                // 2. Query the blockchain for ALL 'PatientRegistered' events ever emitted
                // Note: Adjust the event name if it differs in your Solidity code
                const filter = identityContract.filters.PatientRegistered()
                const events = await identityContract.queryFilter(filter)

                // 3. Extract data and fetch from IPFS
                const patientPromises = events.map(async (event) => {
                    // Extract wallet and IPFS hash from the event arguments
                    const wallet = event.args[0] // Assuming first arg is patientWallet
                    const registeredBy = event.args[1]
                    const ipfsHash = event.args[2] // Assuming second arg is ipfsHash

                    // Fetch the actual JSON metadata from IPFS
                    try {
                        const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`)
                        const metadata = await ipfsRes.json()

                        return {
                            id: wallet.substring(2, 6).toUpperCase(), // Generate short ID from wallet
                            name: metadata.name,
                            wallet: wallet,
                            short: `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}`,
                            age: metadata.age || '--',
                            ward: metadata.ward || 'Unknown',
                            registered: new Date(metadata.registeredAt || Date.now()).toISOString().split('T')[0],
                            ipfsHash: ipfsHash,
                            consents: 0, // In a full app, you'd query these too
                            records: 0,
                            status: metadata.ward === 'ICU' ? 'critical' : 'active'
                        }
                    } catch (err) {
                        console.error("Failed to fetch IPFS for", ipfsHash)
                        return null
                    }
                })

                // Wait for all IPFS fetches to complete
                const resolvedPatients = (await Promise.all(patientPromises)).filter(p => p !== null)

                // Reverse so the newest patients are at the top
                setDynamicPatients(resolvedPatients.reverse())

            } catch (error) {
                console.error("Error building dynamic patient list:", error)
            } finally {
                setIsLoadingData(false)
            }
        }

        fetchAllPatientsFromChain()
    }, [provider])

    return { dynamicPatients, isLoadingData }
}