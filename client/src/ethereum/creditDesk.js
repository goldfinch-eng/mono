import BigNumber from "bignumber.js"
import web3 from "../web3"
import _ from "lodash"
import { buildCreditLine } from "./creditLine"
import { getDeployments, getFromBlock, fetchDataFromAttributes, INTEREST_DECIMALS } from "./utils"

async function getCreditDesk(networkId) {
  const config = await getDeployments(networkId)
  const creditDeskAddress = config.contracts.CreditDesk.address
  const creditDesk = new web3.eth.Contract(config.contracts.CreditDesk.abi, creditDeskAddress)
  creditDesk.chain = networkId
  creditDesk.loaded = true
  return creditDesk
}

async function fetchCreditDeskData(creditDesk) {
  var result = {}
  if (!creditDesk) {
    return Promise.resolve(result)
  }
  result.estimatedTotalInterest = await getEstimatedTotalInterest(creditDesk)
  result.cumulativeDrawdowns = await getCumulativeDrawdowns(creditDesk)
  result.loaded = true
  return result
}

async function getEstimatedTotalInterest(creditDesk) {
  const allCreditLines = await creditDesk.getPastEvents("CreditLineCreated", {
    fromBlock: getFromBlock(creditDesk.chain),
    toBlock: "latest",
  })
  const creditLineDataPromises = allCreditLines
    .map(event => buildCreditLine(event.returnValues.creditLine))
    .map(async creditLine => {
      return await fetchDataFromAttributes(creditLine, [{ method: "balance" }, { method: "interestApr" }], {
        bigNumber: true,
      })
    })
  const creditLineData = await Promise.all(creditLineDataPromises)
  return BigNumber.sum.apply(
    null,
    creditLineData.map(cl => cl.balance.multipliedBy(cl.interestApr.dividedBy(INTEREST_DECIMALS))),
  )
}

async function getCumulativeDrawdowns(creditDesk) {
  const fromBlock = getFromBlock(creditDesk.chain)
  const drawdownEvents = await creditDesk.getPastEvents("DrawdownMade", { fromBlock: fromBlock })
  return new BigNumber(_.sumBy(drawdownEvents, event => parseInt(event.returnValues.drawdownAmount, 10)))
}

function getAndSetCreditDeskData(creditDesk, setter) {
  fetchCreditDeskData(creditDesk).then(data => {
    creditDesk.loaded = true
    creditDesk.gf = data
    setter(creditDesk)
  })
}

export { getCreditDesk, fetchCreditDeskData, getAndSetCreditDeskData }
