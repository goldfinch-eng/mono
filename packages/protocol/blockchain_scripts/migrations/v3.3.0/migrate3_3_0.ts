import {Context, GoldfinchConfig, GoldfinchFactory} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import hre from "hardhat"
import {CONFIG_KEYS_BY_TYPE} from "../../configKeys"
import {
  ContractDeployer,
  ContractUpgrader,
  getEthersContract,
  getProtocolOwner,
  populateTxAndLog,
} from "../../deployHelpers"
import {MAINNET_WARBLER_LABS_MULTISIG} from "../../mainnetForkingHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  console.log(`Upgrading contracts`)
  const deployEffects = await getDeployEffects({
    title: "v3.3.0 Upgrade",
    description: "",
  })

  const protocolOwner = await getProtocolOwner()
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertNonNullable(gf_deployer)

  const gfConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  const gfFactory = await getEthersContract<GoldfinchFactory>("GoldfinchFactory")
  const context = await getEthersContract<Context>("Context", {path: "contracts/cake/Context.sol:Context"})
  const borrowerRole = await gfFactory.BORROWER_ROLE()

  const borrowerImpl = await deployer.deploy("Borrower", {
    from: gf_deployer,
  })
  await deployEffects.add({
    deferred: [
      await populateTxAndLog(
        gfConfig.populateTransaction.setBorrowerImplementation(borrowerImpl.address),
        `Populated tx to set CreditLine impl to ${borrowerImpl.address}`
      ),
    ],
  })

  // Deploy Callable Loan
  const callableLoan = await deployer.deploy("CallableLoan", {
    from: gf_deployer,
  })

  console.log("CallableLoan address: ", callableLoan.address)

  // Deploy the callable loan implementation repository and add it to the config
  const callableLoanImplRepo = await deployer.deploy("CallableLoanImplementationRepository", {
    from: gf_deployer,
    proxy: {
      owner: protocolOwner,
      execute: {
        init: {
          methodName: "initialize",
          args: [protocolOwner, callableLoan.address],
        },
      },
    },
  })

  await deployEffects.add({
    deferred: [
      await populateTxAndLog(
        gfConfig.populateTransaction.setAddress(
          CONFIG_KEYS_BY_TYPE.addresses.CallableLoanImplementationRepository,
          callableLoanImplRepo.address
        ),
        `Populated tx to set the CallableLoanImplementationRepository address to ${callableLoanImplRepo.address}`
      ),
      await populateTxAndLog(
        gfFactory.populateTransaction.grantRole(borrowerRole, MAINNET_WARBLER_LABS_MULTISIG),
        `Populated tx to grant '${MAINNET_WARBLER_LABS_MULTISIG}' the borrower role(${borrowerRole})`
      ),
    ],
  })
  const upgradedContracts = await upgrader.upgrade({
    contracts: [{name: "CapitalLedger", args: [context.address]}, "GoldfinchFactory"],
  })

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  await deployEffects.executeDeferred()

  console.log("Finished deploy 3.3.0")
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
