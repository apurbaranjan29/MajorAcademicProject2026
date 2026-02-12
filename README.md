# Blockchain-Enabled Smart Healthcare System

## Project Overview
This project implements a **consortium-based Ethereum blockchain solution**
for a **secure, privacy-preserving, and intelligent smart healthcare system**.

Traditional healthcare systems suffer from:
- Centralized data storage
- Poor interoperability
- Data tampering risks
- Lack of patient control over medical records

To address these issues, this system uses:
- **Ethereum smart contracts (Solidity)**
- **Consent-driven access control**
- **Off-chain storage (IPFS – conceptual)**
- **Immutable audit trails**

The solution is designed for a **consortium blockchain network**, where
hospitals, labs, insurers, pharmacies, and regulators are known participants.

---

## System Architecture (High Level)
- Patients own and control their medical data
- Doctors, hospitals, and insurers can access data **only with patient consent**
- Medical data is stored **off-chain**, while hashes and permissions are stored **on-chain**
- Smart contracts automate healthcare workflows securely and transparently

---

## Smart Contract Modules

### 1. PatientIdentityAndConsent.sol
**Purpose:**
- Registers patients on the blockchain
- Stores patient metadata (hash only)
- Allows patients to grant or revoke consent

**Key Features:**
- Patient-centric data ownership
- Fine-grained consent management
- Foundation for all other modules

---

### 2. MedicalRecordsAndAccess.sol
**Purpose:**
- Stores encrypted medical record references (IPFS hash)
- Enforces consent-based access
- Logs all record access events

**Key Features:**
- No raw medical data on blockchain
- Immutable audit trail
- Access only if patient consent exists

---

### 3. PrescriptionAndDiagnosis.sol
**Purpose:**
- Allows doctors to add diagnoses and prescriptions
- Ensures prescriptions are written only by authorized doctors

**Key Features:**
- Prevents prescription fraud
- Creates immutable clinical history
- Consent-based medical authority

---

### 4. InsuranceClaims.sol
**Purpose:**
- Automates insurance claim submission and verification
- Tracks claim lifecycle (Submitted → Approved → Paid/Rejected)

**Key Features:**
- Transparent claim processing
- Reduces fraud and paperwork
- Includes **optional Ether-based payout (demo only)**

---

### 5. DrugAuthenticity.sol
**Purpose:**
- Tracks drug batches from manufacturer to pharmacy
- Prevents counterfeit medicines
- Allows public verification of drug authenticity

**Key Features:**
- Supply chain traceability
- Government/regulator-controlled onboarding
- Public drug verification

---

## Why Ether (ETH) is Optional
Ether transactions are **NOT required** for real-world healthcare systems.

In this project:
- ETH is used **only for academic demonstration** in the Insurance module
- It simulates automated settlement logic
- Real healthcare payments are handled **off-chain** via regulated systems

**Important Note:**
> Ether usage is included strictly for learning and demonstration purposes.
> In real consortium healthcare blockchains, financial settlements remain off-chain.

---

## Contract Interaction Flow

1. Patient registers using `PatientIdentityAndConsent`
2. Patient grants consent to doctor/hospital/insurer
3. Doctor uploads medical record hash via `MedicalRecordsAndAccess`
4. Doctor adds diagnosis/prescription via `PrescriptionAndDiagnosis`
5. Hospital submits insurance claim via `InsuranceClaims`
6. Insurer approves or rejects claim
7. (Optional) ETH payout executed for demo purposes
8. Drug authenticity verified using `DrugAuthenticity`

All modules rely on **patient consent as the core security principle**.

---

## Technology Stack
- **Blockchain:** Ethereum (Consortium / PoA model)
- **Smart Contracts:** Solidity ^0.8.x
- **Off-chain Storage:** IPFS (conceptual)
- **Development Tool:** Remix IDE
- **Version Control:** GitHub

---

## Deployment Order
1. PatientIdentityAndConsent
2. MedicalRecordsAndAccess
3. PrescriptionAndDiagnosis
4. InsuranceClaims
5. DrugAuthenticity

---

## Disclaimer
This project is developed as a **B.Tech Major Project**.
It is intended for **academic and research purposes only**.

---

## Authors
B.Tech Major Project  
Blockchain-Enabled Smart Healthcare System
