import { ethers } from 'ethers'

// Import the ABIs you just saved
import PatientIdentityABI from '../contracts/abis/PatientIdentityAndConsent.json'
import MedicalRecordsABI from '../contracts/abis/MedicalRecordsAndAccess.json'
import InsuranceClaimsABI from '../contracts/abis/InsuranceClaims.json'


export const getReadProvider = () =>
    new ethers.JsonRpcProvider('https://rpc.ankr.com/eth_sepolia')

// Paste your actual deployed Sepolia addresses here
export const CONTRACT_ADDRESSES = {
    PatientIdentity: '0x71d24a4338E2312a3d5FCa76C3820C7c3EC3D0E5',
    MedicalRecords: '0x5eF99061a8EC4720EBB575D12FeC8FB541d5820a',
    AccessControl: '0x0771Bf0A0C67cc28aBe598e775Fc8abe718f34c1',
    PrescriptionAndDiagnosis: '0x4C814F409D115E977a54a77F7ecbD7a8920DBFB2',
    IoTDataLogger: '0xc8C0aab3B40Ff08A0Aa8B9930CaB1d3ba84726CB',
    InsuranceClaims: '0x2161c16AE175A09CDDFE6c8908bAa7897744B2ED'
}

/**
 * Helper function to get a connected contract instance
 * @param {string} contractName - Key from CONTRACT_ADDRESSES
 * @param {object} providerOrSigner - from useWeb3()
 */
export const getContract = (contractName, providerOrSigner) => {
    let abi
    switch (contractName) {
        case 'PatientIdentity': abi = PatientIdentityABI; break;
        case 'MedicalRecords': abi = MedicalRecordsABI; break;
        case 'InsuranceClaims': abi = InsuranceClaimsABI; break;
        default: return null  // ← safe fallback
    }
    return new ethers.Contract(CONTRACT_ADDRESSES[contractName], abi, providerOrSigner)
}