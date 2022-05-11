import _ from "lodash"
import {Contract} from "web3-eth-contract"
import BigNumber from "bignumber.js"
import {AppContext, GlobalState} from "../../App"
import DrawdownForm from "../../components/Borrow/DrawdownForm"
import {render, screen, fireEvent, waitFor} from "@testing-library/react"
import {usdcToAtomic} from "../../ethereum/erc20"
import {GoldfinchConfigData} from "../../ethereum/goldfinchConfig"
import {SeniorPoolLoaded} from "../../ethereum/pool"
import {NetworkConfig} from "../../types/network"
import {BorrowerInterface} from "../../ethereum/borrower"
import {CreditLine} from "../../ethereum/creditLine"
import {Web3IO} from "../../types/web3"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {Borrower} from "@goldfinch-eng/protocol/typechain/web3/Borrower"

function renderDrawdownForm(
  transactionLimitInDollars: number,
  availableCreditInDollars: number,
  tranchedPoolAmountAvailableInDollars: number
) {
  const creditLineAddress = "0xfoo"
  const borrowerAddress = "0xbar"

  let store: GlobalState = {
    goldfinchConfig: {
      transactionLimit: new BigNumber(usdcToAtomic(transactionLimitInDollars.toString())),
    } as GoldfinchConfigData,
    pool: {
      gf: {
        totalPoolAssets: new BigNumber(0),
      },
    } as unknown as SeniorPoolLoaded,
    network: {
      name: "mainnet",
    } as NetworkConfig,
  }
  const borrower = new BorrowerInterface(
    "0xasdf",
    {
      readOnly: {
        options: {
          address: borrowerAddress,
        },
      },
    } as Web3IO<Borrower>,
    {
      getERC20: () => {},
    } as unknown as GoldfinchProtocol,
    {} as Web3IO<Contract>
  )
  borrower.getPoolAmountAvailableForDrawdownInDollars = (clAddress: string): BigNumber => {
    if (clAddress === creditLineAddress) {
      return new BigNumber(tranchedPoolAmountAvailableInDollars)
    } else {
      throw new Error(`Unexpected credit line address: ${clAddress}`)
    }
  }
  const creditLine = {
    address: creditLineAddress,
    availableCreditInDollars: new BigNumber(availableCreditInDollars),
  } as unknown as CreditLine
  return render(
    <AppContext.Provider value={store}>
      <DrawdownForm actionComplete={_.noop} closeForm={_.noop} borrower={borrower} creditLine={creditLine} />
    </AppContext.Provider>
  )
}

describe("max transaction amount for drawdownForm", () => {
  it("fills the transaction amount with the amount available in the tranched pool, if that is the proximate constraint", async () => {
    const transactionLimitInDollars = 200
    const availableCreditInDollars = 100
    const tranchedPoolAmountAvailableInDollars = 50
    renderDrawdownForm(transactionLimitInDollars, availableCreditInDollars, tranchedPoolAmountAvailableInDollars)
    fireEvent.click(screen.getByText("Borrow"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getAllByRole("textbox")[1]).toHaveProperty("value", tranchedPoolAmountAvailableInDollars.toString())
    })
  })

  it("fills the transaction amount with the available credit of the credit line, if that is the proximate constraint", async () => {
    const transactionLimitInDollars = 200
    const availableCreditInDollars = 100
    const tranchedPoolAmountAvailableInDollars = 150
    renderDrawdownForm(transactionLimitInDollars, availableCreditInDollars, tranchedPoolAmountAvailableInDollars)
    fireEvent.click(screen.getByText("Borrow"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    await waitFor(() => {
      expect(screen.getAllByRole("textbox")[1]).toHaveProperty("value", availableCreditInDollars.toString())
    })
  })

  it("fills the transaction amount with the transaction limit, if that is the proximate constraint", async () => {
    const transactionLimitInDollars = 200
    const availableCreditInDollars = 500
    const tranchedPoolAmountAvailableInDollars = 250
    renderDrawdownForm(transactionLimitInDollars, availableCreditInDollars, tranchedPoolAmountAvailableInDollars)
    fireEvent.click(screen.getByText("Borrow"))
    fireEvent.click(screen.getByText("Max", {selector: "button"}))

    expect(screen.getAllByRole("textbox")[1]).toHaveProperty("value", transactionLimitInDollars.toString())
  })
})
