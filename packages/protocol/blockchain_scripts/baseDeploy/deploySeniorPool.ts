import {SeniorPool} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {grantMinterRoleToPool} from "../baseDeploy"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, isTestEnv, getProtocolOwner, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deploySeniorPool(deployer: ContractDeployer, {config, fidu}: DeployOpts): Promise<SeniorPool> {
  let contractName = "SeniorPool"
  if (isTestEnv()) {
    contractName = "TestSeniorPool"
  }
  const {gf_deployer} = await deployer.getNamedAccounts()
  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  assertIsString(gf_deployer)
  const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})
  const seniorPool = await deployer.deploy<SeniorPool>(contractName, {
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
    libraries: {["Accountant"]: accountant.address},
  })
  await updateConfig(config, "address", CONFIG_KEYS.SeniorPool, seniorPool.address, {logger})
  await (await config.addToGoList(seniorPool.address)).wait()
  if (fidu) {
    logger(`Granting minter role to ${contractName}`)
    await grantMinterRoleToPool(fidu, seniorPool)
  }
  return seniorPool
}
