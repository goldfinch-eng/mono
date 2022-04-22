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

  // NOTE: THIS IS ONLY MEANT TO BE HERE BEFORE v2.6.0 HAS BEEN DEPLOYED
  // This is causing a failure because the above deploy will return
  // an already deployed and initialized contract if the current bytecode
  // matches whats been deployed. We are adding an exception here JUST
  // for the v2.6.0 migration so that tests past.
  if (strategy.address !== "0x71cfF40A44051C6e6311413A728EE7633dDC901a") {
    const receipt = await strategy.initialize(protocol_owner, config.address)
    await receipt.wait()
  }

  if (deployEffects !== undefined) {
    deployEffects.add({
      deferred: [await config.populateTransaction.setSeniorPoolStrategy(strategy.address)],
    })
  } else {
    await config.setSeniorPoolStrategy(strategy.address)
  }

  return strategy
}
