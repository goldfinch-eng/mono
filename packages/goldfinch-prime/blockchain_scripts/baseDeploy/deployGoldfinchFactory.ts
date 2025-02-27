import {GoldfinchConfig, GoldfinchFactory} from "@goldfinch-eng/goldfinch-prime/typechain/ethers"

import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getAccounts, getProtocolOwner, updateConfig} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

export async function deployGoldfinchFactory(
  deployer: ContractDeployer,
  deployEffects: DeployEffects,
  config: GoldfinchConfig
): Promise<GoldfinchFactory> {
  console.log("Deploying goldfinch factory")
  const {gf_deployer} = await getAccounts()
  const protocol_owner = await getProtocolOwner()

  const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})

  const goldfinchFactory = await deployer.deploy<GoldfinchFactory>("GoldfinchFactory", {
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
    libraries: {
      ["Accountant"]: accountant.address,
    },
  })

  await updateConfig(config, deployEffects, "address", CONFIG_KEYS.GoldfinchFactory, goldfinchFactory.address)

  return goldfinchFactory
}
