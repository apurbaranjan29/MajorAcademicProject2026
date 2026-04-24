// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  PatientIdentityAndConsent
 * @notice Registers patients, manages metadata hashes (IPFS), and controls
 *         time-limited consent granted to doctors / hospitals / insurers.
 *
 * CHANGES FROM v1:
 *  - Consent now carries an expiresAt timestamp (GDPR-aligned, time-limited)
 *  - hasValidConsent() view replaces the raw `consents` bool mapping for
 *    cross-contract checks — all other contracts call this
 *  - ReentrancyGuard added to all state-changing functions
 *  - Event names standardised to PascalCase
 *  - Duplicate registration check was already there; strengthened guard
 *  - getConsentDetails() added so the frontend can display expiry
 */

// ─── Minimal inline ReentrancyGuard (no external dependency needed) ────────
abstract contract ReentrancyGuard {
    uint256 private _guardStatus = 1;
    modifier nonReentrant() {
        require(_guardStatus == 1, "ReentrancyGuard: reentrant call");
        _guardStatus = 2;
        _;
        _guardStatus = 1;
    }
}
// ────────────────────────────────────────────────────────────────────────────

contract PatientIdentityAndConsent is ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────

    /// @dev Replaces the old `mapping(address=>mapping(address=>bool))`
    ///      Consent is only valid when granted == true AND block.timestamp < expiresAt
    struct ConsentRecord {
        bool    granted;
        uint256 expiresAt;   // Unix timestamp; 0 = not granted
    }

    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────
    address public registryAdmin;
    address[] public registeredPatientsList;

    mapping(address => bool)   public isRegisteredPatient;
    mapping(address => string) public patientMetadata;      // address → IPFS hash

    // patient => delegate => ConsentRecord
    mapping(address => mapping(address => ConsentRecord)) private _consentRecords;

    // Default consent duration: 365 days (can be overridden per grant)
    uint256 public constant DEFAULT_CONSENT_DURATION = 365 days;

    // ─────────────────────────────────────────────────────────────
    // Events  (all PascalCase, all indexed for fast log filtering)
    // ─────────────────────────────────────────────────────────────
    event PatientRegistered(address indexed patient, address indexed registeredBy, string metadataHash, uint256 timestamp);
    event MetadataUpdated(address indexed patient, string newMetadataHash, uint256 timestamp);
    event ConsentGranted(address indexed patient, address indexed delegate, uint256 expiresAt);
    event ConsentRevoked(address indexed patient, address indexed delegate, uint256 revokedAt);

    // ─────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────
    modifier onlyRegistryAdmin() {
        require(msg.sender == registryAdmin, "Only RegistryAdmin can call this");
        _;
    }
    modifier onlyRegisteredPatient() {
        require(isRegisteredPatient[msg.sender], "Only a registered patient can call");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    constructor(address _registryAdmin) {
        require(_registryAdmin != address(0), "Invalid admin address");
        registryAdmin = _registryAdmin;
    }

    // ─────────────────────────────────────────────────────────────
    // Admin functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a new patient.  Only the registry admin calls this
     *         (e.g., hospital onboarding desk).
     * @param  patientAddress  Wallet address of the patient
     * @param  metadataHash    IPFS CID of encrypted patient profile JSON
     */
    function registerPatient(address patientAddress, string memory metadataHash)
        external
        onlyRegistryAdmin
        nonReentrant
    {
        require(patientAddress != address(0), "Invalid patient address");
        require(bytes(metadataHash).length > 0, "Metadata hash required");
        require(!isRegisteredPatient[patientAddress], "Patient already registered");

        isRegisteredPatient[patientAddress] = true;
        patientMetadata[patientAddress]     = metadataHash;
        registeredPatientsList.push(patientAddress);

        emit PatientRegistered(patientAddress, msg.sender, metadataHash, block.timestamp);
    }
    // function transferAdmin(address newAdmin) external onlyRegistryAdmin {
    //     require(newAdmin != address(0), "Cannot transfer to zero address");
    //     registryAdmin = newAdmin;
    // }

    // ─────────────────────────────────────────────────────────────
    // Patient functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Patient updates their own metadata IPFS hash.
     * @param  newMetadataHash  New IPFS CID
     */
    function updateMetadata(string memory newMetadataHash)
        external
        onlyRegisteredPatient
        nonReentrant
    {
        require(bytes(newMetadataHash).length > 0, "Hash cannot be empty");
        patientMetadata[msg.sender] = newMetadataHash;
        emit MetadataUpdated(msg.sender, newMetadataHash, block.timestamp);
    }

    /**
     * @notice Grant consent to a delegate (doctor / hospital / insurer) with
     *         a custom duration in days.  Pass 0 to use the default 365 days.
     * @param  delegate       Address to receive consent
     * @param  durationDays   How many days the consent is valid (0 = default)
     */
    function grantConsent(address delegate, uint256 durationDays)
        external
        onlyRegisteredPatient
        nonReentrant
    {
        require(delegate != address(0),    "Invalid delegate address");
        require(delegate != msg.sender,    "Cannot consent to yourself");

        uint256 duration  = durationDays == 0 ? DEFAULT_CONSENT_DURATION : durationDays * 1 days;
        uint256 expiresAt = block.timestamp + duration;

        _consentRecords[msg.sender][delegate] = ConsentRecord({ granted: true, expiresAt: expiresAt });
        emit ConsentGranted(msg.sender, delegate, expiresAt);
    }

    /**
     * @notice Revoke consent from a delegate immediately.
     * @param  delegate  Address whose consent is revoked
     */
    function revokeConsent(address delegate)
        external
        onlyRegisteredPatient
        nonReentrant
    {
        require(delegate != address(0), "Invalid delegate address");
        require(_consentRecords[msg.sender][delegate].granted, "No active consent to revoke");

        _consentRecords[msg.sender][delegate].granted   = false;
        _consentRecords[msg.sender][delegate].expiresAt = 0;
        emit ConsentRevoked(msg.sender, delegate, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // View functions  (called by all other contracts)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Primary cross-contract consent check.
     *         Returns true only if consent is granted AND not expired.
     * @param  patient   Patient's address
     * @param  delegate  Address requesting access (doctor, insurer, etc.)
     */

    function hasValidConsent(address patient, address delegate)
        external
        view
        returns (bool)
    {
        ConsentRecord memory r = _consentRecords[patient][delegate];
        return (r.granted && block.timestamp < r.expiresAt);
    }

    /**
     * @notice Returns the full consent details for a patient-delegate pair.
     *         Used by the frontend to show expiry date in the dashboard.
     */
    function getConsentDetails(address patient, address delegate)
        external
        view
        returns (bool granted, uint256 expiresAt, bool isExpired)
    {
        ConsentRecord memory r = _consentRecords[patient][delegate];
        granted   = r.granted;
        expiresAt = r.expiresAt;
        isExpired = (r.expiresAt > 0 && block.timestamp >= r.expiresAt);
    }
    // function getAllRegisteredPatients() external view returns (address[] memory) {
    //    return registeredPatientsList;
    //  }
}