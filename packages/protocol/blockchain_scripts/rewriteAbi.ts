import hre from "hardhat"

const logger = console.log

async function main() {
  await rewriteABI(hre)
}

async function rewriteABI(hre) {
  const contractName = process.env.CONTRACT
  const artifactName = process.env.ARTIFACT || contractName
  logger(`Rewriting ABI for ${contractName} using ${artifactName}`)
  const deployment = await hre.deployments.get(contractName)
  const artifact = await hre.deployments.getArtifact(artifactName)
  deployment.abi = artifact.abi
  await hre.deployments.save(contractName, deployment)
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export {rewriteABI}
