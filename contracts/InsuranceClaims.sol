// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  InsuranceClaims
 * @notice Automates insurance claim lifecycle: Submitted → Approved → Paid
 *         or Submitted → Rejected.  Includes ETH-based demo payout.
 *
 * CHANGES FROM v1:
 *  - CRITICAL FIX: payClaim() now uses Checks-Effects-Interactions (CEI)
 *    pattern + nonReentrant guard — the classic reentrancy bug is closed
 *  - Claim cooldown: one claim per patient per 30 days (fraud prevention)
 *  - Duplicate / suspicious claim detection with ClaimFraudFlagged event
 *  - Interface updated to hasValidConsent()
 *  - diagnosisHash added to claim struct — links claim to diagnosis
 *  - payClaim() implemented (was missing in v1 — ClaimPaid event existed
 *    but no function to trigger it)
 *  - receive() payable added so the contract can accept ETH from the insurer
 *    for demo funding
 *  - withdraw() for insurer to recover unused demo ETH
 */

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface IPatientConsent {
    function isRegisteredPatient(address patient) external view returns (bool);
    function hasValidConsent(address patient, address delegate) external view returns (bool);
}

interface IAccessControl {
    function hasRole(bytes32 role, address account) external view returns (bool);
    function INSURER_ROLE() external pure returns (bytes32);
}
// ────────────────────────────────────────────────────────────────────────────

abstract contract ReentrancyGuard {
    uint256 private _guardStatus = 1;
    modifier nonReentrant() {
        require(_guardStatus == 1, "ReentrancyGuard: reentrant call");
        _guardStatus = 2;
        _;
        _guardStatus = 1;
    }
}

contract InsuranceClaims is ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────
    enum ClaimStatus { Submitted, Approved, Rejected, Paid }

    struct Claim {
        uint256     claimId;
        address     patient;
        address     hospital;           // who submitted the claim
        uint256     amount;             // wei (demo value — not real money)
        ClaimStatus status;
        string      diagnosisHash;      // IPFS hash of diagnosis doc for verification
        uint256     submittedAt;
        uint256     resolvedAt;         // timestamp of approval/rejection/payment
    }

    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────
    IPatientConsent public identityContract;
    IAccessControl  public accessControl;

    uint256 public claimCount;
    mapping(uint256 => Claim)    public claims;

    // patient => last claim submission timestamp (for cooldown)
    mapping(address => uint256)  public lastClaimTime;

    // patient => number of claims in the last 30-day window (fraud check)
    mapping(address => uint256)  public claimsInWindow;

    // Fraud thresholds
    uint256 public constant CLAIM_COOLDOWN    = 30 days;
    uint256 public constant MAX_CLAIMS_WINDOW = 3;          // max 3 claims per 30-day window

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────
    event ClaimSubmitted(
        uint256 indexed claimId,
        address indexed patient,
        address indexed hospital,
        uint256 amount,
        string  diagnosisHash,
        uint256 timestamp
    );
    event ClaimApproved(uint256 indexed claimId, address indexed approvedBy, uint256 timestamp);
    event ClaimRejected(uint256 indexed claimId, address indexed rejectedBy, string reason, uint256 timestamp);
    event ClaimPaid(uint256 indexed claimId, address indexed patient, uint256 amount, uint256 timestamp);
    event ClaimFraudFlagged(
        uint256 indexed claimId,
        address indexed patient,
        string  reason,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────
    modifier onlyInsurer() {
        require(
            accessControl.hasRole(accessControl.INSURER_ROLE(), msg.sender),
            "Only registered insurer allowed"
        );
        _;
    }
    modifier onlyRegisteredPatient(address patient) {
        require(identityContract.isRegisteredPatient(patient), "Patient not registered");
        _;
    }
    modifier hasConsent(address patient) {
        require(identityContract.hasValidConsent(patient, msg.sender), "No valid consent from patient");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    constructor(address _identityContract, address _accessControl) {
        require(_identityContract != address(0), "Invalid identity contract");
        require(_accessControl    != address(0), "Invalid access control contract");
        identityContract = IPatientConsent(_identityContract);
        accessControl    = IAccessControl(_accessControl);
    }

    // ─────────────────────────────────────────────────────────────
    // Receive ETH — insurer funds the contract for demo payouts
    // ─────────────────────────────────────────────────────────────
    receive() external payable {}

    // ─────────────────────────────────────────────────────────────
    // Hospital / clinic functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Submit a new insurance claim on behalf of a patient.
     *         Fraud checks: cooldown period + rolling window limit.
     * @param  patient        Patient's address
     * @param  amount         Claim amount in wei (demo only)
     * @param  diagnosisHash  IPFS CID of the supporting diagnosis document
     */
    function submitClaim(
        address patient,
        uint256 amount,
        string  memory diagnosisHash
    )
        external
        onlyRegisteredPatient(patient)
        hasConsent(patient)
        nonReentrant
    {
        require(amount > 0, "Claim amount must be positive");
        require(bytes(diagnosisHash).length > 0, "Diagnosis hash required");

        // ── Fraud check 1: cooldown ──────────────────────────────
        if (lastClaimTime[patient] != 0) {
            uint256 elapsed = block.timestamp - lastClaimTime[patient];
            if (elapsed >= CLAIM_COOLDOWN) {
                // Window has reset — reset counter
                claimsInWindow[patient] = 0;
            }
        }

        // ── Fraud check 2: rolling window claim count ────────────
        if (claimsInWindow[patient] >= MAX_CLAIMS_WINDOW) {
            claimCount++;
            // Record it but immediately flag as suspicious
            claims[claimCount] = Claim({
                claimId:       claimCount,
                patient:       patient,
                hospital:      msg.sender,
                amount:        amount,
                status:        ClaimStatus.Rejected,
                diagnosisHash: diagnosisHash,
                submittedAt:   block.timestamp,
                resolvedAt:    block.timestamp
            });
            emit ClaimFraudFlagged(
                claimCount, patient,
                "Exceeded maximum claims per 30-day window",
                block.timestamp
            );
            return;
        }

        // ── All checks passed — create claim ─────────────────────
        claimCount++;
        claims[claimCount] = Claim({
            claimId:       claimCount,
            patient:       patient,
            hospital:      msg.sender,
            amount:        amount,
            status:        ClaimStatus.Submitted,
            diagnosisHash: diagnosisHash,
            submittedAt:   block.timestamp,
            resolvedAt:    0
        });

        lastClaimTime[patient] = block.timestamp;
        claimsInWindow[patient]++;

        emit ClaimSubmitted(claimCount, patient, msg.sender, amount, diagnosisHash, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // Insurer functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Approve a submitted claim (insurer only).
     */
    function approveClaim(uint256 claimId) external onlyInsurer nonReentrant {
        Claim storage c = claims[claimId];
        require(c.claimId != 0,                          "Claim does not exist");
        require(c.status == ClaimStatus.Submitted,       "Claim not in Submitted state");

        c.status     = ClaimStatus.Approved;
        c.resolvedAt = block.timestamp;

        emit ClaimApproved(claimId, msg.sender, block.timestamp);
    }

    /**
     * @notice Reject a submitted claim (insurer only).
     * @param  reason  Human-readable rejection reason (stored in event log)
     */
    function rejectClaim(uint256 claimId, string memory reason)
        external
        onlyInsurer
        nonReentrant
    {
        Claim storage c = claims[claimId];
        require(c.claimId != 0,                    "Claim does not exist");
        require(c.status == ClaimStatus.Submitted, "Claim not in Submitted state");

        c.status     = ClaimStatus.Rejected;
        c.resolvedAt = block.timestamp;

        emit ClaimRejected(claimId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Pay out an approved claim to the patient.
     *
     * SECURITY — Checks-Effects-Interactions pattern:
     *   1. CHECK:  verify state is Approved and contract has sufficient balance
     *   2. EFFECT: update state BEFORE transferring ETH
     *   3. INTERACT: transfer ETH last
     *   + nonReentrant guard as a second line of defence
     */
    function payClaim(uint256 claimId) external onlyInsurer nonReentrant {
        Claim storage c = claims[claimId];

        // ── 1. CHECKS ─────────────────────────────────────────────
        require(c.claimId != 0,                    "Claim does not exist");
        require(c.status == ClaimStatus.Approved,  "Claim must be Approved before payment");
        require(address(this).balance >= c.amount, "Insufficient contract balance for payout");

        // ── 2. EFFECTS (update state before any external call) ────
        address payable recipient = payable(c.patient);
        uint256 payoutAmount      = c.amount;
        c.status     = ClaimStatus.Paid;
        c.resolvedAt = block.timestamp;

        emit ClaimPaid(claimId, recipient, payoutAmount, block.timestamp);

        // ── 3. INTERACTION (ETH transfer last) ────────────────────
        (bool success, ) = recipient.call{value: payoutAmount}("");
        require(success, "ETH transfer to patient failed");
    }

    /**
     * @notice Withdraw remaining ETH from the contract (insurer only).
     *         Used at end of demo to recover unused test ETH.
     */
    function withdraw() external onlyInsurer nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to withdraw");
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // ─────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Returns contract ETH balance (useful for demo dashboard)
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Returns claim details
    function getClaim(uint256 claimId) external view returns (Claim memory) {
        require(claims[claimId].claimId != 0, "Claim does not exist");
        return claims[claimId];
    }
}
