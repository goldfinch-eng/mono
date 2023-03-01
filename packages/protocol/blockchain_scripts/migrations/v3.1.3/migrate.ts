import hre from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {Context} from "@goldfinch-eng/protocol/typechain/ethers"

export async function main() {
  console.log("Starting v3.1.3 deploy")

  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const deployEffects = await getDeployEffects({
    title: "v3.1.3 upgrade",
    description: "https://github.com/warbler-labs/mono/pull/1418",
  })

  // Get existing contracts
  const [context] = await Promise.all([
    getEthersContract<Context>("Context", {path: "contracts/cake/Context.sol:Context"}),
  ])

  const upgradedContracts = await upgrader.upgrade({
    contracts: [{name: "CapitalLedger", args: [context.address]}],
  })
  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  console.log("Going to execute deferred deploy effects...")
  await deployEffects.executeDeferred()
  console.log("Finished v3.1.3 deploy")
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
