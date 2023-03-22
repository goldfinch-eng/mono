import {GoldfinchConfig, Fidu} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {getNamedAccounts} from "hardhat"
import {CONFIG_KEYS_BY_TYPE} from "../configKeys"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"

const logger = console.log

export async function deployCallableLoanImplementationRepository(
  deployer: ContractDeployer,
  config: GoldfinchConfig
): Promise<Fidu> {
  logger("About to deploy Fidu...")
  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  const protocol_owner = await getProtocolOwner()

  // Deploy Callable Loan
  const callableLoan = await deployer.deploy("CallableLoan", {
    from: gf_deployer,
  })

  console.log("CallableLoan address: ", callableLoan.address)

  // Deploy the callable loan implementation repository and add it to the config
  const callableLoanImplRepo = await deployer.deploy("CallableLoanImplementationRepository", {
    from: gf_deployer,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocol_owner, callableLoan.address],
        },
      },
    },
  })

  await config.setAddress(
    CONFIG_KEYS_BY_TYPE.addresses.CallableLoanImplementationRepository,
    callableLoanImplRepo.address
  )

  return callableLoanImplRepo
}
