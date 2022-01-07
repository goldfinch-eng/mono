import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, assertIsChainId, isTestEnv, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployPoolTokens(deployer: ContractDeployer, {config}: DeployOpts) {
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const chainId = await deployer.getChainId()
  assertIsChainId(chainId)

  let contractName = "PoolTokens"

  if (isTestEnv()) {
    contractName = "TestPoolTokens"
  }

  logger("About to deploy Pool Tokens...")
  const poolTokens = await deployer.deploy(contractName, {
    from: gf_deployer,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "__initialize__",
          args: [protocol_owner, config.address],
        },
      },
    },
  })
  await updateConfig(config, "address", CONFIG_KEYS.PoolTokens, poolTokens.address, {logger})
  return poolTokens
}
