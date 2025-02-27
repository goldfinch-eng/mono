import {UniqueIdentity} from "@goldfinch-eng/goldfinch-prime/typechain/ethers"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers"
import {ethers} from "hardhat"

export const MINT_PAYMENT = ethers.utils.parseEther("0.00083")

export async function mintUid(
  uid: UniqueIdentity,
  recipient: SignerWithAddress,
  tokenId: number,
  signer: SignerWithAddress
): Promise<void> {
  // First set supported UID types
  await uid.connect(signer).setSupportedUIDTypes([tokenId], [true])

  // Create signature for minting
  const expiresAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
  const nonce = await uid.nonces(recipient.address)
  const chainId = (await ethers.provider.getNetwork()).chainId

  const messageHash = ethers.utils.solidityKeccak256(
    ["address", "uint256", "uint256", "address", "uint256", "uint256"],
    [recipient.address, tokenId, expiresAt, uid.address, nonce, chainId]
  )
  const messageHashBinary = ethers.utils.arrayify(messageHash)
  const signature = await signer.signMessage(messageHashBinary)

  // Mint UID
  await uid.connect(recipient).mint(tokenId, expiresAt, signature, {
    value: MINT_PAYMENT,
  })
}
