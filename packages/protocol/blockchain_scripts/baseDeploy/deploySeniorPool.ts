import {SeniorPool} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS, CONFIG_KEYS_BY_TYPE} from "../configKeys"
import {MINTER_ROLE, ContractDeployer, isTestEnv, getProtocolOwner, updateConfig} from "../deployHelpers"
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

  await config.setNumber(CONFIG_KEYS_BY_TYPE.numbers.SeniorPoolWithdrawalCancelationFeeInBps, 100)
  await seniorPool.initializeEpochs()

  await (await config.addToGoList(seniorPool.address)).wait()
  if (fidu) {
    logger(`Granting minter role to ${contractName}`)
    if (!(await fidu.hasRole(MINTER_ROLE, seniorPool.address))) {
      await fidu.grantRole(MINTER_ROLE, seniorPool.address)
    }
  }
  return seniorPool
}
