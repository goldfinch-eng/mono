import {DynamicLeverageRatioStrategy} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"

export async function deployDynamicLeverageRatioStrategy(
  deployer: ContractDeployer
): Promise<DynamicLeverageRatioStrategy> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const contractName = "DynamicLeverageRatioStrategy"

  assertIsString(gf_deployer)
  const strategy = await deployer.deploy<DynamicLeverageRatioStrategy>(contractName, {
    from: gf_deployer,
  })
  await (await strategy.initialize(protocol_owner)).wait()
  return strategy
}
