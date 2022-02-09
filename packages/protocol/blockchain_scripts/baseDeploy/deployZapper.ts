import {GoldfinchConfig, Zapper} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

const logger = console.log

export async function deployZapper(
  deployer: ContractDeployer,
  {config, deployEffects}: {config: GoldfinchConfig; deployEffects: DeployEffects}
): Promise<any> {
  logger("About to deploy Zapper...")
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const protocolOwner = await getProtocolOwner()
  const zapper = await deployer.deploy<Zapper>("Zapper", {
    from: gf_deployer,
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocolOwner, config.address],
        },
      },
    },
  })

  return zapper
}
