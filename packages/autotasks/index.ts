import {findEnvLocal, assertNonNullable} from "@goldfinch-eng/utils"
import dotenv from "dotenv"
dotenv.config({path: findEnvLocal()})

import * as uniqueIdentitySigner from "./unique-identity-signer"
import {hardhat as hre} from "@goldfinch-eng/protocol"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"

export async function uniqueIdentitySignerHandler(req, res) {
  try {
    console.log(`Forwarding: ${JSON.stringify(req.body)}`)

    // Set up params / dependencies for handler logic
    const deployment = await hre.deployments.get("UniqueIdentity")
    const uniqueIdentity = (await hre.ethers.getContractAt(deployment.abi, deployment.address)) as UniqueIdentity
    const signer = uniqueIdentity.signer
    assertNonNullable(signer.provider, "Signer provider is null")
    const network = await signer.provider.getNetwork()

    const {auth, mintToAddress} = req.body

    // Run handler
    const result = await uniqueIdentitySigner.main({auth, signer, network, uniqueIdentity, mintToAddress})
    res.status(200).send({status: "success", result: JSON.stringify(result)})
  } catch (error: any) {
    console.log(`Failed: ${error}`)
    res.status(500).send({status: "error", message: error.toString()})
  }
}
