import hre from "hardhat"
const {ethers, web3} = hre
const {keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack} = ethers.utils

async function getDomainSeparator(name, tokenAddress) {
  return keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        keccak256(toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes("1")),
        await hre.getChainId(),
        tokenAddress,
      ]
    )
  )
}

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
)

async function getApprovalDigest({token, owner, spender, value, nonce, deadline}) {
  value = ethers.BigNumber.from(value.toString())
  nonce = ethers.BigNumber.from(nonce.toString())
  deadline = ethers.BigNumber.from(deadline.toString())

  const name = await token.name()
  const DOMAIN_SEPARATOR = await getDomainSeparator(name, token.address.toLowerCase())
  return keccak256(
    solidityPack(
      ["bytes1", "bytes1", "bytes32", "bytes32"],
      [
        "0x19",
        "0x01",
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
            [PERMIT_TYPEHASH, owner, spender, value, nonce, deadline]
          )
        ),
      ]
    )
  )
}

async function getWallet(address: string) {
  // This mnemonic is hardcoded for all default unlocked hardhat accounts
  const mnemonic = "test test test test test test test test test test test junk"
  const allAccounts = (await web3.eth.getAccounts()).map((a) => a.toLowerCase())
  const idx = allAccounts.indexOf(address.toLowerCase())
  if (idx == -1) return
  return ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${idx}`)
}

export {getApprovalDigest, getWallet}
