import {Web3Provider} from "@ethersproject/providers"
import {readValidations} from "@openzeppelin/hardhat-upgrades/dist/utils/validations"
import {
  assertStorageUpgradeSafe,
  assertUpgradeSafe,
  getImplementationAddress,
  getStorageLayout,
  getStorageLayoutForAddress,
  getUnlinkedBytecode,
  getVersion,
  Manifest,
  withValidationDefaults,
} from "@openzeppelin/upgrades-core"
import {Address, Deployment} from "hardhat-deploy/dist/types"
import hre from "hardhat"

// openzeppelin doesn't export the type of these args, so we have to manually reconstruct
type ValidationErrors = Exclude<Parameters<typeof withValidationDefaults>[0]["unsafeAllow"], undefined>

// Checks the old implementation against the new implementation and
// ensures that it's valid.
export const openzeppelin_assertIsValidUpgrade = async (
  provider: Web3Provider,
  proxyAddress: Address,
  newImplementation: {bytecode?: string}
): Promise<undefined> => {
  const {version: newVersion, validations} = await getVersionAndValidations(newImplementation)

  const manifest = await Manifest.forNetwork(provider)
  const newStorageLayout = getStorageLayout(validations, newVersion)
  const oldStorageLayout = await getStorageLayoutForAddress(
    manifest,
    validations,
    await getImplementationAddress(provider, proxyAddress)
  )

  // This will throw an error if the upgrade is invalid.
  assertStorageUpgradeSafe(oldStorageLayout, newStorageLayout, withValidationDefaults({}))

  return
}

// Checks the contract is a valid implementation (e.g. no `constructor` etc.)
export const openzeppelin_assertIsValidImplementation = async (
  implementation: {
    bytecode?: string
  },
  options: {hasArgs: boolean}
): Promise<undefined> => {
  const requiredOpts = withValidationDefaults({
    unsafeAllow: [
      "delegatecall",
      "external-library-linking",
      // When using the Cake framework, contracts are constructed with an immutable reference to the
      // `Context` contract. This is safe for upgrading as it's included in the bytecode, but means
      // every upgrade we have to set it, which _appears_ as an unsafe upgrade.
      ...(options.hasArgs ? (["constructor", "state-variable-immutable"] as ValidationErrors) : []),
    ],
  })
  const {version, validations} = await getVersionAndValidations(implementation)

  // This will throw an error if the implementation is invalid.
  assertUpgradeSafe(validations, version, requiredOpts)

  return
}

// Appends the implementation to the implementation history of the proxy.
// Used for comparison against future implementations to ensure they are
// compatible with eachother in `openzeppelin_assertIsValidUpgrade()`.
export const openzeppelin_saveDeploymentManifest = async (
  provider: Web3Provider,
  proxy: Deployment,
  implementation: Deployment
): Promise<undefined> => {
  const {version, validations} = await getVersionAndValidations(implementation)

  const manifest = await Manifest.forNetwork(provider)
  await manifest.addProxy({
    address: proxy.address,
    txHash: proxy.transactionHash,
    kind: "transparent",
  })

  await manifest.lockedRun(async () => {
    const manifestData = await manifest.read()
    // Uncomment to debug issues with "Error saving manifest for <contract>: The requested contract was not found..."
    // The output of this console.log should be used to replace the corresponding entry in packages/protocol/cache/validations.json
    // console.log(version)
    const layout = getStorageLayout(validations, version)
    manifestData.impls[version.linkedWithoutMetadata] = {
      address: implementation.address,
      txHash: implementation.transactionHash,
      layout,
    }
    await manifest.write(manifestData)
  })

  return
}

const getVersionAndValidations = async (implementation: {bytecode?: string}) => {
  if (implementation.bytecode === undefined) throw Error("No bytecode for implementation")

  const validations = await readValidations(hre)
  const unlinkedBytecode = getUnlinkedBytecode(validations, implementation.bytecode)
  const version = getVersion(unlinkedBytecode, implementation.bytecode)

  return {
    version,
    validations,
  }
}
