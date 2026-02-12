// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface PatientIdentityAndConsent{
    function isRegisteredPatient(address patient)external view returns(bool);
    function consents(address patient,address delegate)external view returns (bool);
}

//this contract needs more strengthen business logic
//it will be too much complicated if i write down all & incorporated with it
//i'll further find a way to do this 

contract InsuranceClaims{
    PatientIdentityAndConsent public identityContract;

    address public insurer; // Insurance company address

    enum ClaimStatus { Submitted, Approved, Rejected, Paid } //ease access

    struct Claim {
        address patient;
        address hospital;
        uint256 amount;      // claim amount (demo value)
        ClaimStatus status;
        uint256 timestamp;
    }

    uint256 public claimCount;
    mapping(uint256 => Claim) public claims;

    //Events
    event ClaimSubmitted(uint256 indexed claimId,address indexed patient,address indexed hospital,uint256 amount);
    event ClaimApproved(uint256 indexed claimId);
    event ClaimRejected(uint256 indexed claimId);
    event ClaimPaid(uint256 indexed claimId, uint256 amount);

    //Modifiers
    modifier onlyInsurer(){
        require(msg.sender==insurer, "Only insurer allowed");
        _;
    }
    modifier onlyRegisteredPatient(address patient){
        require(identityContract.isRegisteredPatient(patient),"Patient not registered");
        _;
    }
    modifier hasConsent(address patient){
        require(identityContract.consents(patient,msg.sender),"No patient consent");
        _;
    }


    //Set insurer address and contract address
     constructor(address _identityContract,address _insurer) {
        require(_identityContract!=address(0),"Invalid identity contract");
        require(_insurer!=address(0),"Invalid insurer");
        identityContract=PatientIdentityAndConsent(_identityContract);
        insurer=_insurer;
    }

    //submit claim
    function submitClaim(address patient,uint256 amount) external onlyRegisteredPatient(patient) hasConsent(patient){
        require(amount > 0,"Invalid claim amount");
        claimCount++;
        claims[claimCount]=Claim({
            patient:patient,
            hospital:msg.sender,
            amount:amount,
            status:ClaimStatus.Submitted,
            timestamp:block.timestamp
        });
        emit ClaimSubmitted(claimCount,patient,msg.sender,amount);
    }

    //Approve claim   more business logic required 
    function approveClaim(uint256 claimId) external onlyInsurer{
        Claim storage c=claims[claimId];
        require(c.status==ClaimStatus.Submitted, "Invalid state");
        c.status=ClaimStatus.Approved;
        emit ClaimApproved(claimId);
    }

    function rejectClaim(uint256 claimId)external onlyInsurer{
        Claim storage c=claims[claimId];
        require(c.status==ClaimStatus.Submitted,"Invalid state");
        c.status=ClaimStatus.Rejected;
        emit ClaimRejected(claimId);
    }
}