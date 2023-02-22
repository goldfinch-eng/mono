import {GoldfinchFactory} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {getNamedAccounts} from "hardhat"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, isTestEnv, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployGoldfinchFactory(
  deployer: ContractDeployer,
  {config}: DeployOpts
): Promise<GoldfinchFactory> {
  logger("Deploying goldfinch factory")
  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})
  const protocol_owner = await getProtocolOwner()

  const goldfinchFactory = await deployer.deploy<GoldfinchFactory>("GoldfinchFactory", {
    from: gf_deployer,
    proxy: {
      owner: gf_deployer,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, config.address],
        },
      },
    },
    libraries: {
      ["Accountant"]: accountant.address,
    },
  })
  const goldfinchFactoryAddress = goldfinchFactory.address

  await updateConfig(config, "address", CONFIG_KEYS.GoldfinchFactory, goldfinchFactoryAddress, {logger})
  return goldfinchFactory
}
