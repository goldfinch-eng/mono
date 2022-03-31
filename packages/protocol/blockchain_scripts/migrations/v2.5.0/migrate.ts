import {bigVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {BackerRewards, GFI, UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import BigNumber from "bignumber.js"
import hre from "hardhat"
import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export type Migration250Params = {
  BackerRewards: {
    totalRewards: string
    maxInterestDollarsEligible: string
  }
  UniqueIdentity: {
    supportedUidTypes: number[]
  }
}

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)

  const deployEffects = await getDeployEffects({
    title: "v2.5.0 upgrade",
    description: `
    Upgrades Go and CommunityRewards contracts

    https://github.com/warbler-labs/mono/pull/390
    https://github.com/warbler-labs/mono/pull/412
    `,
  })

  console.log("Beginning v2.5.0 upgrade")
  const gfi = await getEthersContract<GFI>("GFI")
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
  const uniqueIdentity = await getEthersContract<UniqueIdentity>("UniqueIdentity")

  // 1. Upgrade other contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Go", "CommunityRewards"],
  })

  // 2. Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  const params: Migration250Params = {
    BackerRewards: {
      totalRewards: new BigNumber((await gfi.totalSupply()).toString()).multipliedBy("0.02").toFixed(),
      maxInterestDollarsEligible: bigVal(100_000_000).toString(),
    },
    UniqueIdentity: {
      supportedUidTypes: [0, 1, 2, 3, 4],
    },
  }

  console.log("Setting UniqueIdentity params:")
  console.log(` setSupportedUIDTypes = ${params.UniqueIdentity.supportedUidTypes}`)
  console.log("BackerRewards params")
  console.log(`  setTotalRewards = ${params.BackerRewards.totalRewards}`)
  console.log(`  maxInterestDollarsElligible = ${params.BackerRewards.maxInterestDollarsEligible}`)

  // 6. Add effects to deploy effects
  deployEffects.add({
    deferred: [
      // intialize backer rewards parameters
      await backerRewards.populateTransaction.setTotalRewards(params.BackerRewards.totalRewards),
      await backerRewards.populateTransaction.setMaxInterestDollarsEligible(
        params.BackerRewards.maxInterestDollarsEligible
      ),

      // update supported UID types
      await uniqueIdentity.populateTransaction.setSupportedUIDTypes(params.UniqueIdentity.supportedUidTypes, [
        true,
        true,
        true,
        true,
        true,
      ]),
    ],
  })

  await deployEffects.executeDeferred()
  console.log("finished v2.5.0 deploy")
  return {
    upgradedContracts,
    params,
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
