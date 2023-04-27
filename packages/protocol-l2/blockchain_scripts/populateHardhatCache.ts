import fs from "fs"
import {assertNonNullable} from "@goldfinch-eng/utils"
import path from "path"
import {task} from "hardhat/config"
import {HardhatRuntimeEnvironment} from "hardhat/types"

import fetch from "node-fetch"

import {exec} from "child_process"
import util from "util"
const execPromise = util.promisify(exec)

export async function main({ciJobID, hre}: {ciJobID: string; hre: HardhatRuntimeEnvironment}) {
  assertNonNullable(process.env.CIRCLECI_API_KEY, "CIRCLECI_API_KEY envvar must be defined")
  const url = `https://circleci.com/api/v1.1/project/github/warbler-labs/mono/${ciJobID}/artifacts`
  const options = {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Circle-Token": process.env.CIRCLECI_API_KEY,
    },
  }
  const result = await (await fetch(url, options)).json()
  console.log(result)
  for (const artifact of result) {
    const options = {
      method: "GET",
      headers: {
        "Circle-Token": process.env.CIRCLECI_API_KEY,
      },
    }
    const result = await fetch(artifact.url, options)
    const packageRoot = path.join(__dirname, "../")
    const filePath = path.join(packageRoot, artifact.path)
    console.log(`Writing ${filePath}`)
    const fileStream = fs.createWriteStream(filePath)
    await new Promise((resolve, reject) => {
      result.body.pipe(fileStream)
      result.body.on("error", reject)
      fileStream.on("finish", resolve)
    })

    console.log(`Extracting ${filePath}`)
    await execPromise(`cd ${packageRoot} && tar -xvzf ${artifact.path}`)
    await fs.promises.unlink(filePath)
  }
}

task("populate-hardhat-cache", "Populate hardhat's forking cache with requests from a recent circleci job run.")
  .addPositionalParam("ciJobID", "The CI job ID to use to populate the request cache")
  .setAction(async ({ciJobID}, hre) => {
    await main({ciJobID, hre})
  })
