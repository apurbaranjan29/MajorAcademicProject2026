// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  HealthcareAccessControl
 * @notice Central Role-Based Access Control for the SC-BHIoT system.
 *         Deploy this CONTRACT FIRST and pass its address to every other
 *         contract's constructor.
 *
 * @dev    Roles are defined as keccak256 hashes so they're cheap to store
 *         and compare on-chain.  The systemAdmin can grant / revoke any role.
 */
contract HealthcareAccessControl {

    // ─────────────────────────────────────────────────────────────
    // Role constants  (keccak256 of a human-readable label)
    // ─────────────────────────────────────────────────────────────
    bytes32 public constant DOCTOR_ROLE       = keccak256("DOCTOR_ROLE");
    bytes32 public constant PHARMACIST_ROLE   = keccak256("PHARMACIST_ROLE");
    bytes32 public constant INSURER_ROLE      = keccak256("INSURER_ROLE");
    bytes32 public constant RESEARCHER_ROLE   = keccak256("RESEARCHER_ROLE");
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE  = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant REGULATOR_ROLE    = keccak256("REGULATOR_ROLE");
    bytes32 public constant HOSPITAL_ROLE     = keccak256("HOSPITAL_ROLE");
    bytes32 public constant IOT_DEVICE_ROLE   = keccak256("IOT_DEVICE_ROLE");

    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────
    address public systemAdmin;
    // role => account => granted
    mapping(bytes32 => mapping(address => bool)) private _roles;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed grantedBy);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed revokedBy);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    // ─────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == systemAdmin, "AccessControl: caller is not admin");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    constructor(address _admin) {
        require(_admin != address(0), "Invalid admin address");
        systemAdmin = _admin;
    }

    // ─────────────────────────────────────────────────────────────
    // Admin functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Grant a role to an account (admin only)
    function grantRole(bytes32 role, address account) external onlyAdmin {
        require(account != address(0), "Invalid account address");
        require(!_roles[role][account], "Role already granted");
        _roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    /// @notice Revoke a role from an account (admin only)
    function revokeRole(bytes32 role, address account) external onlyAdmin {
        require(_roles[role][account], "Role not currently assigned");
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    /// @notice Transfer system admin to a new address
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        emit AdminTransferred(systemAdmin, newAdmin);
        systemAdmin = newAdmin;
    }

    // ─────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Check if an account holds a specific role
    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account];
    }

    /// @notice Returns the role label for DOCTOR (helper for frontend)
    function getDoctorRole()      external pure returns (bytes32) { return DOCTOR_ROLE; }
    function getPharmacistRole()  external pure returns (bytes32) { return PHARMACIST_ROLE; }
    function getInsurerRole()     external pure returns (bytes32) { return INSURER_ROLE; }
    function getManufacturerRole()external pure returns (bytes32) { return MANUFACTURER_ROLE; }
    function getDistributorRole() external pure returns (bytes32) { return DISTRIBUTOR_ROLE; }
    function getRegulatorRole()   external pure returns (bytes32) { return REGULATOR_ROLE; }
    function getIoTDeviceRole()   external pure returns (bytes32) { return IOT_DEVICE_ROLE; }
}
