import {Zapper} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployZapper(deployer: ContractDeployer, {config}: DeployOpts): Promise<Zapper> {
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
