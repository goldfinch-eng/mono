import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"
import {deployTranchedPool} from "./deployTranchedPool"

export async function deployTranchedPoolImplementationRepository(
  deployer: ContractDeployer,
  {config, deployEffects}: {config: GoldfinchConfig; deployEffects: DeployEffects}
) {
  const logger = console.log
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const protocolOwner = await getProtocolOwner()

  const tranchedPoolImpl = await deployTranchedPool(deployer, {config, deployEffects})

  const contractName = "TranchedPoolImplementationRepository"
  logger(`About to deploy ${contractName}...`)

  const repository = await deployer.deploy(contractName, {
    from: gf_deployer,
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocolOwner, tranchedPoolImpl.address],
        },
      },
    },
  })

  logger("Updating config...")
  await deployEffects.add({
    deferred: [
      await config.populateTransaction.setAddress(CONFIG_KEYS.TranchedPoolImplementationRepository, repository.address),
    ],
  })
  return repository
}
