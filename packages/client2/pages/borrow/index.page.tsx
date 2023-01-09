import { gql } from "@apollo/client";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers";
import { GetStaticProps, InferGetStaticPropsType } from "next";

import { Button, Heading, Icon } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { apolloClient } from "@/lib/graphql/apollo";
import {
  BorrowPageCmsQuery,
  useBorrowPageQuery,
} from "@/lib/graphql/generated";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";

import {
  CreditLineCard,
  TRANCHED_POOL_BORROW_CARD_DEAL_FIELDS,
} from "./credit-line-card";
import {
  calculateInterestOwed,
  calculateRemainingPeriodDueAmount,
  calculateRemainingTotalDueAmount,
  CreditLineStatus,
  getCreditLineStatus,
} from "./helpers";

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
            interestAprDecimal
            interestApr
            interestAccruedAsOf
            interestOwed
            nextDueTime
            limit
            maxLimit
            termEndTime
            isLate @client
            collectedPaymentBalance @client
          }
        }
      }
    }
  }
`;

const borrowCmsQuery = gql`
  ${TRANCHED_POOL_BORROW_CARD_DEAL_FIELDS}
  query BorrowPageCMS @api(name: cms) {
    Deals(limit: 100, where: { hidden: { not_equals: true } }) {
      docs {
        ...TranchedPoolBorrowCardFields
      }
    }
  }
`;

const getDueDateLabel = ({
  creditLineStatus,
  nextDueTime,
}: {
  creditLineStatus: CreditLineStatus;
  nextDueTime: BigNumber;
}) => {
  switch (creditLineStatus) {
    case CreditLineStatus.PaymentLate:
      return "Due Now";
    case CreditLineStatus.PaymentDue:
      return formatDate(nextDueTime.toNumber() * 1000, "MMM d");
    case CreditLineStatus.PeriodPaid:
      return (
        <div className="align-left flex flex-row items-center">
          <Icon name="CheckmarkCircle" size="md" className="mr-1" />
          <div>Paid</div>
        </div>
      );
    case CreditLineStatus.InActive:
      return "N/A";
  }
};

export default function BorrowPage({
  dealMetadata,
}: InferGetStaticPropsType<typeof getStaticProps>) {
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
        Credit Lines
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
        <div className="w-fit rounded-xl border border-tidepool-200 bg-tidepool-100 p-5">
          <div className="text-xl">
            You do not have any credit lines. To borrow funds from the pool, you
            need a Goldfinch credit line.
          </div>
        </div>
      ) : (
        <div className="mb-3 ">
          <div className="mb-3 grid grid-cols-12 gap-6 px-6 text-sand-500">
            <div className="col-span-6 block md:col-span-5">Pool</div>
            <div className="col-span-3 hidden justify-self-end md:block">
              Credit Line
            </div>
            <div className="col-span-2 hidden justify-self-end md:block">
              Next Payment
            </div>
            <div className="col-span-1 hidden justify-self-end md:block">
              Status
            </div>
            <div className="col-span-6 block justify-self-end md:col-span-1">
              Due Date
            </div>
          </div>
          {tranchedPools.map((tranchedPool) => {
            const { creditLine } = tranchedPool;
            const id = creditLine.id;

            const creditLineLimit = formatCrypto({
              token: "USDC",
              amount: creditLine.maxLimit,
            });

            const currentInterestOwed = calculateInterestOwed({
              isLate: creditLine.isLate,
              interestOwed: creditLine.interestOwed,
              interestApr: creditLine.interestApr,
              nextDueTime: creditLine.nextDueTime,
              interestAccruedAsOf: creditLine.interestAccruedAsOf,
              balance: creditLine.balance,
            });

            const remainingPeriodDueAmount = calculateRemainingPeriodDueAmount({
              collectedPaymentBalance: creditLine.collectedPaymentBalance,
              nextDueTime: creditLine.nextDueTime,
              termEndTime: creditLine.termEndTime,
              balance: creditLine.balance,
              currentInterestOwed,
            });

            const remainingTotalDueAmount = calculateRemainingTotalDueAmount({
              collectedPaymentBalance: creditLine.collectedPaymentBalance,
              balance: creditLine.balance,
              currentInterestOwed,
            });

            const creditLineStatus = getCreditLineStatus({
              isLate: creditLine.isLate,
              remainingPeriodDueAmount,
              limit: creditLine.limit,
              remainingTotalDueAmount,
            });

            const dueDateLabel = getDueDateLabel({
              creditLineStatus,
              nextDueTime: creditLine.nextDueTime,
            });

            const nextPayment = formatCrypto({
              token: "USDC",
              amount: remainingPeriodDueAmount,
            });

            const formattedInterestRate = formatPercent(
              creditLine.interestAprDecimal
            );

            return (
              <div key={id}>
                <CreditLineCard
                  className="mb-4"
                  href={`/borrow/${tranchedPool.id}`}
                  dealMetaData={dealMetadata[tranchedPool.id]}
                  description={`${creditLineLimit} at ${formattedInterestRate}`}
                  status={creditLineStatus}
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

export const getStaticProps: GetStaticProps = async () => {
  const res = await apolloClient.query<BorrowPageCmsQuery>({
    query: borrowCmsQuery,
    fetchPolicy: "network-only",
  });

  const deals = res.data.Deals?.docs;
  if (!deals) {
    throw new Error("No metadata found for any deals");
  }

  const dealMetadata: Record<
    string,
    NonNullable<
      NonNullable<NonNullable<BorrowPageCmsQuery["Deals"]>["docs"]>[number]
    >
  > = {};
  deals.forEach((d) => {
    if (d && d.id) {
      dealMetadata[d.id] = d;
    }
  });

  return {
    props: {
      dealMetadata,
    },
  };
};
