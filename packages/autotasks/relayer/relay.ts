// Based on https://github.com/OpenZeppelin/defender-example-metatx-relay
// Updated to use the GSN v2 Forwarder contracts

import {ethers} from "ethers"
import {caseInsensitiveIncludes} from "../unique-identity-signer/utils"

const GenericParams = "address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data"
const TypeName = `ForwardRequest(${GenericParams})`
const TypeHash = ethers.utils.id(TypeName)

export async function relay(request, context) {
  const {forwarder, relayTx, allowed_senders, domain_separator} = context
  // Unpack request
  const {to, from, value, gas, nonce, data, signature} = request

  // Validate request
  const SuffixData = "0x"
  const args = [{to, from, value, gas, nonce, data}, domain_separator, TypeHash, SuffixData, signature]

  if (!caseInsensitiveIncludes(allowed_senders, from)) {
    throw new Error(`Unrecognized sender: ${from}`)
  }

  // This verifies the unpacked message matches the signature and therefore validates that the to/from/data passed in
  // was actually signed by the whitelisted sender
  console.log("verifying transactions...")
  await forwarder.verify(...args)
  console.log("successfully verified transaction.")

  // Send meta-tx through Defender
  console.log("encoding transaction...")
  const forwardData = forwarder.interface.encodeFunctionData("execute", args)
  console.log("successfully encoded transaction")

  const tx = await relayTx({
    speed: "fast",
    to: forwarder.address,
    gasLimit: gas,
    data: forwardData,
  })

  console.log(`Sent meta-tx: ${tx.hash} on behalf of ${from}, data: ${forwardData}`)
  return tx
}
