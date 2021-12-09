import {Borrower} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployBorrower(deployer: ContractDeployer, {config}: DeployOpts): Promise<Borrower> {
  const contractName = "Borrower"
  const {gf_deployer} = await deployer.getNamedAccounts()

  assertIsString(gf_deployer)
  const borrower = await deployer.deploy<Borrower>(contractName, {
    from: gf_deployer,
  })
  await updateConfig(config, "address", CONFIG_KEYS.BorrowerImplementation, borrower.address, {logger})

  return borrower
}
