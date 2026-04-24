// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  IoTDataLogger
 * @notice Anchors batched H-IoT device readings on-chain as IPFS hashes and
 *         emits on-chain alerts when vital sign thresholds are crossed.
 *
 * This contract is the blockchain anchor for the H-IoT layer described in
 * the SC-BHIoT paper.  Raw vitals are NEVER stored on-chain; only the IPFS
 * CID of an encrypted vitals batch is stored.  Threshold events are fully
 * on-chain so the frontend can subscribe and show live alerts.
 *
 * NEW CONTRACT — does not exist in v1.
 *
 * Architecture:
 *  IoT Device (Python sim) → MQTT broker → Node.js backend
 *    → encrypt + upload to IPFS → get CID
 *    → call logVitalsBatch() on this contract
 *    → smart contract checks thresholds and emits AlertTriggered if needed
 *    → frontend WebSocket receives the event and shows the alert dashboard
 */

// ─── Interface ───────────────────────────────────────────────────────────────
interface IAccessControl {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function IOT_DEVICE_ROLE() external pure returns (bytes32);
    function REGULATOR_ROLE()  external pure returns (bytes32);
}
// ─────────────────────────────────────────────────────────────────────────────

abstract contract ReentrancyGuard {
    uint256 private _guardStatus = 1;
    modifier nonReentrant() {
        require(_guardStatus == 1, "ReentrancyGuard: reentrant call");
        _guardStatus = 2;
        _;
        _guardStatus = 1;
    }
}

contract IoTDataLogger is ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────
    // Vital sign threshold constants
    // These match the H-IoT alert thresholds from the paper.
    // ─────────────────────────────────────────────────────────────
    uint256 public constant HR_HIGH    = 100;   // bpm  — tachycardia
    uint256 public constant HR_LOW     = 50;    // bpm  — bradycardia
    uint256 public constant SPO2_LOW   = 94;    // %    — hypoxia
    uint256 public constant BP_SYS_HIGH = 140;  // mmHg — hypertension
    uint256 public constant BP_DIA_HIGH = 90;   // mmHg — hypertension
    uint256 public constant GLUCOSE_HIGH = 180; // mg/dL — hyperglycaemia (post-meal)
    uint256 public constant GLUCOSE_LOW  = 70;  // mg/dL — hypoglycaemia

    // ─────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────

    struct VitalsLog {
        uint256 logId;
        address device;         // IoT device address
        address patient;        // patient being monitored
        string  ipfsHash;       // IPFS CID of encrypted vitals batch
        uint256 timestamp;
    }

    struct AlertRecord {
        uint256 alertId;
        address patient;
        string  alertType;      // "HR_HIGH" | "SPO2_LOW" | "BP_HIGH" | etc.
        uint256 value;          // the threshold-crossing value
        uint256 threshold;      // the threshold that was crossed
        string  severity;       // "WARNING" | "CRITICAL"
        uint256 timestamp;
    }

    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────
    IAccessControl public accessControl;

    uint256 public logCount;
    uint256 public alertCount;

    mapping(uint256 => VitalsLog)   public vitalsLogs;
    mapping(uint256 => AlertRecord) public alertRecords;

    // patient => list of their log IDs
    mapping(address => uint256[]) private _patientLogs;
    // patient => list of their alert IDs
    mapping(address => uint256[]) private _patientAlerts;

    // device address => bool (whitelist)
    mapping(address => bool) public isRegisteredDevice;
    // device address => associated patient
    mapping(address => address) public devicePatient;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────
    event DeviceRegistered(
        address indexed device,
        address indexed patient,
        uint256 timestamp
    );
    event DeviceDeregistered(
        address indexed device,
        uint256 timestamp
    );
    event VitalsLogged(
        uint256 indexed logId,
        address indexed device,
        address indexed patient,
        string  ipfsHash,
        uint256 timestamp
    );
    event AlertTriggered(
        uint256 indexed alertId,
        address indexed patient,
        string  alertType,
        uint256 value,
        uint256 threshold,
        string  severity,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────
    modifier onlyRegisteredDevice() {
        require(isRegisteredDevice[msg.sender], "Device not registered");
        _;
    }
    modifier onlyAdmin() {
        require(
            accessControl.hasRole(accessControl.REGULATOR_ROLE(), msg.sender),
            "Only admin/regulator can manage devices"
        );
        _;
    }

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    constructor(address _accessControl) {
        require(_accessControl != address(0), "Invalid access control address");
        accessControl = IAccessControl(_accessControl);
    }

    // ─────────────────────────────────────────────────────────────
    // Device management (admin only)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a new IoT device and associate it with a patient.
     *         The device address is the wallet used by the backend IoT bridge.
     */
    function registerDevice(address device, address patient) external onlyAdmin nonReentrant {
        require(device  != address(0), "Invalid device address");
        require(patient != address(0), "Invalid patient address");
        require(!isRegisteredDevice[device], "Device already registered");

        isRegisteredDevice[device] = true;
        devicePatient[device]      = patient;

        emit DeviceRegistered(device, patient, block.timestamp);
    }

    /// @notice Remove a device from the whitelist (lost / replaced / retired)
    function deregisterDevice(address device) external onlyAdmin nonReentrant {
        require(isRegisteredDevice[device], "Device not registered");
        isRegisteredDevice[device] = false;
        emit DeviceDeregistered(device, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // Vitals logging (called by the Node.js backend after IPFS upload)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Log a batch of vitals readings anchored by their IPFS hash.
     *         Called by the Node.js IoT ingestion service after encrypting
     *         and uploading the readings to IPFS.
     * @param  ipfsHash   IPFS CID of the encrypted vitals JSON batch
     */
    function logVitalsBatch(string memory ipfsHash)
        external
        onlyRegisteredDevice
        nonReentrant
    {
        require(bytes(ipfsHash).length > 0, "IPFS hash required");

        address patient = devicePatient[msg.sender];
        logCount++;

        vitalsLogs[logCount] = VitalsLog({
            logId:     logCount,
            device:    msg.sender,
            patient:   patient,
            ipfsHash:  ipfsHash,
            timestamp: block.timestamp
        });

        _patientLogs[patient].push(logCount);
        emit VitalsLogged(logCount, msg.sender, patient, ipfsHash, block.timestamp);
    }

    /**
     * @notice Trigger a threshold alert.
     *         Called by the Node.js backend when it detects a threshold
     *         crossing in the raw sensor data BEFORE uploading to IPFS.
     *         The alert is stored on-chain for an immutable audit record.
     *
     * @param  patient    Patient being monitored
     * @param  alertType  String label: "HR_HIGH", "HR_LOW", "SPO2_LOW", etc.
     * @param  value      The actual sensor reading that triggered the alert
     * @param  threshold  The threshold constant that was crossed
     * @param  severity   "WARNING" or "CRITICAL"
     */
    function triggerAlert(
        address patient,
        string  memory alertType,
        uint256 value,
        uint256 threshold,
        string  memory severity
    )
        external
        onlyRegisteredDevice
        nonReentrant
    {
        require(patient    != address(0),   "Invalid patient address");
        require(bytes(alertType).length > 0, "Alert type required");
        require(bytes(severity).length  > 0, "Severity required");
        require(
            devicePatient[msg.sender] == patient,
            "Device not associated with this patient"
        );

        alertCount++;
        alertRecords[alertCount] = AlertRecord({
            alertId:   alertCount,
            patient:   patient,
            alertType: alertType,
            value:     value,
            threshold: threshold,
            severity:  severity,
            timestamp: block.timestamp
        });

        _patientAlerts[patient].push(alertCount);
        emit AlertTriggered(alertCount, patient, alertType, value, threshold, severity, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // Convenience: backend can call this to check thresholds on-chain
    // instead of implementing logic client-side
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Returns whether a heart rate reading crosses any threshold.
     *         The backend can call this as a view before deciding to triggerAlert.
     */
    function checkHeartRate(uint256 bpm)
        external
        pure
        returns (bool exceeded, string memory alertType, string memory severity)
    {
        if (bpm > HR_HIGH)  return (true, "HR_HIGH", "WARNING");
        if (bpm < HR_LOW)   return (true, "HR_LOW",  "CRITICAL");
        return (false, "", "");
    }

    function checkSpO2(uint256 pct)
        external
        pure
        returns (bool exceeded, string memory alertType, string memory severity)
    {
        if (pct < SPO2_LOW) return (true, "SPO2_LOW", "CRITICAL");
        return (false, "", "");
    }

    function checkGlucose(uint256 mgdl)
        external
        pure
        returns (bool exceeded, string memory alertType, string memory severity)
    {
        if (mgdl > GLUCOSE_HIGH) return (true, "GLUCOSE_HIGH", "WARNING");
        if (mgdl < GLUCOSE_LOW)  return (true, "GLUCOSE_LOW",  "CRITICAL");
        return (false, "", "");
    }

    // ─────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Returns all vitals log IDs for a patient
    function getLogsByPatient(address patient) external view returns (uint256[] memory) {
        return _patientLogs[patient];
    }

    /// @notice Returns all alert IDs for a patient
    function getAlertsByPatient(address patient) external view returns (uint256[] memory) {
        return _patientAlerts[patient];
    }

    /// @notice Returns the latest log for a patient (most recent vitals)
    function getLatestLog(address patient) external view returns (VitalsLog memory) {
        uint256[] memory ids = _patientLogs[patient];
        require(ids.length > 0, "No vitals logged for this patient");
        return vitalsLogs[ids[ids.length - 1]];
    }

    /// @notice Returns threshold constants as a struct for frontend display
    function getThresholds() external pure returns (
        uint256 hrHigh, uint256 hrLow, uint256 spo2Low,
        uint256 bpSysHigh, uint256 glucoseHigh, uint256 glucoseLow
    ) {
        return (HR_HIGH, HR_LOW, SPO2_LOW, BP_SYS_HIGH, GLUCOSE_HIGH, GLUCOSE_LOW);
    }
}
