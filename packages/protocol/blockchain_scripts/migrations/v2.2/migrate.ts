import {assertNonNullable} from "@goldfinch-eng/utils"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {deploy} from "./deploy"

export async function main({
  vestingGrants = process.env.VESTING_GRANTS_PATH,
  noVestingGrants = process.env.NO_VESTING_GRANTS_PATH,
}: {
  vestingGrants?: string
  noVestingGrants?: string
} = {}) {
  assertNonNullable(vestingGrants, "VESTING_GRANTS_PATH must be defined")
  assertNonNullable(noVestingGrants, "NO_VESTING_GRANTS_PATH must be defined")

  const effects = await getDeployEffects()
  const {deployedContracts, upgradedContracts} = await deploy(effects, {
    noVestingGrants,
    vestingGrants,
  })
  await effects.add(await changeImplementations({contracts: upgradedContracts}))
  await effects.executeDeferred()
  return {deployedContracts, upgradedContracts}
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
