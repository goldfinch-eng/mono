import {BigNumber} from "bignumber.js"
import * as poolModule from "../../../ethereum/pool"

export function mockFetch() {
  jest.spyOn(poolModule, "getWeightedAverageSharePrice").mockImplementation(() => {
    return new BigNumber("1")
  })
}
