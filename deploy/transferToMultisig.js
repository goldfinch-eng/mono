const BN = require('bn.js');
const {getDeployedContract, getMultisigAddress} = require("../blockchain_scripts/deployHelpers.js");

/*
This deployment deposits some funds to the pool, and creates an underwriter, and a credit line.
It is only really used for test purposes, and should never be used on Mainnet (which it automatically never does);
*/
let logger;
async function main({ getNamedAccounts, deployments, getChainId }) {
  const { getOrNull, log } = deployments;
  logger = log;
  const { protocol_owner, proxy_owner } = await getNamedAccounts();
  let chainID = await getChainId();
  const creditDesk = await getDeployedContract(deployments, "CreditDesk");

  await transferOwnershipOfCreditDeskToMultisig(creditDesk, chainID);
};

async function transferOwnershipOfCreditDeskToMultisig(creditDesk, chainID) {
  logger("Transferring CreditDesk ownership to multisig");
  const multiSigAddress = getMultisigAddress(chainID);
  if (!multiSigAddress) {
    logger("No multisig address found for this network id, ", chainID, "so not transferring");
    return;
  }
  logger("Multisig address found. Transferring ownership of the Credit Desk to address:", multiSigAddress);
  const txn = await creditDesk.transferOwnership(multiSigAddress);
  await txn.wait();
  const newOwner = await creditDesk.owner();
  if (newOwner != multiSigAddress) {
    throw new Error(`Expected new owner ${newOwner} to equal ${creditDeskAddress}`);
  }
  logger("Ownership successfully transferred to", newOwner);
}

module.exports = main;
module.exports.dependencies = ["setup_for_testing"];
module.exports.tags = ["transfer_to_multisig"];
