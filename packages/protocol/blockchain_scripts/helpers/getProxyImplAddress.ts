import {ethers} from "hardhat"
import {Contract} from "ethers"

export async function getProxyImplAddress(proxyContract: Contract) {
  if (!proxyContract) {
    return null
  }
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  const currentImpl = await ethers.provider.getStorageAt(proxyContract.address, implStorageLocation)
  return ethers.utils.hexStripZeros(currentImpl)
}
