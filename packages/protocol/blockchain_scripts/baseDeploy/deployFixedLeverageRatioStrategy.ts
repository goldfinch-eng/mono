import {FixedLeverageRatioStrategy} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"
import {DeployOpts} from "../types"

export async function deployFixedLeverageRatioStrategy(
  deployer: ContractDeployer,
  {config, deployEffects}: DeployOpts
): Promise<FixedLeverageRatioStrategy> {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  const contractName = "FixedLeverageRatioStrategy"

  assertIsString(gf_deployer)
  const strategy = await deployer.deploy<FixedLeverageRatioStrategy>(contractName, {
    from: gf_deployer,
  })

  const receipt = await strategy.initialize(protocol_owner, config.address)
  await receipt.wait()

  if (deployEffects !== undefined) {
    deployEffects.add({
      deferred: [await config.populateTransaction.setSeniorPoolStrategy(strategy.address)],
    })
  } else {
    await config.setSeniorPoolStrategy(strategy.address)
  }

  return strategy
}
