// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  PrescriptionAndDiagnosis
 * @notice Doctors write diagnoses and prescriptions on-chain (IPFS hash +
 *         metadata).  Prescriptions have an expiry and a lifecycle:
 *         ISSUED → DISPENSED | EXPIRED.
 */

// Interfaces 
interface IPatientConsent {
    function isRegisteredPatient(address patient) external view returns (bool);
    function hasValidConsent(address patient, address delegate) external view returns (bool);
}

interface IAccessControl {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function PHARMACIST_ROLE() external pure returns (bytes32);
    function DOCTOR_ROLE()     external pure returns (bytes32);
}


abstract contract ReentrancyGuard {
    uint256 private _guardStatus = 1;
    modifier nonReentrant() {require(_guardStatus == 1, "ReentrancyGuard: reentrant call");
        _guardStatus = 2;
        _;
        _guardStatus = 1;
    }
}

contract PrescriptionAndDiagnosis is ReentrancyGuard {

    // Types
    enum PrescriptionStatus { ISSUED, DISPENSED, EXPIRED }

    struct Diagnosis {
        uint256 diagnosisId;
        address patient;
        address doctor;
        string  diagnosisDetails;   // e.g. "Type-2 Diabetes, Hypertension"
        string  ipfsHash;           // IPFS CID of detailed diagnosis doc (optional)
        uint256 timestamp;
    }

    struct Prescription {
        uint256 prescriptionId;
        address patient;
        address doctor;
        string  medicationDetails;  // e.g. "Metformin 500mg twice daily"
        string  ipfsHash;           // IPFS CID of prescription doc
        PrescriptionStatus status;
        uint256 issuedAt;
        uint256 expiresAt;          // prescription is invalid after this
        address dispensedBy;        // pharmacist who dispensed (0 if not yet)
        uint256 dispensedAt;
    }

    // State
    IPatientConsent public identityContract;
    IAccessControl  public accessControl;

    uint256 public diagnosisCount;
    uint256 public prescriptionCount;

    mapping(uint256 => Diagnosis)    public diagnoses;
    mapping(uint256 => Prescription) public prescriptions;

    // patient => list of their prescription IDs
    mapping(address => uint256[]) private _patientPrescriptions;
    // patient => list of their diagnosis IDs
    mapping(address => uint256[]) private _patientDiagnoses;

    // Default prescription validity: 180 days (6 months)
    uint256 public constant DEFAULT_PRESCRIPTION_VALIDITY = 180 days;


    // Events
    event DiagnosisAdded(
        uint256 indexed diagnosisId,
        address indexed patient,
        address indexed doctor,
        uint256 timestamp
    );
    event PrescriptionAdded(
        uint256 indexed prescriptionId,
        address indexed patient,
        address indexed doctor,
        uint256 expiresAt
    );
    event PrescriptionDispensed(
        uint256 indexed prescriptionId,
        address indexed patient,
        address indexed pharmacist,
        uint256 dispensedAt
    );
    event PrescriptionExpired(
        uint256 indexed prescriptionId,
        address indexed patient,
        uint256 expiredAt
    );

    // Modifiers
    modifier onlyRegisteredPatient(address patient) {
        require(identityContract.isRegisteredPatient(patient), "Patient not registered");
        _;
    }
    modifier hasConsent(address patient) {
        require(identityContract.hasValidConsent(patient, msg.sender), "No valid consent from patient");
        _;
    }
    modifier onlyPharmacist() {
        require(
            accessControl.hasRole(accessControl.PHARMACIST_ROLE(), msg.sender),
            "Only a registered pharmacist can dispense"
        );
        _;
    }

    // Constructor
    constructor(address _identityContract, address _accessControl) {
        require(_identityContract != address(0), "Invalid identity contract");
        require(_accessControl    != address(0), "Invalid access control contract");
        identityContract = IPatientConsent(_identityContract);
        accessControl    = IAccessControl(_accessControl);
    }


    // Doctor functions
    /**
     * @notice Add a diagnosis for a patient.
     *         Caller must be a consented doctor.
     */

    function addDiagnosis(
        address patient,
        string  memory diagnosisDetails,
        string  memory ipfsHash
    )
        external
        onlyRegisteredPatient(patient)
        hasConsent(patient)
        nonReentrant
    {
        require(bytes(diagnosisDetails).length > 0, "Diagnosis details required");

        diagnosisCount++;
        diagnoses[diagnosisCount] = Diagnosis({
            diagnosisId:      diagnosisCount,
            patient:          patient,
            doctor:           msg.sender,
            diagnosisDetails: diagnosisDetails,
            ipfsHash:         ipfsHash,
            timestamp:        block.timestamp
        });

        _patientDiagnoses[patient].push(diagnosisCount);
        emit DiagnosisAdded(diagnosisCount, patient, msg.sender, block.timestamp);
    }

    /**
     * @notice Add a prescription for a patient.
     * @param  validityDays  0 = use default 180 days
     */
    function addPrescription(
        address patient,
        string  memory medicationDetails,
        string  memory ipfsHash,
        uint256 validityDays
    )
        external
        onlyRegisteredPatient(patient)
        hasConsent(patient)
        nonReentrant
    {
        require(bytes(medicationDetails).length > 0, "Medication details required");

        uint256 validity  = validityDays == 0 ? DEFAULT_PRESCRIPTION_VALIDITY : validityDays * 1 days;
        uint256 expiresAt = block.timestamp + validity;

        prescriptionCount++;
        prescriptions[prescriptionCount] = Prescription({
            prescriptionId:    prescriptionCount,
            patient:           patient,
            doctor:            msg.sender,
            medicationDetails: medicationDetails,
            ipfsHash:          ipfsHash,
            status:            PrescriptionStatus.ISSUED,
            issuedAt:          block.timestamp,
            expiresAt:         expiresAt,
            dispensedBy:       address(0),
            dispensedAt:       0
        });

        _patientPrescriptions[patient].push(prescriptionCount);
        emit PrescriptionAdded(prescriptionCount, patient, msg.sender, expiresAt);
    }

    // Pharmacist functions

    /**
     * @notice Mark a prescription as dispensed.
     *         Only callable by a registered pharmacist.
     *         Validates the prescription is still ISSUED and not expired.
     *         DrugAuthenticity.sol calls isValidPrescription() before this.
     */
    function dispensePrescription(uint256 prescriptionId)
        external
        onlyPharmacist
        nonReentrant
    {
        Prescription storage p = prescriptions[prescriptionId];
        require(p.prescriptionId != 0,                      "Prescription does not exist");
        require(p.status == PrescriptionStatus.ISSUED,       "Prescription already dispensed or expired");
        require(block.timestamp < p.expiresAt,               "Prescription has expired");

        p.status      = PrescriptionStatus.DISPENSED;
        p.dispensedBy = msg.sender;
        p.dispensedAt = block.timestamp;

        emit PrescriptionDispensed(prescriptionId, p.patient, msg.sender, block.timestamp);
    }

    /**
     * @notice Mark a prescription as EXPIRED.
     *         Anyone can call this on an overdue prescription (used by bots / cron).
     */
    function expirePrescription(uint256 prescriptionId) external {
        Prescription storage p = prescriptions[prescriptionId];
        require(p.prescriptionId != 0,                      "Prescription does not exist");
        require(p.status == PrescriptionStatus.ISSUED,       "Not in ISSUED state");
        require(block.timestamp >= p.expiresAt,              "Prescription has not expired yet");

        p.status = PrescriptionStatus.EXPIRED;
        emit PrescriptionExpired(prescriptionId, p.patient, block.timestamp);
    }

    // View functions
    /**
     * @notice Primary cross-contract check used by DrugAuthenticity.
     *         Returns true only if prescription is ISSUED and not expired.
     */
    function isValidPrescription(uint256 prescriptionId)
        external
        view
        returns (bool)
    {
        Prescription memory p = prescriptions[prescriptionId];
        return (
            p.prescriptionId != 0 &&
            p.status == PrescriptionStatus.ISSUED &&
            block.timestamp < p.expiresAt
        );
    }

    /**
     * @notice Returns full prescription struct — called by DrugAuthenticity
     *         to get the patient address for validation.
     */
    function getPrescription(uint256 prescriptionId)
        external
        view
        returns (Prescription memory)
    {
        require(prescriptions[prescriptionId].prescriptionId != 0, "Prescription does not exist");
        return prescriptions[prescriptionId];
    }

    /// @notice Returns all prescription IDs for a patient
    function getPrescriptionsByPatient(address patient) external view returns (uint256[] memory) {
        return _patientPrescriptions[patient];
    }

    /// @notice Returns all diagnosis IDs for a patient
    function getDiagnosesByPatient(address patient) external view returns (uint256[] memory) {
        return _patientDiagnoses[patient];
    }
}
