import {FixedLeverageRatioStrategy} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"
import {DeployOpts} from "../types"

export async function deployFixedLeverageRatioStrategy(
  deployer: ContractDeployer,
  {config}: DeployOpts
): Promise<FixedLeverageRatioStrategy> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const contractName = "FixedLeverageRatioStrategy"

  assertIsString(gf_deployer)
  const strategy = await deployer.deploy<FixedLeverageRatioStrategy>(contractName, {
    from: gf_deployer,
  })
  await (await strategy.initialize(protocol_owner, config.address)).wait()
  return strategy
}
