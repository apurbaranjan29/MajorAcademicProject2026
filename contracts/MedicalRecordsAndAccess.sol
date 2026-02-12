// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

interface PatientIdentityAndConsent{
    function isRegisteredPatient(address patient)external view returns(bool);
    function consents(address patient,address delegate)external view returns (bool);
}
contract MedicalRecordsAndAccess{
    PatientIdentityAndConsent public identityContract;

    struct MedicalRecord{
        address patient;
        address uploadedBy;//doctor or lab
        string ipfsHash;//encrypted medical record
        uint256 timestamp;
    }

    mapping(uint256=>MedicalRecord)public medicalRecords;//recordid to content

    uint256 public recordCount;//stores howmany records are there
    
    //Events
    event RecordAdded(uint256 indexed recordId,address indexed patient,address indexed uploadedBy,string ipfsHash);
    event RecordAccessed(uint256 indexed recordId,address indexed accessedBy,uint256 timestamp);

    //set interface address
    constructor(address _identityContract){
        require(_identityContract!=address(0),"Invalid identity contract");
        identityContract=PatientIdentityAndConsent( _identityContract);
    }

    //Modifiers
    modifier  onlyRegisteredPatient(address patient){
        //patient must be registered
        require(identityContract.isRegisteredPatient(patient),"Patient not registered");
        _;
    }
    modifier hasConsent(address patient){
        require(identityContract.consents(patient, msg.sender),"Consent not granted by patient");
        _;
    }

    //lets add medical record
    function addMedicalRecord(address patient,string memory ipfsHash) external onlyRegisteredPatient(patient) hasConsent(patient){
        require(bytes(ipfsHash).length>0,"IPFS Hash Required");
        recordCount++;
        //lets add to medical recoord array as MedicalRecord structure
        medicalRecords[recordCount]=MedicalRecord({
            patient:patient,
            uploadedBy:msg.sender,
            ipfsHash:ipfsHash,
            timestamp:block.timestamp
        });
        emit RecordAdded(recordCount, patient,msg.sender, ipfsHash);
    }

    //view medical record with consents
    function viewMedicalRecord(uint256 recordId) external hasConsent(medicalRecords[recordId].patient) returns (string memory){
        require (recordId>0 && recordId<=recordCount,"Invalid record ID");
        emit RecordAccessed(recordId, msg.sender, block.timestamp);
        return medicalRecords[recordId].ipfsHash;
    }

}  