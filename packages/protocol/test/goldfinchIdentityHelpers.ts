import _ from "lodash"
import {keccak256} from "@ethersproject/keccak256"
import {pack} from "@ethersproject/solidity"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {TestGoldfinchIdentityInstance} from "../typechain/truffle"
import {TransferSingle} from "../typechain/truffle/TestGoldfinchIdentity"
import {BN, decodeLogs, getOnlyLog} from "./testHelpers"
import {BigNumber, constants as ethersConstants} from "ethers"
import {HardhatRuntimeEnvironment} from "hardhat/types"

export const MINT_MESSAGE_ELEMENT_TYPES = ["address", "uint256", "uint256"]
export const EMPTY_STRING_HEX = web3.utils.asciiToHex("")
export const MINT_PAYMENT = new BN(0.00083e18)

export const BURN_MESSAGE_ELEMENT_TYPES = ["address", "uint256", "uint256"]

export const sign = async (
  hre: HardhatRuntimeEnvironment,
  signerAddress: string,
  messageBaseElements: {types: string[]; values: Array<BN | string>},
  nonce: BN
): Promise<string> => {
  const signer = (await hre.ethers.getSigners()).find((signer) => signer.address === signerAddress)
  assertNonNullable(signer)

  if (messageBaseElements.types.length !== messageBaseElements.values.length) {
    throw new Error("Invalid message elements")
  }

  // Append nonce to base elements of message.
  const types = messageBaseElements.types.concat("uint256")
  const _values = messageBaseElements.values.concat(nonce)

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

export type MintParams = [string, BN, BN, string]

export async function mint(
  hre: HardhatRuntimeEnvironment,
  goldfinchIdentity: TestGoldfinchIdentityInstance,
  recipient: string,
  tokenId: BN,
  amount: BN,
  nonce: BN,
  signer: string,
  overrideMintParams?: MintParams,
  overrideFrom?: string
): Promise<void> {
  const contractBalanceBefore = await web3.eth.getBalance(goldfinchIdentity.address)
  const tokenBalanceBefore = await goldfinchIdentity.balanceOf(recipient, tokenId)

  const messageElements: [string, BN, BN] = [recipient, tokenId, amount]
  const signature = await sign(hre, signer, {types: MINT_MESSAGE_ELEMENT_TYPES, values: messageElements}, nonce)

  const defaultMintParams: MintParams = [recipient, tokenId, amount, EMPTY_STRING_HEX]
  const mintParams: MintParams = overrideMintParams || defaultMintParams

  const defaultFrom = recipient
  const from = overrideFrom || defaultFrom

  const receipt = await goldfinchIdentity.mint(...mintParams, signature, {
    from,
    value: MINT_PAYMENT,
  })

  // Verify contract state.
  const contractBalanceAfter = await web3.eth.getBalance(goldfinchIdentity.address)
  expect(new BN(contractBalanceAfter).sub(new BN(contractBalanceBefore))).to.bignumber.equal(MINT_PAYMENT)

  const tokenBalanceAfter = await goldfinchIdentity.balanceOf(recipient, tokenId)
  expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.bignumber.equal(amount)

  expect(await goldfinchIdentity.nonces(recipient)).to.bignumber.equal(nonce.add(new BN(1)))

  // Verify that event was emitted.
  const transferEvent = getOnlyLog<TransferSingle>(
    decodeLogs(receipt.receipt.rawLogs, goldfinchIdentity, "TransferSingle")
  )
  expect(transferEvent.args.operator).to.equal(from)
  expect(transferEvent.args.from).to.equal(ethersConstants.AddressZero)
  expect(transferEvent.args.to).to.equal(recipient)
  expect(transferEvent.args.id).to.bignumber.equal(tokenId)
  expect(transferEvent.args.value).to.bignumber.equal(amount)
}

export type BurnParams = [string, BN, BN]

export async function burn(
  hre: HardhatRuntimeEnvironment,
  goldfinchIdentity: TestGoldfinchIdentityInstance,
  recipient: string,
  tokenId: BN,
  value: BN,
  nonce: BN,
  signer: string,
  overrideBurnParams?: BurnParams,
  overrideFrom?: string
): Promise<void> {
  const contractBalanceBefore = await web3.eth.getBalance(goldfinchIdentity.address)
  const tokenBalanceBefore = await goldfinchIdentity.balanceOf(recipient, tokenId)

  const messageElements: [string, BN, BN] = [recipient, tokenId, value]
  const signature = await sign(hre, signer, {types: BURN_MESSAGE_ELEMENT_TYPES, values: messageElements}, nonce)

  const defaultBurnParams: BurnParams = [recipient, tokenId, value]
  const burnParams: BurnParams = overrideBurnParams || defaultBurnParams

  const defaultFrom = recipient
  const from = overrideFrom || defaultFrom

  const receipt = await goldfinchIdentity.burn(...burnParams, signature, {from})

  // Verify contract state.
  const contractBalanceAfter = await web3.eth.getBalance(goldfinchIdentity.address)
  expect(new BN(contractBalanceAfter)).to.bignumber.equal(new BN(contractBalanceBefore))

  const tokenBalanceAfter = await goldfinchIdentity.balanceOf(recipient, tokenId)
  expect(tokenBalanceBefore.sub(tokenBalanceAfter)).to.bignumber.equal(value)
  expect(tokenBalanceAfter).to.bignumber.equal(new BN(0))

  expect(await goldfinchIdentity.nonces(recipient)).to.bignumber.equal(nonce.add(new BN(1)))

  // Verify that event was emitted.
  const transferEvent = getOnlyLog<TransferSingle>(
    decodeLogs(receipt.receipt.rawLogs, goldfinchIdentity, "TransferSingle")
  )
  expect(transferEvent.args.operator).to.equal(from)
  expect(transferEvent.args.from).to.equal(recipient)
  expect(transferEvent.args.to).to.equal(ethersConstants.AddressZero)
  expect(transferEvent.args.id).to.bignumber.equal(tokenId)
  expect(transferEvent.args.value).to.bignumber.equal(value)
}
