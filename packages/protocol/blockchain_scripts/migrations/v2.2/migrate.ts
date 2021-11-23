import {assertNonNullable} from "@goldfinch-eng/utils"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import {deploy} from "./deploy"
import path from "path"

export async function main(
  {
    vestingGrants,
    noVestingGrants,
  }: {
    vestingGrants: string
    noVestingGrants: string
  } = {
    vestingGrants: path.join(__dirname, "../../airdrop/community/grants.vesting.json"),
    noVestingGrants: path.join(__dirname, "../../airdrop/community/grants.no_vesting.json"),
  }
) {
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
