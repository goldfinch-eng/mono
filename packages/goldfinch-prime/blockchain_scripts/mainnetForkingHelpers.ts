import hre from "hardhat"

import {assertIsChainId, getERC20Address} from "./deployHelpers"
import {TEST_MNEMONIC_ACCOUNTS} from "../config/testMnemonic"
const {ethers} = hre

// TODO: Replace for L2 mainnet
export const MAINNET_GOVERNANCE_MULTISIG = TEST_MNEMONIC_ACCOUNTS[0]
export const MAINNET_WARBLER_LABS_MULTISIG = TEST_MNEMONIC_ACCOUNTS[1]
export const MAINNET_TRUSTED_SIGNER_ADDRESS = TEST_MNEMONIC_ACCOUNTS[2]
export const MAINNET_GF_DEPLOYER = TEST_MNEMONIC_ACCOUNTS[3]

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
  //   await web3.eth.getStorageAt("0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", 15)
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
