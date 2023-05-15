import {GoldfinchConfig, GFI} from "@goldfinch-eng/protocol/typechain/ethers"
import {GFIInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import {getNamedAccounts} from "hardhat"
import {Deployed} from "../baseDeploy"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, getTruffleContract, updateConfig} from "../deployHelpers"

const logger = console.log

export async function deployGFI(
  deployer: ContractDeployer,
  {config}: {config: GoldfinchConfig}
): Promise<Deployed<GFIInstance>> {
  const {gf_deployer} = await getNamedAccounts()
  const contractName = "GFI"
  logger("About to deploy GFI...")
  assertIsString(gf_deployer)
  const initialCap = "100000000000000000000000000"
  const protocol_owner = await getProtocolOwner()
  const gfi = await deployer.deploy<GFI>(contractName, {
    from: gf_deployer,
    gasLimit: 4000000,
    args: [
      protocol_owner, // owner
      "Goldfinch", // name
      "GFI", // symbol
      initialCap, //initialCap
    ],
  })
  const contract = await getTruffleContract<GFIInstance>(contractName, {at: gfi.address})

  const deployed: Deployed<GFIInstance> = {
    name: contractName,
    contract,
  }

  await updateConfig(config, "address", CONFIG_KEYS.GFI, gfi.address, {logger})

  return deployed
}
