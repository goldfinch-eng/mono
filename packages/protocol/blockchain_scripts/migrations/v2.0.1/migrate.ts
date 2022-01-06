import {getDeployEffects} from "../deployEffects"
import {deploy} from "./deploy"

export async function main() {
  const effects = await getDeployEffects()
  const {deployedContracts} = await deploy(effects)
  return {deployedContracts}
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
