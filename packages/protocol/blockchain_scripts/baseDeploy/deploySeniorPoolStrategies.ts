import {FixedLeverageRatioStrategy, DynamicLeverageRatioStrategy} from "@goldfinch-eng/protocol/typechain/ethers"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"
import {deployDynamicLeverageRatioStrategy} from "./deployDynamicLeverageRatioStrategy"
import {deployFixedLeverageRatioStrategy} from "./deployFixedLeverageRatioStrategy"

const logger = console.log

export async function deploySeniorPoolStrategies(
  deployer: ContractDeployer,
  {config}: DeployOpts
): Promise<[FixedLeverageRatioStrategy, DynamicLeverageRatioStrategy]> {
  const fixedLeverageRatioStrategy = await deployFixedLeverageRatioStrategy(deployer, {config})
  const dynamicLeverageRatioStrategy = await deployDynamicLeverageRatioStrategy(deployer)

  // We initialize the config's SeniorPoolStrategy to use the fixed strategy, not the dynamic strategy.
  await updateConfig(config, "address", CONFIG_KEYS.SeniorPoolStrategy, fixedLeverageRatioStrategy.address, {logger})

  return [fixedLeverageRatioStrategy, dynamicLeverageRatioStrategy]
}
