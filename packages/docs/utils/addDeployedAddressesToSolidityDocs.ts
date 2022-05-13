import fs from "fs"
import { lastIndexOf } from "lodash"
import every from "lodash/every"
import fromPairs from "lodash/fromPairs"
import _isPlainObject from "lodash/isPlainObject"

/**
 * Script that adds to each of our contract docs a link to the Etherscan page of the
 * deployment of the contract on mainnet.
 */

// Had difficulty getting ts-node to import our TS utils from the @goldfinch-eng/utils project,
// so for the sake of expediency, I have simply copied the relevant code here.
export type PlainObject = Record<string, unknown>
export function isPlainObject(obj: unknown): obj is PlainObject {
  return _isPlainObject(obj)
}
export function isNonEmptyString(obj: unknown): obj is string {
  return typeof obj === "string" && obj !== ""
}
export function assertNonNullable<T>(val: T | null | undefined, errorMessage?: string): asserts val is NonNullable<T> {
  if (val === null || val === undefined) {
    throw new Error(errorMessage || `Value ${val} is not non-nullable.`)
  }
}

type DeploymentsJson = {
  "1": {
    "mainnet": {
      contracts: {
        [contractName: string]: {
          address: string
        }
      }
    }
  }
}
const isDeploymentsJson = (json: unknown): json is DeploymentsJson => {
  return isPlainObject(json) && isPlainObject(json["1"]) && isPlainObject(json["1"].mainnet) && isPlainObject(json["1"].mainnet.contracts) && every(json["1"].mainnet.contracts, (val, key): boolean => isPlainObject(val) && isNonEmptyString(val.address))
}

const fileOptions: {encoding: BufferEncoding} = {encoding: "utf8"}
const pathToDeploymentsJson = "../protocol/deployments/all.json"
const deploymentsJson: unknown = JSON.parse(fs.readFileSync(pathToDeploymentsJson, fileOptions))

if (!isDeploymentsJson(deploymentsJson)) {
  throw new Error("Unexpected deployments json.")
}

const deploymentTextPrefix = "**Deployment on Ethereum mainnet: **"

const addressByContractName = fromPairs(Object.entries(deploymentsJson[1].mainnet.contracts).map((tuple) => [tuple[0], tuple[1].address]))

const contractDocRegexp = /^([A-Za-z0-9]+)\.md$/
const skipFileNames = ['_category_.json']

const contractDocsSubdirs = ["core", "periphery", "rewards", "deprecated"]
contractDocsSubdirs.forEach((subdir: string) => {
  const pathToSubdir = `./docs/reference/contracts/${subdir}`
  fs.readdir(pathToSubdir, function (err, fileNames) {
    fileNames.forEach(function (fileName) {
      if (skipFileNames.includes(fileName)) {
        return
      }

      const contractNameMatch = contractDocRegexp.exec(fileName)
      assertNonNullable(contractNameMatch, `Failed to match contract regexp for filename: ${fileName}`)
      const contractName = contractNameMatch[1]
      assertNonNullable(contractName, `Failed to identify contract name from filename: ${fileName}`)
      if (contractName in addressByContractName) {
        const address = addressByContractName[contractName]
        assertNonNullable(address, `Failed to identify address for contract: ${contractName}`)

        const pathToFile = `${pathToSubdir}/${fileName}`
        const content = fs.readFileSync(pathToFile, fileOptions).split(/[\n\r]/)

        const insertIndex = content.findIndex((line: string) => line.startsWith(deploymentTextPrefix) || line.startsWith("## "))
        if (insertIndex === -1) {
          throw new Error("Failed to identify insertion point.")
        } else {
          const insertionPoint = content[insertIndex]
          assertNonNullable(insertionPoint)
          const deploymentText = `${deploymentTextPrefix}https://etherscan.io/address/${address}`

          if (insertionPoint.startsWith(deploymentTextPrefix)) {
            content[insertIndex] = deploymentText
          } else {
            content.splice(insertIndex, 0, deploymentText, "")
          }
        }

        fs.writeFileSync(pathToFile, content.join("\n"), fileOptions)
      } else {
        console.warn(`Failed to identify deployed address of documented contract: ${contractName}`)
      }
    })
  })
})

// TODO[PR] For tranched pools, also add link to each deployed pool?
