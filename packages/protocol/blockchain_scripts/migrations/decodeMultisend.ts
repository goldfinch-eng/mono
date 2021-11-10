import {utils} from "ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {Deployment} from "hardhat-deploy/types"
import {task} from "hardhat/config"
import {HardhatRuntimeEnvironment} from "hardhat/types"

interface NamedDeployment {
  name: string
  deployment: Deployment
}

async function getAddressesToDeployments({
  hre,
}: {
  hre: HardhatRuntimeEnvironment
}): Promise<{[address: string]: NamedDeployment}> {
  const deployments = await hre.deployments.all()

  const mapping: {[address: string]: NamedDeployment} = {}

  for (const name of Object.keys(deployments)) {
    const deployment = deployments[name]
    assertNonNullable(deployment)

    if (!name.endsWith("_Proxy")) {
      mapping[deployment.address.toLowerCase()] = {deployment, name}
    }
  }

  return mapping
}

interface DecodedTx {
  operation: string
  to: string
  value: string
  data: string
}

export async function main({transactionsBytes, hre}: {transactionsBytes: string; hre: HardhatRuntimeEnvironment}) {
  const multisendData = transactionsBytes

  const operationSize = 1
  const toSize = 20
  const valueSize = 32
  const dataLengthSize = 32

  let i = 0
  const decodedTxs: DecodedTx[] = []

  while (i < utils.hexDataLength(multisendData)) {
    const operation = utils.hexDataSlice(multisendData, i, i + operationSize)
    const to = utils.hexDataSlice(multisendData, i + operationSize, i + operationSize + toSize)
    const value = utils.hexDataSlice(multisendData, i + operationSize + toSize, i + operationSize + toSize + valueSize)
    const dataLength = utils.hexDataSlice(
      multisendData,
      i + operationSize + toSize + valueSize,
      i + operationSize + toSize + valueSize + dataLengthSize
    )
    const data = utils.hexDataSlice(
      multisendData,
      i + operationSize + toSize + valueSize + dataLengthSize,
      i + operationSize + toSize + valueSize + dataLengthSize + Number(dataLength)
    )

    decodedTxs.push({
      operation,
      to,
      value,
      data,
    })

    i = i + operationSize + toSize + valueSize + dataLengthSize + Number(dataLength)
  }

  const addressToDeployment = await getAddressesToDeployments({hre})

  decodedTxs.forEach((tx) => {
    const namedDeployment = addressToDeployment[tx.to]
    assertNonNullable(namedDeployment, `${tx.to} not found in deployments`)

    const iface = new utils.Interface(namedDeployment.deployment.abi)
    const txDescription = iface.parseTransaction(tx)

    const arrayKeys = Array.from(txDescription.args.keys()).map(String)
    const functionArgs = Object.keys(txDescription.args)
      .map((argName) => {
        const argValue = txDescription.args[argName]
        if (arrayKeys.includes(argName)) {
          return
        }
        return {name: argName, value: String(argValue)}
      })
      .filter((a) => a !== undefined)

    console.log({
      address: tx.to,
      name: namedDeployment.name,
      signature: txDescription.signature,
      args: functionArgs,
    })
  })
}

task(
  "decode-multisend",
  "Decode a multisend into human-readable contract calls so you can see what it's doing. The contract calls must be present as hardhat-deploy deployments."
)
  .addPositionalParam(
    "transactionsBytes",
    'Multisend.multiSend transactions arg encoded in bytes. You should paste this in from Defender. Make sure it\'s the data from the "TARGET FUNCTION" section rather than "HEX-ENCODED-DATA".'
  )
  .setAction(async ({transactionsBytes}, hre) => {
    await main({transactionsBytes, hre})
  })
