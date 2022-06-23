import {
  MAINNET_CHAIN_ID,
  ChainId,
  CHAIN_NAME_BY_ID,
  getERC20Address,
  assertIsChainId,
} from "../blockchain_scripts/deployHelpers"
import _ from "lodash"
import hre from "hardhat"
const {ethers} = hre
const MAINNET_MULTISIG = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"
const MAINNET_UNDERWRITER = "0x79ea65C834EC137170E1aA40A42b9C80df9c0Bb4"

/**
 * Override the USDC DOMAIN_SEPARATOR to use the local chain ID of 31337. This makes permit work when
 * using mainnet forking.
 */
export async function overrideUsdcDomainSeparator() {
  const chainId = await hre.getChainId()
  assertIsChainId(chainId)
  const usdcAddress = getERC20Address("USDC", chainId)
  // DOMAIN_SEPARATOR storage slot is 15.
  // This can be confirmed by running the following:
  //
  //   await web3.eth.getStorageAt("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 15)
  //
  // And comparing with the output of calling usdc.DOMAIN_SEPARATOR()
  const DOMAIN_SEPARATOR_STORAGE_SLOT_INDEX = "0xf"
  const value = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        ethers.utils.keccak256(
          ethers.utils.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
        ),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("USD Coin")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("2")),
        chainId,
        usdcAddress,
      ]
    )
  )
  ethers.utils.solidityKeccak256([], [])
  await ethers.provider.send("hardhat_setStorageAt", [usdcAddress, DOMAIN_SEPARATOR_STORAGE_SLOT_INDEX, value])
  await ethers.provider.send("evm_mine", [])
}

export {MAINNET_MULTISIG, MAINNET_UNDERWRITER}
