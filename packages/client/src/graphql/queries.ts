import gql from "graphql-tag"

export const GET_SENIOR_POOL_AND_PROVIDER_DATA = gql`
  query getSeniorPoolAndProviders($userID: ID!) {
    _meta {
      block {
        number
      }
    }
    seniorPools(first: 1) {
      id
      latestPoolStatus {
        id
        rawBalance
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
      goListed
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
        id
        amount
        shares
        blockNumber
        timestamp
      }
    }
  }
`

export const GET_SENIOR_POOL_STATUS = gql`
  query getSeniorPool {
    _meta {
      block {
        number
      }
    }
    seniorPool(id: "0x8481a6ebaf5c7dabc3f7e09e44a89531fd31f822") {
      latestPoolStatus {
        id
        rawBalance
        balance
        totalShares
        sharePrice
        totalPoolAssets
        totalLoansOutstanding
      }
    }
  }
`

export const GET_TRANCHED_POOLS_DATA = gql`
  query getTranchedPoolsData {
    _meta {
      block {
        number
      }
    }
    tranchedPools {
      id
      estimatedSeniorPoolContribution
      isPaused
      estimatedLeverageRatio
      juniorFeePercent
      reserveFeePercent
      totalDeposited
      creditLine {
        id
        interestApr
        limit
        balance
        remainingPeriodDueAmount
        remainingTotalDueAmount
        availableCredit
        interestAccruedAsOf
        paymentPeriodInDays
        termInDays
        nextDueTime
        interestOwed
        termEndTime
        lastFullPaymentTime
        periodDueAmount
        interestAprDecimal
        collectedPaymentBalance
        totalDueAmount
        dueDate
        name
      }
      # TODO support filtering by userAddress or paginating queries once the amount of backers by tranched pools increases
      backers(first: 1000) {
        id
        user {
          id
          tokens {
            id
            tranchedPool {
              id
            }
            tranche
            principalAmount
            principalRedeemed
            interestRedeemed
            principalRedeemable
            interestRedeemable
          }
        }
        balance
        unrealizedGains
        principalAmount
        principalRedeemed
        interestRedeemed
        principalAtRisk
        principalRedeemable
        interestRedeemable
        availableToWithdraw
      }
      juniorTranches {
        id
        lockedUntil
        principalDeposited
        principalSharePrice
        interestSharePrice
        trancheId
      }
      seniorTranches {
        id
        lockedUntil
        principalDeposited
        principalSharePrice
        interestSharePrice
        trancheId
      }
    }
  }
`
