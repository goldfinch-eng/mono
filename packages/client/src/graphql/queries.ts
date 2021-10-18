import gql from "graphql-tag"

export const GET_SENIOR_POOL_AND_PROVIDER_DATA = gql`
  query getSeniorPoolAndProviders($userID: ID!) {
    seniorPools(first: 1) {
      id
      lastestPoolStatus {
        id
        rawBalance
        compoundBalance
        balance
        totalShares
        sharePrice
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
    user(id: $userID) {
      id
      capitalProviderStatus {
        numShares
        availableToWithdraw
        availableToWithdrawInDollars
        allowance
        weightedAverageSharePrice
        unrealizedGains
        unrealizedGainsPercentage
        unrealizedGainsInDollars
      }
      seniorPoolDeposits {
        amount
        shares
        blockNumber
        timestamp
      }
    }
  }
`
