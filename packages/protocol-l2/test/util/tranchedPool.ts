import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {
  MAINNET_GOVERNANCE_MULTISIG,
  MAINNET_GF_DEPLOYER,
} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {ERC20Instance, GoInstance, GoldfinchConfigInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {createPoolWithCreditLine, getTruffleContractAtAddress} from "../testHelpers"

export const EXISTING_POOL_TO_TOKEN = {
  "0x538473c3a69da2b305cf11a40cf2f3904de8db5f": "909", // Cauris #4
  "0x89d7c618a4eef3065da8ad684859a547548e6169": "719", // Addem
  "0x759f097f3153f5d62ff1c2d82ba78b6350f223e3": "653", // Alma #7
  "0xb26b42dd5771689d0a7faeea32825ff9710b9c11": "640", // Lend East
  "0xd09a57127bc40d680be7cb061c2a6629fe71abef": "588", // Cauris #2
  "0x00c27fc71b159a346e179b4a1608a0865e8a7470": "564", // Stratos
  "0x418749e294cabce5a714efccc22a8aade6f9db57": "471", // Alma 6
}

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
