import BN from "bn.js"
import {Ticker, AddressString, getERC20Address, currentChainId, assertIsChainId, assertIsTicker} from "../deployHelpers"
import _ from "lodash"
import hre from "hardhat"
import {Contract} from "ethers"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {impersonateAccount} from "./impersonateAccount"
const {ethers} = hre

type FundWithWhaleOptions = {
  amount?: number
  debug?: typeof console.log // added because hre logger isn't working on async requests to the packages/server node instance
}

export async function fundWithWhales(
  currencies: Ticker[],
  recipients: string[],
  {amount, debug}: FundWithWhaleOptions
) {
  const {
    deployments: {log: logger},
  } = hre
  if (!debug) {
    debug = (...args) => {
      logger(...args)
    }
  }
  debug("💰🐋 Begin fundWithWhales")

  const whales: Record<Ticker, AddressString> = {
    USDC: "0xf977814e90da44bfa03b6295a0616a897441acec",
    USDT: "0x28c6c06298d514db089934071355e5743bf21d60",
    BUSD: "0x28c6c06298d514db089934071355e5743bf21d60",
    ETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  }
  const chainId = await currentChainId()
  assertIsChainId(chainId)

  for (const currency of currencies) {
    debug(`💰🐋 funding ${currency}`)
    if (!whales[currency]) {
      throw new Error(`🚨 We don't have a whale mapping for ${currency}`)
    }
    for (const recipient of _.compact(recipients)) {
      assertIsTicker(currency)
      if (currency === "ETH") {
        const whale = whales[currency]
        debug(`💰🐋 whale:${whale}, recipient:${recipient}`)
        await impersonateAccount(hre, whale)
        const signer = ethers.provider.getSigner(whale)
        assertNonNullable(signer)
        await signer.sendTransaction({to: recipient, value: ethers.utils.parseEther("10.0")})
      } else {
        const erc20Address = getERC20Address(currency, chainId)
        assertIsString(erc20Address)
        const erc20 = await ethers.getContractAt("IERC20withDec", erc20Address)
        await fundWithWhale({
          erc20,
          whale: whales[currency],
          recipient: recipient,
          amount: amount || 200000,
          debug,
        })
      }
    }
  }
  debug("💰🐋 End fundWithWhales")
}

async function fundWithWhale({
  whale,
  recipient,
  erc20,
  amount,
  debug,
}: {
  whale: string
  recipient: string
  erc20: Contract
  amount: number
  debug: typeof console.log
}) {
  debug(`💰🐋 funding erc20 ${erc20.name}`)
  debug(`💰🐋 recipient:${recipient}`)
  debug(`💰🐋 whale:${whale}`)
  await impersonateAccount(hre, whale)
  const signer = await ethers.provider.getSigner(whale)
  const contract = erc20.connect(signer)

  const erc20Balance = await erc20.balanceOf()
  debug(`💰🐋 whaleBalance:${erc20Balance}`)

  const ten = new BN(10)
  const d = new BN((await contract.decimals()).toString())
  const decimals = ten.pow(new BN(d))

  await contract.transfer(recipient, new BN(amount).mul(decimals).toString())
}
