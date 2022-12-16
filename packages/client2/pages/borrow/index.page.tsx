import { gql } from "@apollo/client";
import { format as formatDate } from "date-fns";

import { Button, Heading, Icon } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { CreditLine } from "@/lib/graphql/generated";
import { useBorrowPageQuery } from "@/lib/graphql/generated";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

import { CreditLineCard } from "./credit-line-card";

gql`
  query BorrowPage($userId: ID!) {
    user(id: $userId) {
      borrowerContracts(orderBy: createdAt, orderDirection: desc) {
        id
        tranchedPools(orderBy: createdAt, orderDirection: desc) {
          id
          creditLine {
            id
            balance
            interestApr
            interestAprDecimal
            interestAccruedAsOf
            interestOwed
            paymentPeriodInDays
            termInDays
            nextDueTime
            limit
            maxLimit
            version
            termStartTime
            termEndTime
            lastFullPaymentTime
            isLate @client
            remainingPeriodDueAmount @client
            remainingTotalDueAmount @client
          }
        }
      }
    }
  }
`;

enum CreditLineStatus {
  PaymentLate,
  PaymentDue,
  Active,
  InActive,
}

const getCreditLineStatus = (creditLine: CreditLine) => {
  // Is Late
  if (creditLine.isLate) {
    return CreditLineStatus.PaymentLate;
  }

  // Payment is due - but not late
  if (creditLine.remainingPeriodDueAmount.gt(0)) {
    return CreditLineStatus.PaymentDue;
  }

  // Credit line is active & paid
  if (creditLine.limit.gt(0) && creditLine.remainingTotalDueAmount.gt(0)) {
    return CreditLineStatus.Active;
  }

  return CreditLineStatus.InActive;
};

const getDueDateLabel = (creditLine: CreditLine) => {
  const status = getCreditLineStatus(creditLine);

  switch (status) {
    case CreditLineStatus.PaymentLate:
      return "Due Now";
    case CreditLineStatus.PaymentDue:
      return formatDate(
        new Date(creditLine.nextDueTime.toNumber() * 1000),
        "MMM d"
      );
    case CreditLineStatus.Active:
      return (
        <div className="align-left flex flex-row items-center">
          <Icon name="CheckmarkCircle" className="mr-1" />
          <div>Paid</div>
        </div>
      );
    case CreditLineStatus.InActive:
      return "N/A";
  }
};

export default function PoolPage() {
  const { account, isActivating } = useWallet();
  const { data, error, loading } = useBorrowPageQuery({
    variables: {
      userId: account?.toLowerCase() ?? "",
    },
    skip: !account,
  });

  const borrowerContracts = data?.user?.borrowerContracts;

  // Get the most recently created borrower contract - older events have no associated pools
  const tranchedPools =
    borrowerContracts && borrowerContracts.length > 0
      ? borrowerContracts[0].tranchedPools
      : null;

  return (
    <div>
      <Heading level={1} className="mb-12">
        Borrow
      </Heading>

      <Heading
        as="h2"
        level={4}
        className="mb-10 !font-serif !text-[2.5rem] !font-bold"
      >
        Credit Line
      </Heading>

      {!account && !isActivating ? (
        <div className="text-lg font-medium text-clay-500">
          You must connect your wallet to view your credit lines
          <div className="mt-3">
            <Button size="xl" onClick={openWalletModal}>
              Connect Wallet
            </Button>
          </div>
        </div>
      ) : error ? (
        <div className="text-2xl">Unable to load credit lines</div>
      ) : loading || isActivating ? (
        <div className="text-xl">Loading...</div>
      ) : !tranchedPools || tranchedPools.length === 0 ? (
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
        <div className="mb-3 lg:w-3/5">
          <div className="mb-3 grid grid-cols-12 px-6 text-sand-500">
            <div className="col-span-6 block">Credit Lines</div>
            <div className="col-span-3 hidden justify-self-end md:block">
              Next Payment
            </div>
            <div className="col-span-6 block justify-self-end md:col-span-3">
              Due Date
            </div>
          </div>
          {tranchedPools.map(({ creditLine }) => {
            const id = creditLine.id;

            const creditLineLimit = formatCrypto({
              token: "USDC",
              amount: creditLine.maxLimit,
            });

            const interestRate = formatPercent(creditLine.interestAprDecimal);

            const nextPayment = formatCrypto({
              token: "USDC",
              amount: creditLine.remainingPeriodDueAmount,
            });

            const dueDateLabel = getDueDateLabel(creditLine as CreditLine);

            return (
              <div key={id}>
                <CreditLineCard
                  className="mb-3"
                  description={`${creditLineLimit} at ${interestRate}`}
                  nextPayment={nextPayment}
                  dueDateLabel={dueDateLabel}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
