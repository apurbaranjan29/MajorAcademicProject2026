// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//This contract will manage patient registration,metadata management and consent control
contract PatientIdentityAndConsent{
    address public registryAdmin;
    mapping (address=>bool)public isRegisteredPatient;
    mapping (address=>string)public patientMetadata;//mappping patient address to IPFS string hash
    mapping(address=>mapping(address=>bool))public consents;
    //Nested mapping to track consents granted by patients 
    // First key: patient address, second key: delegate (doctor, lab, insurer, etc.)

    //Events for server listenning
    event PatientRegistered(address indexed patient ,address indexed registeredBy,string metadataHash);
    event MetadataUpdated(address indexed patient,string newMetadataHash);
    event consentGranted(address indexed patient,address indexed delegate);
    event consentRevoked(address indexed patient,address indexed delegate);
    
    //Modifiers 
    modifier onlyRegistryAdmin(){
        require(msg.sender==registryAdmin,"Only a RegistryAdmin can call this function");
        _;
    }
    modifier onlyPatient(){
        require(isRegisteredPatient[msg.sender],"Only a registered patient can call");
        _;
    }

    //set registryadmin address through constructor
    constructor(address _registryAdmin){
        require(_registryAdmin!=address(0),"Invalid Admin Address");
        registryAdmin=_registryAdmin;
    }
    
    //add a new patient
    function registerPatient(address patientAddress,string memory metadataHash)public onlyRegistryAdmin{
        require(patientAddress!=address(0),"Invalid Patient Address");
        require(!isRegisteredPatient[patientAddress],"Patient is already registered");
        isRegisteredPatient[patientAddress]=true;
        patientMetadata[patientAddress]=metadataHash;
        emit PatientRegistered(patientAddress, msg.sender, metadataHash);
    }

    //modify own metadata
    function updateMetadata(string memory newMetadataHash)public onlyPatient{
        patientMetadata[msg.sender]=newMetadataHash;
        emit MetadataUpdated(msg.sender, newMetadataHash);
    }

    //grant consent
    function grantConsent(address delegate)public onlyPatient{
        require(delegate!=address(0),"Invalid Delegate address");
        require(delegate!=msg.sender,"It's you");
        require(!consents[msg.sender][delegate],"Consent is already granted to this delegate");
        consents[msg.sender][delegate] = true; 
        emit consentGranted(msg.sender, delegate);
    }

    //revoke consent
    function revokeConsent(address delegate)public onlyPatient{
        require(delegate!=address(0),"Invalid Delegate address");
        require(consents[msg.sender][delegate],"Consent is already revoked to this delegate");
        consents[msg.sender][delegate] = false; 
        emit consentRevoked(msg.sender, delegate);
    }

}