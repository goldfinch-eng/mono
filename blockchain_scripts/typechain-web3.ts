import {runTypeChain, glob} from "typechain"
import hre from "hardhat"

async function main() {
  const cwd = process.cwd()
  // find all files matching the glob
  const allFiles = glob(cwd, [`${hre.config.paths.artifacts}/!(build-info)/**/+([a-zA-Z0-9_]).json`])

  const result = await runTypeChain({
    cwd,
    filesToProcess: allFiles,
    allFiles,
    outDir: "client/src/typechain/web3",
    target: "web3-v1",
  })
}

main().catch(console.error)
