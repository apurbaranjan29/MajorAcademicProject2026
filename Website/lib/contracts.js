import { ethers } from 'ethers'

// Import the ABIs you just saved
import PatientIdentityABI from '../contracts/abis/PatientIdentityAndConsent.json'
import MedicalRecordsABI from '../contracts/abis/MedicalRecordsAndAccess.json'


export const getReadProvider = () =>
    new ethers.JsonRpcProvider('https://rpc.ankr.com/eth_sepolia')

// Paste your actual deployed Sepolia addresses here
export const CONTRACT_ADDRESSES = {
    PatientIdentity: '0x993b6DddA704AbD3b96779dDa79527478b80c763',
    MedicalRecords: '0xEC5Fe3D21C4d6aB425602621e17f7Df8d30d1D2b',
    AccessControl: '0xb7f3D30A7ED79078d96749Bb4D8545750A54DB1e',
    PrescriptionAndDiagnosis: '0x389EB49f323f73F7662e4803D15131a54f12e8EE',
    IoTDataLogger: '0xE66550226cffF249B6aF48d33a621484Bd976952'
}

/**
 * Helper function to get a connected contract instance
 * @param {string} contractName - Key from CONTRACT_ADDRESSES
 * @param {object} providerOrSigner - from useWeb3()
 */
export const getContract = (contractName, providerOrSigner) => {
    let abi
    switch (contractName) {
        case 'PatientIdentity': abi = PatientIdentityABI; break
        case 'MedicalRecords': abi = MedicalRecordsABI; break
        default: return null  // ← safe fallback
    }
    return new ethers.Contract(CONTRACT_ADDRESSES[contractName], abi, providerOrSigner)
}