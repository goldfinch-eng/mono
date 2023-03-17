import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {
  MAINNET_GOVERNANCE_MULTISIG,
  MAINNET_GF_DEPLOYER,
} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {ERC20Instance, GoInstance, GoldfinchConfigInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {createPoolWithCreditLine, getTruffleContractAtAddress} from "../testHelpers"

interface CreateTranchedPool {
  hre: HardhatRuntimeEnvironment
  borrowerAddress: string
  go: GoInstance
  goldfinchConfig: GoldfinchConfigInstance
  usdc: ERC20Instance
}
export async function createTranchedPool({hre, borrowerAddress, go, goldfinchConfig, usdc}: CreateTranchedPool) {
  const {tranchedPool} = await createPoolWithCreditLine({
    people: {owner: MAINNET_GOVERNANCE_MULTISIG, borrower: borrowerAddress},
    usdc,
  })
  await goldfinchConfig.addToGoList(tranchedPool.address)
  const legacyGoListAddress = await go.legacyGoList()
  const legacyGoList = await getTruffleContractAtAddress<GoldfinchConfigInstance>(
    "GoldfinchConfig",
    legacyGoListAddress
  )
  impersonateAccount(hre, MAINNET_GF_DEPLOYER)
  await legacyGoList.addToGoList(tranchedPool.address, {from: MAINNET_GF_DEPLOYER})
  return tranchedPool
}
