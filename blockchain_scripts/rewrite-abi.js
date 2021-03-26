const hre = require("hardhat")

let logger = console.log

async function main() {
  await rewriteABI(hre)
}

async function rewriteABI(hre) {
  let contractName = process.env.CONTRACT
  let artifactName = process.env.ARTIFACT || contractName
  logger(`Rewriting ABI for ${contractName} using ${artifactName}`)
  let deployment = await hre.deployments.get(contractName)
  let artifact = await hre.deployments.getArtifact(artifactName)
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

module.exports = {rewriteABI}
