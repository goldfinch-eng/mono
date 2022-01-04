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
        termEndDate
        periodDueAmount
        interestAprDecimal
        collectedPaymentBalance
        totalDueAmount
        dueDate
        name
      }
      backers {
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
      }
      seniorTranches {
        id
        lockedUntil
        principalDeposited
        principalSharePrice
        interestSharePrice
      }
    }
  }
`
