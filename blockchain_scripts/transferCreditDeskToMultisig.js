// We require the Buidler Runtime Environment explicitly here. Technically not required.
// but useful context to understand where certain globals are coming from.
const bre = require("@nomiclabs/buidler");
const { ethers } = bre;
const fs = require('fs');
const { getMultisigAddress } = require('./deployHelpers.js');
/*
This is a simple script to transfer ownership of the credit desk to our multisig
It should only ever really be run once, and on certain networks, 
which is why I put it outside of the "deploy" scripts.
*/
async function main() {
  const network = bre.network.name;
  if (network === "buidlerevm") {
    throw new Error("Your on the local network. There is no multisig to transfer to for the local network")
  }
  
  const deployment = JSON.parse(fs.readFileSync(`./deployments/${network}/CreditDesk.json`));
  const creditDesk = await ethers.getContractAt(deployment.abi, deployment.receipt.contractAddress);
  const multiSigAddress = getMultisigAddress(network);

  const currentOwner = await creditDesk.owner();
  if (!multiSigAddress) {
    throw new Error(`No multisig address found for this network ${network}...`);
  }
  if (currentOwner === multiSigAddress) {
    throw new Error("Looks like Credit Desk already owned by the multisig");
  }
  console.log("Transferring ownership of the Credit Desk to the multisig address", multiSigAddress);
  const txn = await creditDesk.transferOwnership(multiSigAddress);
  await txn.wait();
  const newOwner = await creditDesk.owner();
  if (newOwner != multiSigAddress) {
    throw new Error(`Expected new owner ${newOwner} to equal ${creditDeskAddress}`);
  }
  console.log("Ownership successfully transferred to", newOwner);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });


  