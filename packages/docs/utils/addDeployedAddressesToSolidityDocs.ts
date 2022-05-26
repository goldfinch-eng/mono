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
export function isNumber(obj: unknown): obj is number {
  return typeof obj === "number"
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

type MainnetTranchedPoolsJson = {
  [address: string]: {
    name: string
    launchTime: number
  }
}
const isMainnetTranchedPoolsJson = (json: unknown): json is MainnetTranchedPoolsJson => {
  return isPlainObject(json) && every(json, (val: unknown, key: unknown): boolean => {
    return isNonEmptyString(key) && isPlainObject(val) && isNonEmptyString(val.name) && isNumber(val.launchTime)
  })
}

const fileOptions: {encoding: BufferEncoding} = {encoding: "utf8"}
const pathToDeploymentsJson = "../protocol/deployments/all.json"
const deploymentsJson: unknown = JSON.parse(fs.readFileSync(pathToDeploymentsJson, fileOptions))

if (!isDeploymentsJson(deploymentsJson)) {
  throw new Error("Unexpected deployments json.")
}

const pathToMainnetTranchedPoolsJson = "../client/config/pool-metadata/mainnet.json"
const mainnetTranchedPoolsJson = JSON.parse(fs.readFileSync(pathToMainnetTranchedPoolsJson, fileOptions))

if (!isMainnetTranchedPoolsJson(mainnetTranchedPoolsJson)) {
  throw new Error("Unexpected mainnet tranched pools json.")
}

const deploymentTextPrefix = "**Deployment on Ethereum mainnet: **"
const tranchedPoolsDeploymentTextPrefix = "**Borrower Pool deployments on Ethereum mainnet: **"

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

        const headingIndex = content.findIndex((line: string) => line.startsWith(`## ${contractName}`))
        if (headingIndex === -1) {
          throw new Error("Failed to identify insertion point.")
        } else {
          content.splice(headingIndex + 2, 0, deploymentTextPrefix, "", `https://etherscan.io/address/${address}`, "")
        }

        if (contractName === "TranchedPool") {
          const tranchedPoolAddresses = Object.keys(mainnetTranchedPoolsJson)
          const tranchedPoolsInfo = tranchedPoolAddresses.map((address: string) => {
            const info = mainnetTranchedPoolsJson[address]
            assertNonNullable(info)
            return {...info, address}
          }).sort(
            (a, b) => b.launchTime - a.launchTime // reverse-chronological order
          )
          const tranchedPoolsText = tranchedPoolsInfo.map((info) => `- [${info.name}](https://etherscan.io/address/${info.address})`)

          content.splice(headingIndex + 6, 0, tranchedPoolsDeploymentTextPrefix, "", ...tranchedPoolsText, "")
        }

        fs.writeFileSync(pathToFile, content.join("\n"), fileOptions)
      } else {
        console.warn(`Failed to identify deployed address of documented contract: ${contractName}`)
      }
    })
  })
})

// TODO[PR] For tranched pools, also add link to each deployed pool?
