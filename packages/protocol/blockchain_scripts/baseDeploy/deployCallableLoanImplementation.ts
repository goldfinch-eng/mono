import {CallableLoan} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {getNamedAccounts} from "hardhat"
import {ContractDeployer} from "../deployHelpers"

const logger = console.log

export async function deployCallableLoanImplementation(deployer: ContractDeployer): Promise<CallableLoan> {
  logger("About to deploy CallableLoanImplementationRepository...")
  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)

  // Deploy Callable Loan
  const callableLoan = (await deployer.deploy("CallableLoan", {
    from: gf_deployer,
  })) as CallableLoan

  console.log("CallableLoan address: ", callableLoan.address)

  return callableLoan
}
