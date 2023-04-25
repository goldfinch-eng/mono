import {bigVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {CallableLoanImplementationRepository, UcuProxy} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import hre from "hardhat"
import {ContractDeployer, getEthersContract, getProtocolOwner, populateTxAndLog} from "../../deployHelpers"
import {getDeployEffects} from "../deployEffects"
import {deployCallableLoanImplementation} from "../../baseDeploy/deployCallableLoanImplementation"
import {MAINNET_WARBLER_LABS_MULTISIG} from "../../mainnetForkingHelpers"
import {FAZZ_MAINNET_CALLABLE_LOAN} from "../../helpers/createCallableLoanForBorrower"

export const rewardsToRemoveFromStakingRewards = bigVal(1_200_000) // 1.2m GFI
export const maxInterestDollarsEllibile = bigVal(34_000_000) // 34m 1e18
export const rewardsMargin = bigVal(30_000) // 1 month of rewards

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const governanceDeployEffects = await getDeployEffects({
    title: "v3.3.2 Upgrade",
    description: "",
    via: await getProtocolOwner(),
  })
  const warblerDeployEffects = await getDeployEffects({
    title: "v3.3.2 Upgrade: Upgrade Fazz Pool",
    description: "",
    via: MAINNET_WARBLER_LABS_MULTISIG,
    safeConfig: {
      safeAddress: MAINNET_WARBLER_LABS_MULTISIG,
      executor: "0x80cf1aba501a52c7265d1dbb2b6c874498d34395",
    },
  })

  const {gf_deployer} = await deployer.getNamedAccounts()
  assertNonNullable(gf_deployer)

  const callableLoanImpl = await deployCallableLoanImplementation(deployer)

  const callableLoanImplementationRepository = await getEthersContract<CallableLoanImplementationRepository>(
    "CallableLoanImplementationRepository"
  )

  await governanceDeployEffects.add({
    deferred: [
      await populateTxAndLog(
        callableLoanImplementationRepository.populateTransaction["append(address)"](callableLoanImpl.address),
        `Appending callable loan implementation deployed at ${callableLoanImpl.address}`
      ),
    ],
  })

  const fazzPoolProxy = await getEthersContract<UcuProxy>("UcuProxy", {at: FAZZ_MAINNET_CALLABLE_LOAN})

  await warblerDeployEffects.add({
    deferred: [
      await populateTxAndLog(fazzPoolProxy.populateTransaction.upgradeImplementation(), `upgrading Fazz proxy`),
    ],
  })

  await governanceDeployEffects.executeDeferred()
  await warblerDeployEffects.executeDeferred()

  console.log("Finished deploy 3.3.2")
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
