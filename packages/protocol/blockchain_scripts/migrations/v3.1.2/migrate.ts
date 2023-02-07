import hre from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract, populateTxAndLog} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {PopulatedTransaction} from "ethers/lib/ethers"
import {
  Router,
  BackerRewards,
  Context,
  CapitalLedger,
  GoldfinchConfig,
  Go,
} from "@goldfinch-eng/protocol/typechain/ethers"
import {routingIdOf} from "../../deployHelpers/routingIdOf"

// Contracts that will be added to the router
// Only needs to be contracts that are new to the router. Upgraded contracts that the Router already
// knows about are not required as the Router already points to their proxy.
const ROUTER_CONTRACT_IDS = {
  BackerRewards: routingIdOf("BackerRewards"),
  Go: routingIdOf("Go"),
} as const

export async function main() {
  console.log("Starting v3.1.2 deploy")

  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const deployEffects = await getDeployEffects({
    title: "v3.1.2 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/1337",
  })

  // Get existing contracts
  const go = await getEthersContract<Go>("Go")
  const [router, backerRewards, context, capitalLedger, legacyGoListGoldfinchConfig] = await Promise.all([
    getEthersContract<Router>("Router"),
    getEthersContract<BackerRewards>("BackerRewards"),
    getEthersContract<Context>("Context", {path: "contracts/cake/Context.sol:Context"}),
    getEthersContract<CapitalLedger>("CapitalLedger"),
    getEthersContract<GoldfinchConfig>("GoldfinchConfig", {
      at: await go.legacyGoList(),
    }),
  ])

  // Upgrading Contracts
  //
  // For Harvesting
  // - MembershipOrchestrator: Adding harvest function
  // - StakingRewards: Returning amount of rewards collected on withdraw
  // - BackerRewards: Returning amount of rewards collected on withdraw
  const upgradedContracts = await upgrader.upgrade({
    contracts: [
      {name: "MembershipOrchestrator", args: [context.address]},
      {name: "CapitalLedger", args: [context.address]},
      "StakingRewards",
      "BackerRewards",
      "PoolTokens",
    ],
  })
  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  // Add BackerRewards to the router
  const routerMap: Record<keyof typeof ROUTER_CONTRACT_IDS, string> = {
    BackerRewards: backerRewards.address,
    Go: go.address,
  }

  // Add everything from routerMap to the router
  const routerMapTxs: PopulatedTransaction[] = await Promise.all(
    Object.keys(routerMap).map((key) =>
      populateTxAndLog(
        router.populateTransaction.setContract(ROUTER_CONTRACT_IDS[key], routerMap[key]),
        `Populated tx to set ${key} (${ROUTER_CONTRACT_IDS[key]}) to ${routerMap[key]}!`
      )
    )
  )

  const deferredDeployEffects: PopulatedTransaction[] = [
    // Allow the capital ledger to interact with pool tokens.
    await populateTxAndLog(
      legacyGoListGoldfinchConfig.populateTransaction.addToGoList(capitalLedger.address),
      "Populated tx to add CapitalLedger to GoList"
    ),
  ]

  await deployEffects.add({
    deferred: routerMapTxs.concat(deferredDeployEffects),
  })

  console.log("Going to execute deferred deploy effects...")
  await deployEffects.executeDeferred()
  console.log("Finished v3.1.2 deploy")
  return {}
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
