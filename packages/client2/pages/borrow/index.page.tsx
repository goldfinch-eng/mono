import { gql } from "@apollo/client";
import { BigNumber } from "ethers";

import { Heading } from "../../components/design-system";
import { formatCrypto, formatPercent } from "../../lib/format";
import {
  SupportedCrypto,
  useBorrowPageQuery,
} from "../../lib/graphql/generated";
import { useWallet } from "../../lib/wallet";
import { CreditLineCard } from "./credit-line-card";

gql`
  query BorrowPage($userId: ID!) {
    user(id: $userId) {
      borrowerContracts {
        id
        tranchedPools(orderBy: createdAt, orderDirection: desc) {
          id
          creditLine {
            id
            balance
            interestApr
            interestAprDecimal
            interestAccruedAsOf
            paymentPeriodInDays
            termInDays
            nextDueTime
            limit
            maxLimit
            currentLimit @client
            isLate @client
            version
            interestOwed
            currentInterestOwed @client
            termStartTime
            termEndTime
            lastFullPaymentTime
            collectedPaymentBalance @client
          }
        }
      }
    }
  }
`;

export default function PoolPage() {
  const { account } = useWallet();

  const { data, error, loading } = useBorrowPageQuery({
    variables: {
      userId: account?.toLowerCase() ?? "",
    },
    returnPartialData: true,
  });

  const borrowerContracts = data?.user?.borrowerContracts;
  // TODO: Zadra explain better - We get the last borrower contract in the array - FOR SOME REASON
  const tranchedPools =
    borrowerContracts && borrowerContracts.length > 0
      ? borrowerContracts[borrowerContracts.length - 1].tranchedPools
      : null;

  if (loading) {
    return <div className="text-xl">Loading...</div>;
  }

  if (error) {
    return <div className="text-2xl">Unable to load credit lines</div>;
  }

  return (
    <div>
      <Heading
        as="h1"
        level={2}
        className="mb-12 text-center !text-5xl md:!text-6xl lg:text-left"
      >
        Borrow
      </Heading>

      <Heading
        as="h2"
        level={4}
        className="mb-10 !font-serif !text-[2.5rem] !font-bold"
      >
        Credit Line
      </Heading>

      {!tranchedPools || tranchedPools.length === 0 ? (
        <div
          className={
            "max-w-[750px] rounded-xl border border-tidepool-200 bg-tidepool-100 p-5"
          }
        >
          <div className="text-xl">
            You do not have any credit lines. To borrow funds from the pool, you
            need a Goldfinch credit line.
          </div>
        </div>
      ) : (
        <div>
          {tranchedPools.map(({ creditLine }, i) => {
            const id = creditLine.id;
            const creditLineLimit = formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: creditLine.currentLimit,
            });
            const interest = formatPercent(creditLine.interestAprDecimal);

            let remainingPeriodDueAmount = BigNumber.from(0);
            if (
              creditLine?.collectedPaymentBalance &&
              creditLine.currentInterestOwed
                .sub(creditLine?.collectedPaymentBalance)
                .gt(BigNumber.from(0))
            ) {
              remainingPeriodDueAmount = creditLine.currentInterestOwed.sub(
                creditLine?.collectedPaymentBalance
              );
            }

            const nextPayment = formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: remainingPeriodDueAmount,
            });

            return (
              <div key={id}>
                {/* <p>{`${creditLineLimit} at ${interest}. Next Payment: ${nextPayment}`}</p> */}
                <CreditLineCard
                  className="mb-3 w-2/3"
                  slot1={`${creditLineLimit} at ${interest}`}
                  slot1Label={i === 0 ? "Credit Lines" : undefined}
                  slot2={nextPayment}
                  slot2Label={i === 0 ? "Next Payment" : undefined}
                  slot3={"Dec 26"}
                  slot3Label={i === 0 ? "Due Date" : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
