import _ from "lodash"
import {keccak256} from "@ethersproject/keccak256"
import {pack} from "@ethersproject/solidity"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {UniqueIdentityInstance} from "../typechain/truffle"
import {TransferSingle} from "../typechain/truffle/contracts/test/TestUniqueIdentity"
import {BN, decodeLogs, getOnlyLog} from "./testHelpers"
import {BigNumber, constants as ethersConstants} from "ethers"
import {HardhatRuntimeEnvironment} from "hardhat/types"

export const MINT_MESSAGE_ELEMENT_TYPES = ["address", "uint256", "uint256", "address"]
export const BURN_MESSAGE_ELEMENT_TYPES = MINT_MESSAGE_ELEMENT_TYPES
export const MINT_TO_MESSAGE_ELEMENT_TYPES = ["address", "address", "uint256", "uint256", "address"]

export const EMPTY_STRING_HEX = web3.utils.asciiToHex("")
export const MINT_PAYMENT = new BN(0.00083e18)

export const sign = async (
  hre: HardhatRuntimeEnvironment,
  signerAddress: string,
  messageBaseElements: {types: string[]; values: Array<BN | string>},
  nonce: BN,
  overrideChainId?: BN
): Promise<string> => {
  const signer = await hre.ethers.provider.getSigner(signerAddress)
  assertNonNullable(signer)

  if (messageBaseElements.types.length !== messageBaseElements.values.length) {
    throw new Error("Invalid message elements")
  }

  // Append nonce and chainId to base elements of message.
  const chainId = overrideChainId || (await hre.getChainId())
  const types = messageBaseElements.types.concat(["uint256", "uint256"])
  const _values = messageBaseElements.values.concat([nonce, chainId])

  // Convert BN values to BigNumber, since ethers utils use BigNumber.
  const values = _values.map((val: BN | string) => (BN.isBN(val) ? BigNumber.from(val.toString()) : val))

  if (_.some(values, Array.isArray)) {
    // If we want to support signing a message whose elements can be arrays, we'd want to encode the values using
    // a utility corresponding to `abi.encode()`, rather than `abi.encodePacked()`, because packed encoding is
    // ambiguous for multiple parameters of dynamic type (cf. https://github.com/ethereum/solidity/blob/v0.8.4/docs/abi-spec.rst#non-standard-packed-mode).
    // This is something to keep in mind if we ever implement `mintBatch()` or `burnBatch()`, which would use
    // array parameters. For now, we're defensive here against this issue.
    throw new Error("Expected no array values.")
  }
  const encoded = pack(types, values)
  const hashed = keccak256(encoded)

  // Cf. https://github.com/ethers-io/ethers.js/blob/ce8f1e4015c0f27bf178238770b1325136e3351a/docs/v5/api/signer/README.md#note
  const arrayified = hre.ethers.utils.arrayify(hashed)
  return signer.signMessage(arrayified)
}

export type MintParams = [BN, BN]

export async function mint(
  hre: HardhatRuntimeEnvironment,
  uniqueIdentity: UniqueIdentityInstance,
  tokenId: BN,
  expiresAt: BN,
  nonce: BN,
  signer: string,
  overrideMintParams?: MintParams,
  overrideFrom?: string,
  overrideChainId?: BN
): Promise<void> {
  const contractBalanceBefore = await web3.eth.getBalance(uniqueIdentity.address)
  const tokenBalanceBefore = await uniqueIdentity.balanceOf(overrideFrom as string, tokenId)
  const messageElements: [string, BN, BN, string] = [overrideFrom as string, tokenId, expiresAt, uniqueIdentity.address]
  const signature = await sign(
    hre,
    signer,
    {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements},
    nonce,
    overrideChainId
  )
  const defaultMintParams: MintParams = [tokenId, expiresAt]
  const mintParams: MintParams = overrideMintParams || defaultMintParams

  const receipt = await uniqueIdentity.mint(...mintParams, signature, {
    from: overrideFrom as string,
    value: MINT_PAYMENT,
  })

  // Verify contract state.
  const contractBalanceAfter = await web3.eth.getBalance(uniqueIdentity.address)
  expect(new BN(contractBalanceAfter).sub(new BN(contractBalanceBefore))).to.bignumber.equal(MINT_PAYMENT)

  const tokenBalanceAfter = await uniqueIdentity.balanceOf(overrideFrom as string, tokenId)
  expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.bignumber.equal(new BN(1))
  expect(tokenBalanceAfter).to.bignumber.equal(new BN(1))

  expect(await uniqueIdentity.nonces(overrideFrom as string)).to.bignumber.equal(nonce.add(new BN(1)))

  // Verify that event was emitted.
  const transferEvent = getOnlyLog<TransferSingle>(
    decodeLogs(receipt.receipt.rawLogs, uniqueIdentity, "TransferSingle")
  )
  expect(transferEvent.args.operator).to.equal(overrideFrom, "Operator should be the sender")
  expect(transferEvent.args.from).to.equal(ethersConstants.AddressZero, "From should be the zero address")
  expect(transferEvent.args.to).to.equal(overrideFrom as string, "To should be the sender")
  expect(transferEvent.args.id).to.bignumber.equal(tokenId, "tokenId should be provided tokendId")
  expect(transferEvent.args.value).to.bignumber.equal(new BN(1))
}

export type MintToParams = [string, BN, BN]
export async function mintTo(
  hre: HardhatRuntimeEnvironment,
  uniqueIdentity: UniqueIdentityInstance,
  recipientAddress: string,
  tokenId: BN,
  expiresAt: BN,
  nonce: BN,
  signer: string,
  from: string,
  overrideMintToParams?: MintToParams,
  overrideChainId?: BN
): Promise<void> {
  const contractBalanceBefore = await web3.eth.getBalance(uniqueIdentity.address)
  const tokenBalanceBefore = await uniqueIdentity.balanceOf(recipientAddress, tokenId)

  const messageElements: [string, string, BN, BN, string] = [
    from,
    recipientAddress,
    tokenId,
    expiresAt,
    uniqueIdentity.address,
  ]

  const signature = await sign(
    hre,
    signer,
    {types: MINT_TO_MESSAGE_ELEMENT_TYPES, values: messageElements},
    nonce,
    overrideChainId
  )

  const defaultMintToParams: MintToParams = [recipientAddress, tokenId, expiresAt]
  const mintToParams: MintToParams = overrideMintToParams || defaultMintToParams

  const receipt = await uniqueIdentity.mintTo(...mintToParams, signature, {
    from,
    value: MINT_PAYMENT,
  })

  // Verify contract state.
  const contractBalanceAfter = await web3.eth.getBalance(uniqueIdentity.address)
  expect(new BN(contractBalanceAfter).sub(new BN(contractBalanceBefore))).to.bignumber.equal(MINT_PAYMENT)

  const tokenBalanceAfter = await uniqueIdentity.balanceOf(recipientAddress, tokenId)
  expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.bignumber.equal(new BN(1))
  expect(tokenBalanceAfter).to.bignumber.equal(new BN(1))

  expect(await uniqueIdentity.nonces(from)).to.bignumber.equal(nonce.add(new BN(1)))

  // Verify that event was emitted.
  const transferEvent = getOnlyLog<TransferSingle>(
    decodeLogs(receipt.receipt.rawLogs, uniqueIdentity, "TransferSingle")
  )
  expect(transferEvent.args.operator).to.equal(from)
  expect(transferEvent.args.from).to.equal(ethersConstants.AddressZero)
  expect(transferEvent.args.to).to.equal(recipientAddress)
  expect(transferEvent.args.id).to.bignumber.equal(tokenId)
  expect(transferEvent.args.value).to.bignumber.equal(new BN(1))
}

export type BurnParams = [string, BN, BN]

export async function burn(
  hre: HardhatRuntimeEnvironment,
  uniqueIdentity: UniqueIdentityInstance,
  recipient: string,
  tokenId: BN,
  expiresAt: BN,
  nonce: BN,
  signer: string,
  overrideBurnParams?: BurnParams,
  overrideFrom?: string,
  overrideChainId?: BN
): Promise<void> {
  const contractBalanceBefore = await web3.eth.getBalance(uniqueIdentity.address)
  const tokenBalanceBefore = await uniqueIdentity.balanceOf(recipient, tokenId)

  const messageElements: [string, BN, BN, string] = [recipient, tokenId, expiresAt, uniqueIdentity.address]
  const signature = await sign(
    hre,
    signer,
    {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements},
    nonce,
    overrideChainId
  )

  const defaultBurnParams: BurnParams = [recipient, tokenId, expiresAt]
  const burnParams: BurnParams = overrideBurnParams || defaultBurnParams

  const defaultFrom = recipient
  const from = overrideFrom || defaultFrom

  const receipt = await uniqueIdentity.burn(...burnParams, signature, {from})

  // Verify contract state.
  const contractBalanceAfter = await web3.eth.getBalance(uniqueIdentity.address)
  expect(new BN(contractBalanceAfter)).to.bignumber.equal(new BN(contractBalanceBefore))

  const tokenBalanceAfter = await uniqueIdentity.balanceOf(recipient, tokenId)
  expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.bignumber.equal(new BN(1))
  expect(tokenBalanceAfter).to.bignumber.equal(new BN(0))

  expect(await uniqueIdentity.nonces(recipient)).to.bignumber.equal(nonce.add(new BN(1)))

  // Verify that event was emitted.
  const transferEvent = getOnlyLog<TransferSingle>(
    decodeLogs(receipt.receipt.rawLogs, uniqueIdentity, "TransferSingle")
  )
  expect(transferEvent.args.operator).to.equal(from)
  expect(transferEvent.args.from).to.equal(recipient)
  expect(transferEvent.args.to).to.equal(ethersConstants.AddressZero)
  expect(transferEvent.args.id).to.bignumber.equal(tokenId)
  expect(transferEvent.args.value).to.bignumber.equal(new BN(1))
}
