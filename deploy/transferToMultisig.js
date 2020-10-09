const {getDeployedContract, getMultisigAddress} = require("../blockchain_scripts/deployHelpers.js")

/*
This simply transfers ownership to the multisig address, and should only be run for 
testnets or mainnet.
*/
let logger
async function main({deployments, getChainId}) {
  const {log} = deployments
  logger = log
  let chainID = await getChainId()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk")

  await transferOwnershipOfCreditDeskToMultisig(creditDesk, chainID)
}

async function transferOwnershipOfCreditDeskToMultisig(creditDesk, chainID) {
  logger("Transferring CreditDesk ownership to multisig")
  const multiSigAddress = getMultisigAddress(chainID)
  if (!multiSigAddress) {
    logger("No multisig address found for this network id, ", chainID, "so not transferring")
    return
  }
  logger("Multisig address found. Transferring ownership of the Credit Desk to address:", multiSigAddress)
  const txn = await creditDesk.transferOwnership(multiSigAddress)
  await txn.wait()
  const newOwner = await creditDesk.owner()
  if (newOwner != multiSigAddress) {
    throw new Error(`Expected new owner ${newOwner} to equal ${multiSigAddress}`)
  }
  logger("Ownership successfully transferred to", newOwner)
}

module.exports = main
module.exports.dependencies = ["setup_for_testing"]
module.exports.tags = ["transfer_to_multisig"]
