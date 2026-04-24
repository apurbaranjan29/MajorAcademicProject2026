// ─────────────────────────────────────────────────────────────
// lib/mock-data.js
// All mock data for Phase 1 (frontend-only).
// Replace with real contract/API calls in Phase 3 & 4.
// ─────────────────────────────────────────────────────────────

// ── Network ─────────────────────────────────────────────────
export const NETWORK = {
    name: 'Sepolia Testnet',
    chainId: '11155111',
    blockNumber: 7_234_891,
    gasPrice: '2.4 gwei',
    rpc: 'https://sepolia.infura.io/v3/...',
}

// ── Wallet ───────────────────────────────────────────────────
export const WALLET = {
    address: '0x3f2A8c4E6bD19F7a3C21e84B56D90A2Fe1c7e91C',
    short: '0x3f2A...e91C',
    role: 'HOSPITAL_ADMIN',
    balance: '0.482 ETH',
}

// ── Dashboard stats ──────────────────────────────────────────
export const STATS = [
    {
        id: 'patients',
        label: 'Patients Registered',
        value: '24',
        change: '+3 this week',
        trend: 'up',
        detail: 'On-chain via PatientIdentityAndConsent.sol',
    },
    {
        id: 'records',
        label: 'Records On-Chain',
        value: '91',
        change: '+12 this week',
        trend: 'up',
        detail: 'IPFS CIDs anchored via MedicalRecordsAndAccess.sol',
    },
    {
        id: 'consents',
        label: 'Active Consents',
        value: '17',
        change: '2 expiring soon',
        trend: 'neutral',
        detail: 'Time-limited grants via PatientIdentityAndConsent.sol',
    },
    {
        id: 'alerts',
        label: 'IoT Alerts (24h)',
        value: '5',
        change: '2 critical',
        trend: 'down',
        detail: 'Threshold events via IoTDataLogger.sol',
    },
]

// ── Recent transactions ──────────────────────────────────────
export const RECENT_TXS = [
    {
        hash: '0xabc1...f023',
        fullHash: '0xabc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091023',
        event: 'RecordAdded',
        contract: 'MedicalRecordsAndAccess',
        from: '0x7f3A...d92B',
        block: 7_234_887,
        age: '2 min ago',
        status: 'confirmed',
    },
    {
        hash: '0xd4e5...8b12',
        fullHash: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091023abc1d2e3f4a5b6c7d8e9f0a18b12',
        event: 'ConsentGranted',
        contract: 'PatientIdentityAndConsent',
        from: '0xA1c9...8E3D',
        block: 7_234_881,
        age: '8 min ago',
        status: 'confirmed',
    },
    {
        hash: '0x29fa...c340',
        fullHash: '0x29fab1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8c340',
        event: 'PatientRegistered',
        contract: 'PatientIdentityAndConsent',
        from: '0x3f2A...e91C',
        block: 7_234_874,
        age: '14 min ago',
        status: 'confirmed',
    },
    {
        hash: '0x77cc...1a09',
        fullHash: '0x77ccdd1122334455667788990011aabbccddeeff00112233445566778899aa1a09',
        event: 'AlertTriggered',
        contract: 'IoTDataLogger',
        from: '0xF88d...3C7E',
        block: 7_234_860,
        age: '31 min ago',
        status: 'confirmed',
    },
    {
        hash: '0x5512...e781',
        fullHash: '0x5512a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e781',
        event: 'ConsentRevoked',
        contract: 'PatientIdentityAndConsent',
        from: '0x2B7f...E14A',
        block: 7_234_851,
        age: '44 min ago',
        status: 'confirmed',
    },
]

// ── Patients ─────────────────────────────────────────────────
export const PATIENTS = [
    {
        id: 'P001',
        name: 'Arjun Sharma',
        wallet: '0x7f3A8c4E6bD19F7a3C21e84B56D90A2Fe1c7d92B',
        short: '0x7f3A...d92B',
        age: 52,
        ward: 'Cardiology',
        registered: '2026-03-15',
        ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
        consents: 2,
        records: 4,
        status: 'active',
    },
    {
        id: 'P002',
        name: 'Priya Nair',
        wallet: '0xA1c98b7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b8E3D',
        short: '0xA1c9...8E3D',
        age: 34,
        ward: 'General',
        registered: '2026-03-22',
        ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
        consents: 1,
        records: 2,
        status: 'active',
    },
    {
        id: 'P003',
        name: 'Raj Mehta',
        wallet: '0x2B7fa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8E14A',
        short: '0x2B7f...E14A',
        age: 67,
        ward: 'ICU',
        registered: '2026-04-01',
        ipfsHash: 'QmT78bkqgGkqH9UsF85Hf9CfDgrNNazzBK8bVroaConv4A',
        consents: 3,
        records: 9,
        status: 'critical',
    },
    {
        id: 'P004',
        name: 'Sunita Patel',
        wallet: '0xF88da1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f83C7E',
        short: '0xF88d...3C7E',
        age: 45,
        ward: 'Diabetology',
        registered: '2026-04-08',
        ipfsHash: 'QmSrEYrBztpFjTWgSoSBbGDdwBSaTHqbTcH59p5BXy5Huj',
        consents: 1,
        records: 3,
        status: 'active',
    },
]

// ── Medical Records ──────────────────────────────────────────
export const RECORDS = [
    {
        id: 'R001',
        patientId: 'P001',
        patient: 'Arjun Sharma',
        type: 'ECG Report',
        ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
        uploadedBy: '0x7f3A...d92B',
        version: 2,
        timestamp: '2026-04-21 09:14',
        txHash: '0xabc1...f023',
        block: 7_234_887,
    },
    {
        id: 'R002',
        patientId: 'P001',
        patient: 'Arjun Sharma',
        type: 'Blood Panel',
        ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
        uploadedBy: '0x7f3A...d92B',
        version: 1,
        timestamp: '2026-04-14 11:32',
        txHash: '0xd4e5...8b12',
        block: 7_234_801,
    },
    {
        id: 'R003',
        patientId: 'P003',
        patient: 'Raj Mehta',
        type: 'ICU Vitals Batch',
        ipfsHash: 'QmT78bkqgGkqH9UsF85Hf9CfDgrNNazzBK8bVroaConv4A',
        uploadedBy: '0x2B7f...E14A',
        version: 6,
        timestamp: '2026-04-21 07:01',
        txHash: '0x29fa...c340',
        block: 7_234_874,
    },
]

// ── Consents ─────────────────────────────────────────────────
export const CONSENTS = [
    {
        id: 'C001',
        patient: 'Arjun Sharma',
        patientId: 'P001',
        delegate: '0xDr1a...9F22',
        role: 'DOCTOR',
        grantedAt: '2026-03-15',
        expiresAt: '2027-03-15',
        status: 'active',
        txHash: '0xd4e5...8b12',
    },
    {
        id: 'C002',
        patient: 'Arjun Sharma',
        patientId: 'P001',
        delegate: '0xIns3b...A451',
        role: 'INSURER',
        grantedAt: '2026-04-01',
        expiresAt: '2026-07-01',
        status: 'expiring',
        txHash: '0x5512...e781',
    },
    {
        id: 'C003',
        patient: 'Raj Mehta',
        patientId: 'P003',
        delegate: '0xDr2c...8B10',
        role: 'DOCTOR',
        grantedAt: '2026-04-01',
        expiresAt: '2027-04-01',
        status: 'active',
        txHash: '0x77cc...1a09',
    },
]

// ── IoT Vitals (last 12 readings for sparklines) ─────────────
export const IOT_VITALS = {
    P001: {
        hr: [71, 73, 72, 74, 73, 72, 75, 74, 73, 72, 74, 73],
        spo2: [97, 97, 98, 97, 98, 98, 97, 98, 97, 97, 98, 97],
        bp: [128, 130, 129, 131, 128, 130, 129, 128, 131, 130, 129, 128],
    },
    P003: {
        hr: [98, 102, 105, 108, 110, 107, 112, 115, 109, 114, 118, 112],
        spo2: [92, 91, 90, 91, 92, 90, 89, 91, 90, 88, 91, 90],
        bp: [158, 162, 165, 161, 168, 164, 170, 166, 163, 169, 165, 162],
    },
}

// ── Tamper check samples ──────────────────────────────────────
export const TAMPER_SAMPLES = [
    {
        label: 'ECG Report — Arjun Sharma',
        ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
        onChainHash: 'a3f1c2d4e5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0',
        originalData: '{"patient":"Arjun Sharma","type":"ECG","date":"2026-04-21","result":"Normal sinus rhythm"}',
    },
]