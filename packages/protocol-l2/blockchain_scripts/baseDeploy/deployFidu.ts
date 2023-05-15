import {GoldfinchConfig, Fidu} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {getNamedAccounts} from "hardhat"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, updateConfig} from "../deployHelpers"

const logger = console.log

export async function deployFidu(deployer: ContractDeployer, config: GoldfinchConfig): Promise<Fidu> {
  logger("About to deploy Fidu...")
  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  const protocol_owner = await getProtocolOwner()
  const fidu = await deployer.deploy<Fidu>("Fidu", {
    from: gf_deployer,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "__initialize__",
          args: [protocol_owner, "Fidu", "FIDU", config.address],
        },
      },
    },
  })
  const fiduAddress = fidu.address

  await updateConfig(config, "address", CONFIG_KEYS.Fidu, fiduAddress, {logger})
  return fidu
}
