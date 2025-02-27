import {GoldfinchConfig} from "@goldfinch-eng/goldfinch-prime/typechain/ethers"

import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getAccounts, getProtocolOwner} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

export async function deployConfig(
  deployer: ContractDeployer,
  deployEffects: DeployEffects,
  protocolAdmin: string
): Promise<GoldfinchConfig> {
  const {gf_deployer} = await getAccounts()
  const protocolOwner = await getProtocolOwner()

  const config = await deployer.deploy<GoldfinchConfig>("GoldfinchConfig", {
    from: gf_deployer,
    proxy: {
      owner: protocolOwner,
      proxyContract: "EIP173Proxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [protocolOwner],
        },
      },
    },
  })
  await deployEffects.add({
    deferred: [await config.populateTransaction.setAddress(CONFIG_KEYS.ProtocolAdmin, protocolAdmin)],
  })
  return config
}
