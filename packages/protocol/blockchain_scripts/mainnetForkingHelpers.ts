import hre from "hardhat"
import {assertIsChainId, getERC20Address} from "../blockchain_scripts/deployHelpers"
const {ethers} = hre
export const MAINNET_GOVERNANCE_MULTISIG = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"
export const MAINNET_UNDERWRITER = "0x79ea65C834EC137170E1aA40A42b9C80df9c0Bb4"
export const MAINNET_WARBLER_LABS_MULTISIG = "0x229Db88850B319BD4cA751490F3176F511823372"
export const MAINNET_GF_DEPLOYER = "0xa083880F7a5df37Bf00a25380C3eB9AF9cD92D8f"
export const MAINNET_CREDIT_DESK = "0xD52dc1615c843c30F2e4668E101c0938e6007220"
export const MAINNET_TRUSTED_SIGNER_ADDRESS = "0x125cde169191c6c6c5e71c4a814bb7f7b8ee2e3f"

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
