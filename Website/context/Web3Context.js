'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { ethers } from 'ethers'

const Web3Context = createContext()

export function Web3Provider({ children }) {
    const [account, setAccount] = useState(null)
    const [provider, setProvider] = useState(null)
    const [signer, setSigner] = useState(null)
    const [isConnecting, setIsConnecting] = useState(false)

    const disconnectWallet = () => {
        setAccount(null)
        setProvider(null)
        setSigner(null)
    }

    const syncWallet = async () => {
        if (typeof window.ethereum === 'undefined') return

        const web3Provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await web3Provider.send('eth_accounts', [])

        if (accounts.length > 0) {
            const web3Signer = await web3Provider.getSigner()
            setAccount(accounts[0])
            setProvider(web3Provider)
            setSigner(web3Signer)
        }
    }

    const connectWallet = async () => {
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask!')
            return
        }

        setIsConnecting(true)

        try {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }],
                })
            } catch (switchError) {
                console.error('Network switch error:', switchError)
            }

            await window.ethereum.request({ method: 'eth_requestAccounts' })

            const web3Provider = new ethers.BrowserProvider(window.ethereum)
            const web3Signer = await web3Provider.getSigner()
            const accounts = await web3Provider.send('eth_accounts', [])

            setAccount(accounts[0] || null)
            setProvider(web3Provider)
            setSigner(web3Signer)
        } catch (error) {
            console.error('Error connecting wallet:', error)
        } finally {
            setIsConnecting(false)
        }
    }

    useEffect(() => {
        if (typeof window.ethereum === 'undefined') return

        const handleAccountsChanged = async (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet()
                return
            }

            const web3Provider = new ethers.BrowserProvider(window.ethereum)
            const web3Signer = await web3Provider.getSigner()

            setAccount(accounts[0])
            setProvider(web3Provider)
            setSigner(web3Signer)
        }

        const handleChainChanged = async () => {
            await syncWallet()
        }

        window.ethereum.on('accountsChanged', handleAccountsChanged)
        window.ethereum.on('chainChanged', handleChainChanged)

        return () => {
            window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
            window.ethereum.removeListener?.('chainChanged', handleChainChanged)
        }
    }, [])

    useEffect(() => {
        syncWallet()
    }, [])

    return (
        <Web3Context.Provider
            value={{
                account,
                provider,
                signer,
                connectWallet,
                disconnectWallet,
                isConnecting,
            }}
        >
            {children}
        </Web3Context.Provider>
    )
}

export function useWeb3() {
    return useContext(Web3Context)
}