import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
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
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  console.log(`Upgrading contracts`)
  const deployer = new ContractDeployer(console.log, hre)
  const deployEffects = await getDeployEffects({
    title: "v3.3.0 Upgrade",
    description: "",
  })

  const protocolOwner = await getProtocolOwner()
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertNonNullable(gf_deployer)

  const gfConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

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

  // TODO: Determine if we want to do library linking.
  // // Deploy tranche logic
  // const trancheLogic = await deployer.deployLibrary("TrancheLogic", {
  //   from: gf_deployer,
  // })

  // // Deploy waterfall logic
  // const waterfallLogic = await deployer.deployLibrary("WaterfallLogic", {
  //   from: gf_deployer,
  //   libraries: {
  //     TrancheLogic: trancheLogic.address,
  //   },
  // })

  // // Deploy callable credit line logic
  // const checkpointedCallableCreditLineLogic = await deployer.deployLibrary("CheckpointedCallableCreditLineLogic", {
  //   from: gf_deployer,
  //   libraries: {
  //     TrancheLogic: trancheLogic.address,
  //     WaterfallLogic: waterfallLogic.address,
  //   },
  // })

  // // Deploy callable credit line logic
  // const callableCreditLineLogic = await deployer.deployLibrary("CallableCreditLineLogic", {
  //   from: gf_deployer,
  // })

  // const paymentScheduleLogic = await deployer.deployLibrary("PaymentScheduleLogic", {
  //   from: gf_deployer,
  // })

  // Deploy Callable Loan
  const callableLoan = await deployer.deploy("CallableLoan", {
    from: gf_deployer,
    // TODO: Determine if we want to do library linking.
    // libraries: {
    //   TrancheLogic: trancheLogic.address,
    //   WaterfallLogic: waterfallLogic.address,
    //   CallableCreditLineLogic: callableCreditLineLogic.address,
    //   CheckpointedCallableCreditLineLogic: checkpointedCallableCreditLineLogic.address,
    //   PaymentScheduleLogic: paymentScheduleLogic.address,
    //   InterestUtil: interestUtil.address,
    // },
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
    ],
  })

  // TODO: GoldfinchFactory upgrade is not required while migration 3.2.1 is being run before this one.
  // const upgrader = new ContractUpgrader(deployer)
  // const upgradedContracts = await upgrader.upgrade({contracts: ["GoldfinchFactory"]})

  // await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

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
