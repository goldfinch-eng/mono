import {changeImplementations, getDeployEffects} from "../deployEffects"
import {deploy} from "./deploy"
import {getTempMultisig} from "../../deployHelpers"

export async function main() {
  const tempMultisig = await getTempMultisig()
  const anonEffects = await getDeployEffects({via: tempMultisig})
  const effects = await getDeployEffects()
  const {deployedContracts, upgradedContracts} = await deploy(effects, anonEffects)
  await effects.add(await changeImplementations({contracts: upgradedContracts}))
  await anonEffects.executeDeferred()
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
