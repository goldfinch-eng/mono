import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, isTestEnv, getProtocolOwner, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployPool(deployer: ContractDeployer, {config}: DeployOpts) {
  let contractName = "Pool"
  if (isTestEnv()) {
    contractName = "TestPool"
  }
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()

  assertIsString(gf_deployer)
  const pool = await deployer.deploy(contractName, {
    from: gf_deployer,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, config.address],
        },
      },
    },
  })
  await updateConfig(config, "address", CONFIG_KEYS.Pool, pool.address, {logger})

  return pool
}
