// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface PatientIdentityAndConsent{
    function isRegisteredPatient(address patient)external view returns(bool);
    function consents(address patient,address delegate)external view returns (bool);
}

contract PrescriptionAndDiagnosis{
    PatientIdentityAndConsent public identityContract;

    struct Diagnosis {
        address patient;
        address doctor;
        string diagnosisDetails;   // e.g. "Diabetes,Cancer"
        uint256 timestamp;
    }

    struct Prescription {
        address patient;
        address doctor;
        string medicationDetails;  // e.g. "Metformin 500mg,Dolo 650mg"
        uint256 timestamp;
    }

    uint256 public diagnosisCount;
    uint256 public prescriptionCount;

    mapping(uint256=>Diagnosis) public diagnoses;
    mapping(uint256=>Prescription) public prescriptions;

    event DiagnosisAdded(uint256 indexed diagnosisId,address indexed patient,address indexed doctor);
    event PrescriptionAdded(uint256 indexed prescriptionId,address indexed patient,address indexed doctor);

    //set intterface address
    constructor(address _identityContract){
        require(_identityContract!=address(0),"Invalid identity contract");
        identityContract=PatientIdentityAndConsent(_identityContract);
    }

    //Modifiers
    modifier onlyRegisteredPatient(address patient){
        require(identityContract.isRegisteredPatient(patient),"Patient not registered");
        _;
    }
    modifier hasConsent(address patient){
        require(identityContract.consents(patient,msg.sender),"Doctor has no patient consent");
        _;
    }

    //Add Diagnosis
    function addDiagnosis(address patient,string memory diagnosisDetails)external onlyRegisteredPatient(patient) hasConsent(patient){
        require(bytes(diagnosisDetails).length>0,"Diagnosis required");
        diagnosisCount++;
        diagnoses[diagnosisCount]=Diagnosis({
            patient:patient,
            doctor:msg.sender,
            diagnosisDetails:diagnosisDetails,
            timestamp:block.timestamp
        });
        emit DiagnosisAdded(diagnosisCount,patient,msg.sender);
    }

    //Add prescription
     function addPrescription(address patient,string memory medicationDetails) external onlyRegisteredPatient(patient) hasConsent(patient){
        require(bytes(medicationDetails).length>0,"Prescription required");
        prescriptionCount++;
        prescriptions[prescriptionCount]=Prescription({
            patient:patient,
            doctor:msg.sender,
            medicationDetails:medicationDetails,
            timestamp:block.timestamp
        });
        emit PrescriptionAdded(prescriptionCount,patient,msg.sender);
    }
}