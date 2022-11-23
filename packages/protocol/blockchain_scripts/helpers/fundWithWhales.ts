import BN from "bn.js"
import {Ticker, AddressString, getERC20Address, currentChainId, assertIsChainId, assertIsTicker} from "../deployHelpers"
import _ from "lodash"
import hre, {ethers} from "hardhat"
import {Contract} from "ethers"
import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {impersonateAccount} from "./impersonateAccount"

export async function fundWithWhales(
  currencies: Ticker[],
  recipients: string[],
  amount?: number,
  {logger}: {logger: typeof console.log} = {logger: hre.deployments.log}
) {
  logger("💰🐋 Begin fundWithWhales")

  const whales: Record<Ticker, AddressString> = {
    USDC: "0xda9ce944a37d218c3302f6b82a094844c6eceb17",
    USDT: "0x28c6c06298d514db089934071355e5743bf21d60",
    BUSD: "0x28c6c06298d514db089934071355e5743bf21d60",
    ETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    GFI: "0xbeb28978b2c755155f20fd3d09cb37e300a6981f",
  }
  const chainId = await currentChainId()
  assertIsChainId(chainId)

  for (const currency of currencies) {
    logger(`💰🐋 funding ${currency}`)
    if (!whales[currency]) {
      throw new Error(`🚨 We don't have a whale mapping for ${currency}`)
    }
    for (const recipient of _.compact(recipients)) {
      assertIsTicker(currency)
      if (currency === "ETH") {
        const whale = whales[currency]
        logger(`💰🐋 whale:${whale}, recipient:${recipient}`)
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
