import {keccak256} from "@ethersproject/keccak256"
import {pack} from "@ethersproject/solidity"
import {BigNumber} from "ethers"
import {arrayify} from "@ethersproject/bytes"

// This is the address of the Unique Identity Signer, a relayer on
// Defender. It has the SIGNER_ROLE on UniqueIdentity and therefore
// is able to authorize a burn.
export const UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS = "0x125cde169191c6c6c5e71c4a814bb7f7b8ee2e3f"

/**
 * @param fromAddress - The address of the msgSender for a mint/mintTo operation
 * @param toAddress - The address to mint the token to
 * @param tokenId - ID of the UID to be operated on
 * @param expiresAt - Timestamp for signature expiry
 * @param nonce  - The uint256 nonce associated with the approved msg.sender for UniqueIdentity actions
 * @param chainId - The ID of the chain the UID will be minted on
 * @description - Generates the arrayified hash of the parameters for a mint/mintTo signature - should be signed by an address with the UNIQUE_IDENTITY_SIGNER role to be valid
 * @returns {Uint8Array} - The arrayified hash of the signature input elements
 */
export const presignedMintToMessage = (
  fromAddress: string,
  toAddress: string,
  tokenId: BigNumber | number,
  expiresAt: BigNumber | number,
  uniqueIdentityAddress: string,
  nonce: BigNumber | number,
  chainId: number
): Uint8Array => {
  const extraTypes = ["address", "uint256", "uint256"]
  const extraValues = [toAddress, tokenId, expiresAt]
  return presignedUidMessage(fromAddress, extraTypes, extraValues, uniqueIdentityAddress, nonce, chainId)
}

/**
 * @param fromAddress - The address of the msgSender for a mint or the tokenHolder for a burn
 * @param tokenId - ID of the UID to be operated on
 * @param expiresAt - Timestamp for signature expiry
 * @param nonce  - The uint256 nonce associated with the approved msg.sender for the mint, or the token holder for a burn.
 * @param chainId - The ID of the chain the UID will be burned/minted on
 * @description - Generates the arrayified hash of the parameters for a mint/burn signature - should be signed by an address with the UNIQUE_IDENTITY_SIGNER role to be valid. Equivalent functionality to presignedBurnMessage.
 * @returns {Uint8Array} - The arrayified hash of the signature input elements
 */
export const presignedMintMessage = (
  fromAddress: string,
  tokenId: BigNumber | number,
  expiresAt: BigNumber | number,
  uniqueIdentityAddress: string,
  nonce: BigNumber | number,
  chainId: number
): Uint8Array => {
  const extraTypes = ["uint256", "uint256"]
  const extraValues = [tokenId, expiresAt]
  return presignedUidMessage(fromAddress, extraTypes, extraValues, uniqueIdentityAddress, nonce, chainId)
}

export const presignedBurnMessage = presignedMintMessage

const presignedUidMessage = (
  fromAddress: string,
  extraTypes: Array<string>,
  extraValues: Array<string | number | BigNumber>,
  uniqueIdentityAddress: string,
  nonce: BigNumber | number,
  chainId: number
): Uint8Array => {
  if (extraTypes.length !== extraValues.length) {
    throw new Error("Length of extraTypes and extraValues must match")
  }

  const types = ["address", ...extraTypes, "address", "uint256", "uint256"]
  const values = [fromAddress, ...extraValues, uniqueIdentityAddress, nonce, chainId]

  const encoded = pack(types, values)
  const hash = keccak256(encoded)
  // Cf. https://github.com/ethers-io/ethers.js/blob/ce8f1e4015c0f27bf178238770b1325136e3351a/docs/v5/api/signer/README.md#note
  return arrayify(hash)
}

export const VALID_UID_TYPES = new Set(Array(11).keys())
export const validateUidType = (uidType: number) => {
  if (!VALID_UID_TYPES.has(uidType)) {
    throw new Error(`${uidType} is not a valid UniqueIdentity type`)
  }
}
