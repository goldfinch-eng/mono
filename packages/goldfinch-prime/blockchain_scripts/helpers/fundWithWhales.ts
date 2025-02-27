import {ChainId} from "@goldfinch-eng/goldfinch-prime/config/chainId"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import BN from "bn.js"
import {Contract} from "ethers"
import hre, {ethers, getNamedAccounts} from "hardhat"
import _ from "lodash"

import {Ticker, AddressString, getERC20Address, currentChainId, assertIsChainId, assertIsTicker} from "../deployHelpers"
import {impersonateAccount} from "./impersonateAccount"

const whales: Record<ChainId, Record<Ticker, AddressString>> = {
  10: {
    USDC: "0xebe80f029b1c02862b9e8a70a7e5317c06f62cae",
    ETH: "0x4200000000000000000000000000000000000006",
  },
  42161: {
    USDC: "0x62383739d68dd0f844103db8dfb05a7eded5bbe6",
    ETH: "0xf977814e90da44bfa03b6295a0616a897441acec",
  },
  8453: {
    // Base mainnet
    USDC: "0x0B0A5886664376F59C351ba3f598C8A8B4D0A6f3", // Base USDC whale
    ETH: "0x4200000000000000000000000000000000000006", // Base L1 Bridge
  },
  84532: {
    // Base Sepolia
    USDC: "0xFaEc9cDC3Ef75713b48f46057B98BA04885e3391", // Base USDC whale
    ETH: "0x4200000000000000000000000000000000000006", // Base L1 Bridge
  },
}

export async function fundWithWhales(
  currencies: Ticker[],
  recipients: string[],
  amount?: number,
  {logger}: {logger: typeof console.log} = {logger: hre.deployments.log}
) {
  logger("💰🐋 Begin fundWithWhales")
  const {gf_deployer} = await getNamedAccounts()
  assertNonNullable(gf_deployer)
  const chainId = await currentChainId()
  assertIsChainId(chainId)
  const whalesOnChain = whales[chainId]
  assertNonNullable(whalesOnChain, "Requires whales on the configured CHAIN_ID")

  for (const currency of currencies) {
    console.log(`💰🐋 funding ${currency}`)
    if (!whalesOnChain[currency]) {
      throw new Error(`🚨 We don't have a whale mapping for ${currency}`)
    }
    const whale = whalesOnChain[currency]

    // Fund non-ETH whale with ETH so they can afford ERC20 tx's
    if (currency !== "ETH") {
      const ethWhale = whalesOnChain["ETH"]
      await impersonateAccount(hre, ethWhale)
      const signer = ethers.provider.getSigner(ethWhale)
      assertNonNullable(signer)
      console.log(`💰🐋 ethWhale:${ethWhale}, recipient:${whale}`)
      await signer.sendTransaction({to: whale, value: ethers.utils.parseEther("0.1")})
    }
    for (const recipient of _.compact(recipients)) {
      assertIsTicker(currency)
      if (currency === "ETH") {
        console.log(`💰🐋 whale:${whale}, recipient:${recipient}`)
        await impersonateAccount(hre, whale)
        const signer = ethers.provider.getSigner(whale)
        assertNonNullable(signer)
        await signer.sendTransaction({to: recipient, value: ethers.utils.parseEther("0.1")})
      } else {
        const erc20Address = getERC20Address(currency, chainId)
        assertIsString(erc20Address)
        const erc20 = await ethers.getContractAt("IERC20withDec", erc20Address)
        await fundWithWhale({
          erc20,
          whale: whale,
          recipient: recipient,
          amount: amount || 200000,
          logger,
        })
      }
    }
  }
  logger("💰🐋 End fundWithWhales")
}

async function fundWithWhale({
  whale,
  recipient,
  erc20,
  amount,
  logger,
}: {
  whale: string
  recipient: string
  erc20: Contract
  amount: number
  logger: typeof console.log
}) {
  logger(`💰🐋 funding erc20 ${erc20.address}`)
  logger(`💰🐋 recipient:${recipient}`)
  logger(`💰🐋 whale:${whale}`)
  await impersonateAccount(hre, whale)
  // give the whale a ton of eth in case they dont have enough
  await ethers.provider.send("hardhat_setBalance", [whale, ethers.utils.parseEther("10.0").toHexString()])
  const signer = await ethers.provider.getSigner(whale)
  const contract = erc20.connect(signer)

  logger(`💰🐋 recipientStartBalance:${await erc20.balanceOf(recipient)}`)

  const erc20Balance = await erc20.balanceOf(whale)
  logger(`💰🐋 whaleBalance:${erc20Balance}`)

  const ten = new BN(10)
  const d = new BN((await contract.decimals()).toString())
  const decimals = ten.pow(new BN(d))

  await contract.transfer(recipient, new BN(amount).mul(decimals).toString())
  logger(`💰🐋 recipientEndBalance:${await erc20.balanceOf(recipient)}`)
}
