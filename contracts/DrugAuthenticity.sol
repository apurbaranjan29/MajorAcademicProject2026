// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract DrugAuthenticity{
    address public regulator; // Government or authority

    // Roles
    mapping(address=>bool) public isManufacturer;
    mapping(address=>bool) public isDistributor;
    mapping(address=>bool) public isPharmacy;
    
    // Drug lifecycle
    enum DrugStatus {Manufactured,InTransit,AtPharmacy,Sold }

    struct DrugBatch {
        string batchId;//not always a number "IXPD007" like this
        string drugName;//Rx Prednisolone Dispersible tablet
        address manufacturer;//Macleods Pharmaceuticals
        address currentOwner;
        DrugStatus status;
        uint256 timestamp;
    }
    // batchId=>DrugBatch
    mapping(string=>DrugBatch) public drugBatches;
    
    //Events
    event ManufacturerAdded(address manufacturer);
    event DrugRegistered(string batchId,string drugName);
    event DrugTransferred(string batchId,address from,address to);
    event DrugSold(string batchId,address pharmacy);

    //Modifiers
    modifier onlyRegulator(){
        require(msg.sender==regulator,"Only regulator allowed");
        _;
    }
    modifier onlyManufacturer(){
        require(isManufacturer[msg.sender],"Only manufacturer allowed");
        _;
    }
    modifier onlyOwner(string memory batchId) {
        require(drugBatches[batchId].currentOwner==msg.sender,"Not current owner");
        _;
    }
    
    //Set Authority address like govt officials
    constructor(address _regulator){
        require(_regulator!=address(0),"Invalid regulator");
        regulator=_regulator;
    }

    //Role Management functions
    function addManufacturer(address manufacturer) external onlyRegulator{
        isManufacturer[manufacturer]=true;
        emit ManufacturerAdded(manufacturer);
    }
    function addDistributor(address distributor) external onlyRegulator{
        isDistributor[distributor]=true;
    }
    function addPharmacy(address pharmacy) external onlyRegulator{
        isPharmacy[pharmacy]=true;
    }

    //Register Drug
    function registerDrug(string memory batchId,string memory drugName) external onlyManufacturer{
       require(bytes(batchId).length>0,"Batch ID required");
       require(bytes(drugName).length>0,"Drug name required");
       require(drugBatches[batchId].manufacturer == address(0),"Drug already registered");
       drugBatches[batchId]=DrugBatch({
            batchId:batchId,
            drugName:drugName,
            manufacturer:msg.sender,
            currentOwner:msg.sender,
            status:DrugStatus.Manufactured,
            timestamp:block.timestamp
        });
        emit DrugRegistered(batchId,drugName);
    }


    //Trnasfer Drug 
    // In pharma supply chains, a batch moves like this:
    // Manufacturer -> Distributor -> Wholesaler -> Pharmacy -> Hospital
    // At each step:
    // Only one party holds the batch
    // Responsibility shifts
    // Accountability shifts
    // So currentOwner really means:
    // “Who is currently responsible for this batch?”  --GPT knowledge

    function transferDrug(string memory batchId,address to)external onlyOwner(batchId){
        require(to != address(0), "Invalid receiver");

        drugBatches[batchId].currentOwner=to;
        drugBatches[batchId].status=DrugStatus.InTransit;
        drugBatches[batchId].timestamp=block.timestamp;
        emit DrugTransferred(batchId,msg.sender,to);
    }

    //Mark as sold
    function markAsSold(string memory batchId)external onlyOwner(batchId){
        require(isPharmacy[msg.sender], "Only pharmacy can sell");
        drugBatches[batchId].status=DrugStatus.Sold;
        drugBatches[batchId].timestamp=block.timestamp;
        emit DrugSold(batchId,msg.sender);
    }

   //on chain drug verification
    function verifyDrug(string memory batchId)external view returns (
        string memory drugName,
        address manufacturer,
        address currentOwner,
        DrugStatus status
        ){
        DrugBatch memory d=drugBatches[batchId];
        require(d.manufacturer!=address(0),"Drug not found");
        return (
            d.drugName,
            d.manufacturer,
            d.currentOwner,
            d.status
        );
    }
}