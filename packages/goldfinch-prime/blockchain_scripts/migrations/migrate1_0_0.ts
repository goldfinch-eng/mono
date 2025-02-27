import hre from "hardhat"

import {getBaseDeployWithDeployEffectsParams} from "../baseDeploy"

export async function main() {
  console.log("Starting deploy 1.0.0")

  const baseDeploy = getBaseDeployWithDeployEffectsParams({
    deployEffectsParams: {
      title: "v1.0.0 GPrime Deploy",
      description: "Deploy GPrime contract and related contracts",
    },
  })
  await baseDeploy(hre)

  console.log("Finished deploy 1.0.0")
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
