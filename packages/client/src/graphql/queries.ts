import gql from "graphql-tag"

export const getSeniorPoolByID = gql(`
  query getSeniorPoolByID($id: ID!) {
    seniorPool(id: $id) {
      id
      lastestPoolStatus {
        id
        rawBalance
        compoundBalance
        balance
        totalShares
        totalPoolAssets
        totalLoansOutstanding
        cumulativeWritedowns
        cumulativeDrawdowns
        estimatedTotalInterest
        estimatedApy
        defaultRate
        remainingCapacity
      }
    }
  }
`)

export const getUserByID = gql(`
  query getUserByID($id: ID!) {
    user(id: $id) {
      id
    }
  }
`)
