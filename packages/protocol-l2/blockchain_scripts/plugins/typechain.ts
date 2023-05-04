import {subtask} from "hardhat/config"
import {TASK_COMPILE_SOLIDITY_COMPILE_JOBS} from "hardhat/builtin-tasks/task-names"
import {runTypeChain, glob} from "typechain"
import {HardhatRuntimeEnvironment} from "hardhat/types"

async function generateAllTypes(hre: HardhatRuntimeEnvironment) {
  const cwd = process.cwd()
  // find all files matching the glob
  const allFiles = glob(cwd, [`${hre.config.paths.artifacts}/!(build-info)/**/+([a-zA-Z0-9_]).json`])

  const typechainConfigs = [
    {
      outDir: "typechain/web3",
      target: "web3-v1",
    },
    {
      outDir: "typechain/ethers",
      target: "ethers-v5",
    },
    {
      outDir: "typechain/truffle",
      target: "truffle-v5",
    },
  ]

  const results = await Promise.all(
    typechainConfigs.map(({outDir, target}) =>
      runTypeChain({
        cwd,
        filesToProcess: allFiles,
        allFiles,
        outDir,
        target,
      })
    )
  )

  const configAndResults = typechainConfigs.map((c, i) => ({...c, ...results[i]}))
  console.log("Generated typechain types:", configAndResults)
}

subtask(TASK_COMPILE_SOLIDITY_COMPILE_JOBS, "Compiles the entire project, building all artifacts").setAction(
  async (taskArgs, hre, runSuper) => {
    const compileSolOutput = await runSuper(taskArgs)
    await generateAllTypes(hre)
    return compileSolOutput
  }
)
