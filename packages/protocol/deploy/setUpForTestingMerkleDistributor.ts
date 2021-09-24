import {assertIsString, assertNonNullable, findEnvLocal} from "@goldfinch-eng/utils"
import BN from "bn.js"
import dotenv from "dotenv"
import hre from "hardhat"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {assertIsChainId, isMainnetForking, LOCAL_CHAIN_ID, MAINNET_CHAIN_ID} from "../blockchain_scripts/deployHelpers"
import {fundWithWhales} from "../blockchain_scripts/mainnetForkingHelpers"
import {Logger} from "../blockchain_scripts/types"

const {ethers} = hre
dotenv.config({path: findEnvLocal()})

const AMOUNT = new BN("100")

/*
This deployment provides some ETH to accounts used in testing the MerkleDistributor contract.
It is only meant for test purposes and should never be used on Mainnet (which it automatically never does).
*/
let logger: Logger
async function main({getNamedAccounts, deployments, getChainId}: HardhatRuntimeEnvironment) {
  const {log} = deployments
  logger = log
  const {test_merkle_distributor_recipient_a, test_merkle_distributor_recipient_b} = await getNamedAccounts()
  assertIsString(test_merkle_distributor_recipient_a)
  assertIsString(test_merkle_distributor_recipient_b)

  const chainId = await getChainId()
  assertIsChainId(chainId)

  if (chainId === LOCAL_CHAIN_ID && !isMainnetForking()) {
    await fundFromLocalWhale(test_merkle_distributor_recipient_a, AMOUNT)
    await fundFromLocalWhale(test_merkle_distributor_recipient_b, AMOUNT)
  }

  if (isMainnetForking()) {
    logger("Funding MerkleDistributor recipients with whales.")
    await fundWithWhales(["ETH"], [test_merkle_distributor_recipient_a, test_merkle_distributor_recipient_b], AMOUNT)
    logger(`Finished funding with whales.`)
  }
}

async function fundFromLocalWhale(userToFund: string, amount: BN) {
  logger("Sending money to:", userToFund)
  const [protocol_owner] = await ethers.getSigners()
  assertNonNullable(protocol_owner)
  await protocol_owner.sendTransaction({
    to: userToFund,
    value: ethers.utils.parseEther(amount.toString()),
  })
}

module.exports = main
module.exports.tags = ["setup_for_testing_merkle_distributor"]
module.exports.skip = async ({getChainId}: HardhatRuntimeEnvironment) => {
  const chainId = await getChainId()
  return String(chainId) === MAINNET_CHAIN_ID
}
