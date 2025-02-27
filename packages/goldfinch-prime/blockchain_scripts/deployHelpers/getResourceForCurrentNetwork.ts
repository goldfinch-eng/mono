import {getCurrentNetworkName} from "."
import {ApplicationResource, getResourceAddressForNetwork} from "./getResourceForNetwork"

// This is in a seperate file so that the version of this function that you can specify
// a network can be imported in situations where you don't want to import the hardhat runtime
// e.g. in the hardhat config

/// network is determined by the hardhat runtime environment
export function getResourceForCurrentNetwork(resourceName: ApplicationResource): string {
  return getResourceAddressForNetwork(resourceName, getCurrentNetworkName())
}
