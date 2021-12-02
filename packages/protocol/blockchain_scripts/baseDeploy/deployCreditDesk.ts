import {assertIsString} from "@goldfinch-eng/utils"
import {getNamedAccounts} from "hardhat"
import {Contract} from "ethers"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner, isTestEnv, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployCreditDesk(deployer: ContractDeployer, {config}: DeployOpts): Promise<Contract> {
  const protocol_owner = await getProtocolOwner()
  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})

  let contractName = "CreditDesk"

  if (isTestEnv()) {
    contractName = "TestCreditDesk"
  }

  logger("Deploying CreditDesk")
  assertIsString(gf_deployer)
  const creditDesk = await deployer.deploy(contractName, {
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
    libraries: {["Accountant"]: accountant.address},
  })
  await updateConfig(config, "address", CONFIG_KEYS.CreditDesk, creditDesk.address, {logger})

  return creditDesk
}
