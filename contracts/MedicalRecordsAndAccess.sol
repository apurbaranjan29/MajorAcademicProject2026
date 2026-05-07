// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  MedicalRecordsAndAccess
 * @notice Stores encrypted medical record IPFS hashes on-chain and enforces
 *         patient-controlled, time-limited consent before allowing access.
 */

// Interface for PatientIdentityAndConsent
interface IPatientConsent {
    function isRegisteredPatient(address patient) external view returns (bool);
    function hasValidConsent(address patient, address delegate) external view returns (bool);
}


// Inline ReentrancyGuard
abstract contract ReentrancyGuard {
    uint256 private _guardStatus = 1;
    modifier nonReentrant() {
        require(_guardStatus == 1, "ReentrancyGuard: reentrant call");
        _guardStatus = 2;
        _;
        _guardStatus = 1;
    }
}

contract MedicalRecordsAndAccess is ReentrancyGuard {

    // Types

    struct MedicalRecord {
        uint256 recordId;
        address patient;
        address uploadedBy;     // doctor or lab address
        string  ipfsHash;       // encrypted record CID on IPFS
        string  recordType;     // e.g. "LAB_REPORT", "XRAY", "DISCHARGE_SUMMARY"
        uint256 version;        // version number for this patient's record chain
        uint256 timestamp;
    }

    // State
    IPatientConsent public identityContract;

    uint256 public recordCount;
    string[] public allAnchoredRecords;

    // recordId => MedicalRecord
    mapping(uint256 => MedicalRecord) public medicalRecords;

    // patient => list of their recordIds  (for pagination)
    mapping(address => uint256[]) private _patientRecordIds;

    // patient => current version counter
    mapping(address => uint256) public patientRecordVersion;

   
    // Events
    event RecordAdded(
        uint256 indexed recordId,
        address indexed patient,
        address indexed uploadedBy,
        string  ipfsHash,
        string  recordType,
        uint256 version,
        uint256 timestamp
    );
    event RecordAccessed(
        uint256 indexed recordId,
        address indexed patient,
        address indexed accessedBy,
        string  accessorRole,   // "DOCTOR" | "INSURER" | "RESEARCHER" etc.
        uint256 timestamp
    );
    event RecordUpdated(uint256 indexed recordId, string oldHash, string newHash, uint256 timestamp);

    // Modifiers
    modifier onlyRegisteredPatient(address patient) {
        require(identityContract.isRegisteredPatient(patient), "Patient not registered");
        _;
    }
    modifier hasConsent(address patient) {
        require(identityContract.hasValidConsent(patient, msg.sender), "No valid consent from patient");
        _;
    }

    // Constructor
    constructor(address _identityContract) {
        require(_identityContract != address(0), "Invalid identity contract address");
        identityContract = IPatientConsent(_identityContract);
    }

    // Write functions
    /**
     * @notice Add a medical record for a patient.
     *         Caller must hold valid patient consent.
     * @param  patient     Patient's address
     * @param  ipfsHash    IPFS CID of the AES-256 encrypted record
     * @param  recordType  Human-readable type string ("LAB_REPORT", "PRESCRIPTION", etc.)
     */
    function addMedicalRecord(
        address patient,
        string  memory ipfsHash,
        string  memory recordType
    )
        external
        onlyRegisteredPatient(patient)
        hasConsent(patient)
        nonReentrant
    {
        require(bytes(ipfsHash).length   > 0, "IPFS hash required");
        require(bytes(recordType).length > 0, "Record type required");

        // Increment global record counter and patient version counter
        recordCount++;
        patientRecordVersion[patient]++;

        uint256 newVersion = patientRecordVersion[patient];

        medicalRecords[recordCount] = MedicalRecord({
            recordId:   recordCount,
            patient:    patient,
            uploadedBy: msg.sender,
            ipfsHash:   ipfsHash,
            recordType: recordType,
            version:    newVersion,
            timestamp:  block.timestamp
        });

        _patientRecordIds[patient].push(recordCount);
        allAnchoredRecords.push(recordCID);

        emit RecordAdded(
            recordCount, patient, msg.sender,
            ipfsHash, recordType, newVersion, block.timestamp
        );
    }

    /**
     * @notice Allows the original doctor to correct a faulty record.
     * The old hash is permanently logged in the event history for auditing.
     */
    function updateMedicalRecord(uint256 _recordId, string memory _newIpfsHash) external {
        MedicalRecord storage rec = medicalRecords[_recordId];
        require(msg.sender == rec.uploadedBy, "Only the prescribing doctor can update this record");
        string memory oldHash = rec.ipfsHash;
        rec.ipfsHash = _newIpfsHash;
        emit RecordUpdated(_recordId, oldHash, _newIpfsHash, block.timestamp);
    }

    // Read functions
    /**
     * @notice View a specific medical record and emit an access log.
     *         Requires valid patient consent.
     * @param  recordId     The global record ID
     * @param  accessorRole Human-readable role label (passed by caller for the audit log)
     * @return ipfsHash     IPFS CID of the encrypted record
     */
    function viewMedicalRecord(uint256 recordId, string memory accessorRole)
        external
        returns (string memory ipfsHash)
    {
        require(recordId > 0 && recordId <= recordCount, "Invalid record ID");

        address patient = medicalRecords[recordId].patient;
        require(
            identityContract.hasValidConsent(patient, msg.sender),
            "No valid consent from patient"
        );

        emit RecordAccessed(recordId, patient, msg.sender, accessorRole, block.timestamp);
        return medicalRecords[recordId].ipfsHash;
    }

    /**
     * @notice Returns all record IDs belonging to a patient.
     *         Frontend uses this to paginate a patient's record history.
     * @param  patient  Patient's address
     */
    function getRecordsByPatient(address patient)
        external
        view
        returns (uint256[] memory)
    {
        return _patientRecordIds[patient];
    }

    /**
     * @notice Returns the total number of records for a patient.
     */
    function getRecordCount(address patient) external view returns (uint256) {
        return _patientRecordIds[patient].length;
    }
    /**
     * @notice Returns the latest version number of a patient's records.
     *         Useful for checking if a patient's records have been updated.
     */
    function getLatestVersion(address patient) external view returns (uint256) {
        return patientRecordVersion[patient];
    }
    function getTotalRecords() external view returns (uint256) {
        return recordCount;
    }
    function getAllRecords() external view returns (string[] memory) {
        return allAnchoredRecords;
    }
    
}
