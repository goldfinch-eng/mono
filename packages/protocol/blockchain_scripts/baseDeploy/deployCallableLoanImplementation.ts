import {CallableLoan} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {getNamedAccounts} from "hardhat"
import {ContractDeployer} from "../deployHelpers"

const logger = console.log

export async function deployCallableLoanImplementation(deployer: ContractDeployer): Promise<CallableLoan> {
  logger("About to deploy CallableLoan")
  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)

  // Deploy Callable Loan
  const callableLoan = (await deployer.deploy("CallableLoan", {
    from: gf_deployer,
    gasLimit: 7_000_000,
    maxFeePerGas: "85000000000",
    maxPriorityFeePerGas: "1500000000",
  })) as CallableLoan

  console.log("CallableLoan address: ", callableLoan.address)

  return callableLoan
}
