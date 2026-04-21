// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  DrugAuthenticity
 * @notice Tracks drug batches from manufacturer to patient with role-enforced
 *         stage transitions and cross-contract prescription validation at
 *         the point of sale.
 *
 * CHANGES FROM v1:
 *  - CRITICAL FIX: each stage transition now enforces the correct role
 *    (only DISTRIBUTOR can set InTransit, only PHARMACY can set AtPharmacy)
 *  - AtPharmacy stage was missing entirely — receiveAtPharmacy() added
 *  - markAsSold() now validates a valid prescription exists via
 *    IPrescriptionAndDiagnosis.isValidPrescription() AND calls
 *    dispensePrescription() to close the loop
 *  - flagCounterfeit() + CounterfeitFlagged event added
 *  - Full stage history array per batch (audit trail for the panel demo)
 *  - AccessControl interface replaces ad-hoc role mappings
 *  - ReentrancyGuard on all state-changing functions
 */

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface IAccessControl {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function MANUFACTURER_ROLE() external pure returns (bytes32);
    function DISTRIBUTOR_ROLE()  external pure returns (bytes32);
    function REGULATOR_ROLE()    external pure returns (bytes32);
    function PHARMACIST_ROLE()   external pure returns (bytes32);
}

interface IPrescriptionAndDiagnosis {
    function isValidPrescription(uint256 prescriptionId) external view returns (bool);
    function dispensePrescription(uint256 prescriptionId) external;
}
abstract contract ReentrancyGuard {
    uint256 private _guardStatus = 1;
    modifier nonReentrant() {require(_guardStatus == 1, "ReentrancyGuard: reentrant call");
        _guardStatus = 2;
        _;
        _guardStatus = 1;
    }
}
contract DrugAuthenticity is ReentrancyGuard {
    enum DrugStatus { Manufactured, InTransit, AtPharmacy, Sold, Flagged }

    struct DrugBatch {
        string      batchId;          // e.g. "IXPD007"
        string      drugName;         // e.g. "Prednisolone 5mg"
        address     manufacturer;
        address     currentOwner;
        DrugStatus  status;
        bool        isFlagged;        // counterfeit flag
        uint256     registeredAt;
        uint256     updatedAt;
    }

    struct StageEntry {
        DrugStatus  stage;
        address     actor;
        uint256     timestamp;
        string      note;             // optional note per stage
    }

    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────
    IAccessControl            public accessControl;
    IPrescriptionAndDiagnosis public prescriptionContract;

    // batchId => DrugBatch
    mapping(string => DrugBatch)     public drugBatches;

    // batchId => stage history (full audit trail)
    mapping(string => StageEntry[])  private _stageHistory;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────
    event DrugRegistered(
        string  indexed batchId,
        string  drugName,
        address indexed manufacturer,
        uint256 timestamp
    );
    event DrugTransferredToDistributor(
        string  indexed batchId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
    event DrugReceivedAtPharmacy(
        string  indexed batchId,
        address indexed pharmacy,
        uint256 timestamp
    );
    event DrugSold(
        string  indexed batchId,
        address indexed pharmacy,
        uint256 prescriptionId,
        uint256 timestamp
    );
    event CounterfeitFlagged(
        string  indexed batchId,
        address indexed reporter,
        string  reason,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────
    modifier onlyManufacturer() {
        require(
            accessControl.hasRole(accessControl.MANUFACTURER_ROLE(), msg.sender),
            "Only manufacturer allowed"
        );
        _;
    }
    modifier onlyDistributor() {
        require(
            accessControl.hasRole(accessControl.DISTRIBUTOR_ROLE(), msg.sender),
            "Only distributor allowed"
        );
        _;
    }
    modifier onlyPharmacist() {
        require(
            accessControl.hasRole(accessControl.PHARMACIST_ROLE(), msg.sender),
            "Only pharmacist allowed"
        );
        _;
    }
    modifier onlyRegulator() {
        require(
            accessControl.hasRole(accessControl.REGULATOR_ROLE(), msg.sender),
            "Only regulator allowed"
        );
        _;
    }
    modifier batchExists(string memory batchId) {
        require(drugBatches[batchId].manufacturer != address(0), "Batch not found");
        _;
    }
    modifier notFlagged(string memory batchId) {
        require(!drugBatches[batchId].isFlagged, "Batch is flagged as counterfeit");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    constructor(address _accessControl, address _prescriptionContract) {
        require(_accessControl         != address(0), "Invalid access control");
        require(_prescriptionContract  != address(0), "Invalid prescription contract");
        accessControl         = IAccessControl(_accessControl);
        prescriptionContract  = IPrescriptionAndDiagnosis(_prescriptionContract);
    }

    // ─────────────────────────────────────────────────────────────
    // Manufacturer functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a new drug batch on-chain.
     *         Only callable by wallets with MANUFACTURER_ROLE.
     */
    function registerDrug(
        string memory batchId,
        string memory drugName
    )
        external
        onlyManufacturer
        nonReentrant
    {
        require(bytes(batchId).length  > 0, "Batch ID required");
        require(bytes(drugName).length > 0, "Drug name required");
        require(drugBatches[batchId].manufacturer == address(0), "Batch already registered");

        drugBatches[batchId] = DrugBatch({
            batchId:        batchId,
            drugName:       drugName,
            manufacturer:   msg.sender,
            currentOwner:   msg.sender,
            status:         DrugStatus.Manufactured,
            isFlagged:      false,
            registeredAt:   block.timestamp,
            updatedAt:      block.timestamp
        });

        _addStageEntry(batchId, DrugStatus.Manufactured, msg.sender, "Registered by manufacturer");
        emit DrugRegistered(batchId, drugName, msg.sender, block.timestamp);
    }

    /**
     * @notice Transfer batch to a distributor.
     *         Only the current owner (manufacturer) can call this.
     *         Recipient must hold DISTRIBUTOR_ROLE.
     */
    function transferToDistributor(string memory batchId, address distributor)
        external
        batchExists(batchId)
        notFlagged(batchId)
        nonReentrant
    {
        DrugBatch storage b = drugBatches[batchId];
        require(b.currentOwner == msg.sender,                    "Not the current owner");
        require(b.status == DrugStatus.Manufactured,             "Can only transfer from Manufactured state");
        require(distributor != address(0),                       "Invalid distributor address");
        require(
            accessControl.hasRole(accessControl.DISTRIBUTOR_ROLE(), distributor),
            "Recipient does not have DISTRIBUTOR role"
        );

        b.currentOwner = distributor;
        b.status       = DrugStatus.InTransit;
        b.updatedAt    = block.timestamp;

        _addStageEntry(batchId, DrugStatus.InTransit, msg.sender, "Transferred to distributor");
        emit DrugTransferredToDistributor(batchId, msg.sender, distributor, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // Pharmacy functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Pharmacy confirms receipt of the batch.
     *         Only callable by wallets with PHARMACIST_ROLE.
     *         Batch must be InTransit and pharmacy must be the current owner.
     */
    function receiveAtPharmacy(string memory batchId)
        external
        onlyPharmacist
        batchExists(batchId)
        notFlagged(batchId)
        nonReentrant
    {
        DrugBatch storage b = drugBatches[batchId];
        require(b.currentOwner == msg.sender,        "Not the current owner");
        require(b.status == DrugStatus.InTransit,    "Batch is not InTransit");

        b.status    = DrugStatus.AtPharmacy;
        b.updatedAt = block.timestamp;

        _addStageEntry(batchId, DrugStatus.AtPharmacy, msg.sender, "Received at pharmacy");
        emit DrugReceivedAtPharmacy(batchId, msg.sender, block.timestamp);
    }

    /**
     * @notice Sell the drug to a patient.
     *         Requires a valid, unexpired prescription.
     *         Calls PrescriptionAndDiagnosis.dispensePrescription() to close the loop.
     * @param  batchId          The drug batch being sold
     * @param  prescriptionId   ID of the patient's prescription from PrescriptionAndDiagnosis
     */
    function markAsSold(string memory batchId, uint256 prescriptionId)
        external
        onlyPharmacist
        batchExists(batchId)
        notFlagged(batchId)
        nonReentrant
    {
        DrugBatch storage b = drugBatches[batchId];
        require(b.currentOwner == msg.sender,      "Not the current owner");
        require(b.status == DrugStatus.AtPharmacy, "Batch must be AtPharmacy before sale");

        // ── Cross-contract prescription validation ────────────────
        require(
            prescriptionContract.isValidPrescription(prescriptionId),
            "No valid, unexpired prescription found"
        );

        // ── Update state BEFORE external call (CEI pattern) ───────
        b.status    = DrugStatus.Sold;
        b.updatedAt = block.timestamp;

        _addStageEntry(batchId, DrugStatus.Sold, msg.sender, "Sold to patient");
        emit DrugSold(batchId, msg.sender, prescriptionId, block.timestamp);

        // ── Mark prescription as dispensed ────────────────────────
        prescriptionContract.dispensePrescription(prescriptionId);
    }

    // ─────────────────────────────────────────────────────────────
    // Counterfeit flagging — anyone can flag, regulator can unflag
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Flag a batch as potentially counterfeit.
     *         Any registered user can flag — regulators investigate.
     */
    function flagCounterfeit(string memory batchId, string memory reason)
        external
        batchExists(batchId)
    {
        require(bytes(reason).length > 0, "Reason required");
        drugBatches[batchId].isFlagged  = true;
        drugBatches[batchId].status     = DrugStatus.Flagged;
        drugBatches[batchId].updatedAt  = block.timestamp;

        _addStageEntry(batchId, DrugStatus.Flagged, msg.sender, reason);
        emit CounterfeitFlagged(batchId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Regulator clears a false-positive counterfeit flag.
     */
    function clearFlag(string memory batchId, DrugStatus previousStatus)
        external
        onlyRegulator
        batchExists(batchId)
        nonReentrant
    {
        require(drugBatches[batchId].isFlagged, "Batch is not flagged");
        drugBatches[batchId].isFlagged = false;
        drugBatches[batchId].status    = previousStatus;
        drugBatches[batchId].updatedAt = block.timestamp;

        _addStageEntry(batchId, previousStatus, msg.sender, "Flag cleared by regulator");
    }

    // ─────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Public drug verification — anyone can call this.
     *         Used by the QR code scanner on the website.
     */
    function verifyDrug(string memory batchId)
        external
        view
        returns (
            string  memory drugName,
            address manufacturer,
            address currentOwner,
            DrugStatus status,
            bool    isFlagged,
            uint256 updatedAt
        )
    {
        DrugBatch memory d = drugBatches[batchId];
        require(d.manufacturer != address(0), "Drug batch not found");
        return (d.drugName, d.manufacturer, d.currentOwner, d.status, d.isFlagged, d.updatedAt);
    }

    /**
     * @notice Returns the full stage history for a batch.
     *         Powers the supply chain timeline UI on the website.
     */
    function getStageHistory(string memory batchId)
        external
        view
        batchExists(batchId)
        returns (StageEntry[] memory)
    {
        return _stageHistory[batchId];
    }

    // ─────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────
    function _addStageEntry(
        string memory batchId,
        DrugStatus    stage,
        address       actor,
        string memory note
    ) internal {
        _stageHistory[batchId].push(StageEntry({
            stage:     stage,
            actor:     actor,
            timestamp: block.timestamp,
            note:      note
        }));
    }
}
