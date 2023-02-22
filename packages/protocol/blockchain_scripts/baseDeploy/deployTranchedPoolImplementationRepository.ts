import {GoldfinchConfig, TranchedPoolImplementationRepository} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {ethers} from "hardhat"
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

  const tranchedPoolImpl = await deployTranchedPool(deployer)

  const contractName = "TranchedPoolImplementationRepository"
  logger(`About to deploy ${contractName}...`)

  // We have to pass in a pool impl to the repo constructor so it
  // can initialize the first lineage.
  const repository = (await deployer.deploy(contractName, {
    from: gf_deployer,
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocolOwner, tranchedPoolImpl],
        },
      },
    },
  })) as TranchedPoolImplementationRepository

  logger("Updating config...")
  await deployEffects.add({
    deferred: [
      await config.populateTransaction.setAddress(CONFIG_KEYS.TranchedPoolImplementationRepository, repository.address),
    ],
  })
  return repository
}
