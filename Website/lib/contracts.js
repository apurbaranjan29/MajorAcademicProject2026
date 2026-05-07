import { ethers } from 'ethers'

// Import the ABIs you just saved
import PatientIdentityABI from '../contracts/abis/PatientIdentityAndConsent.json'
import MedicalRecordsABI from '../contracts/abis/MedicalRecordsAndAccess.json'


export const getReadProvider = () =>
    new ethers.JsonRpcProvider('https://rpc.ankr.com/eth_sepolia')

// Paste your actual deployed Sepolia addresses here
export const CONTRACT_ADDRESSES = {
    PatientIdentity: '0xe441648F30C3BFf9Ff4e2A7619ae09C8c67a33a0',
    MedicalRecords: '0xdfC8d7F599Cfa3A39F3688067B6B7DC1333011e4',
    AccessControl: '0xf5BBcF418941756F996a36bA9408FebA73ef4F29',
    PrescriptionAndDiagnosis: '0xe38e5Fa756EB0864c007a9B81AC63F4aDC19e94d',
    IoTDataLogger: '0x2E1Dd4e90e3C724d98Ba3726AaFFce580880c012'
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