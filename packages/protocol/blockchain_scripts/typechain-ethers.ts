import {runTypeChain, glob} from "typechain"
import hre from "hardhat"

async function main() {
  const cwd = process.cwd()
  // find all files matching the glob
  const allFiles = glob(cwd, [`${hre.config.paths.artifacts}/!(build-info)/**/+([a-zA-Z0-9_]).json`])

  await runTypeChain({
    cwd,
    filesToProcess: allFiles,
    allFiles,
    outDir: "typechain/ethers",
    target: "ethers-v5",
  })
}

main().catch(console.error)
