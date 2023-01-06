import { gql } from "@apollo/client";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers";
import { GetStaticPaths, GetStaticProps } from "next";

import { Button, Heading, Icon } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { apolloClient } from "@/lib/graphql/apollo";
import {
  AllDealsQuery,
  PoolCreditLinePageCmsQuery,
  PoolCreditLinePageCmsQueryVariables,
  usePoolCreditLinePageQuery,
} from "@/lib/graphql/generated";
import { openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";
import { TRANCHED_POOL_BORROW_CARD_DEAL_FIELDS } from "@/pages/borrow/credit-line-card";
import {
  calculateInterestOwed,
  calculateRemainingPeriodDueAmount,
  calculateRemainingTotalDueAmount,
  CreditLineStatus,
  getCreditLineStatus,
} from "@/pages/borrow/helpers";

import { CreditLineProgressBar } from "./credit-status-progress-bar";

gql`
  query PoolCreditLinePage($tranchedPoolId: ID!) {
    tranchedPool(id: $tranchedPoolId) {
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
        termInDays
        paymentPeriodInDays
        isLate @client
        collectedPaymentBalance @client
      }
    }
  }
`;

const poolCreditLineCmsQuery = gql`
  ${TRANCHED_POOL_BORROW_CARD_DEAL_FIELDS}
  query PoolCreditLinePageCMS($id: String!) @api(name: cms) {
    Deal(id: $id) {
      ...TranchedPoolBorrowCardFields
    }
  }
`;

interface PoolCreditLinePageProps {
  dealDetails: NonNullable<PoolCreditLinePageCmsQuery["Deal"]>;
}

const getNextPaymentLabel = ({
  creditLineStatus,
  nextDueTime,
  remainingPeriodDueAmount,
}: {
  creditLineStatus: CreditLineStatus;
  nextDueTime: BigNumber;
  remainingPeriodDueAmount: BigNumber;
}) => {
  const formattedRemainingPeriodDueAmount = formatCrypto({
    token: "USDC",
    amount: remainingPeriodDueAmount,
  });

  const formattedNextDueTime = formatDate(
    nextDueTime.toNumber() * 1000,
    "MMM d"
  );

  switch (creditLineStatus) {
    case CreditLineStatus.PaymentLate:
      return `${formattedRemainingPeriodDueAmount} due now`;
    case CreditLineStatus.PaymentDue:
      return `${formattedRemainingPeriodDueAmount} due ${formattedNextDueTime}`;
    case CreditLineStatus.PeriodPaid:
      return (
        <div className="align-left flex flex-row items-center">
          <Icon name="CheckmarkCircle" size="lg" className="mr-1" />
          <div>{`Paid through ${formattedNextDueTime}`}</div>
        </div>
      );
    case CreditLineStatus.InActive:
      return "No payment due";
  }
};

export default function PoolCreditLinePage({
  dealDetails,
}: PoolCreditLinePageProps) {
  const { account, isActivating } = useWallet();

  const { data, error, loading } = usePoolCreditLinePageQuery({
    variables: {
      tranchedPoolId: dealDetails?.id as string,
    },
  });

  const tranchedPool = data?.tranchedPool;
  const creditLine = tranchedPool?.creditLine;

  let nextPaymentLabel;
  let creditLineStatus;

  // TODO remove
  const balanceWithInterest = {
    token: "USDC",
    amount: BigNumber.from("0"),
    // amount: BigNumber.from("5020550000"),
  } as const;
  const availableToDrawdown = {
    token: "USDC",
    amount: BigNumber.from("0"),
    // amount: BigNumber.from("5000000000"),
  } as const;

  if (tranchedPool && creditLine) {
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

    creditLineStatus = getCreditLineStatus({
      isLate: creditLine.isLate,
      remainingPeriodDueAmount,
      limit: creditLine.limit,
      remainingTotalDueAmount,
    });

    nextPaymentLabel = getNextPaymentLabel({
      creditLineStatus,
      remainingPeriodDueAmount,
      nextDueTime: creditLine.nextDueTime,
    });
  }

  return (
    <div>
      <Heading level={1} className="mb-12 break-words">
        {dealDetails.name}
      </Heading>

      <Heading
        as="h2"
        level={4}
        className="mb-10 !font-serif !text-[2.5rem] !font-bold"
      >
        {dealDetails.category}
      </Heading>

      {!account && !isActivating ? (
        <div className="text-lg font-medium text-clay-500">
          You must connect your wallet to view your credit line
          <div className="mt-3">
            <Button size="xl" onClick={openWalletModal}>
              Connect Wallet
            </Button>
          </div>
        </div>
      ) : loading || isActivating ? (
        <div className="text-xl">Loading...</div>
      ) : error || !tranchedPool || !creditLine ? (
        <div className="text-2xl">Unable to load credit line</div>
      ) : (
        <div className="flex flex-col">
          <div className="mb-10 grid grid-cols-2 rounded-xl bg-sand-100">
            <div className="border-r-2 border-sand-200 p-8">
              <div className="mb-1 text-lg">Available to borrow</div>
              <div className="mb-5 text-2xl">$5,000.00</div>
              <Button
                as="button"
                className="w-full text-xl"
                size="xl"
                iconSize="lg"
                iconLeft="ArrowDown"
                colorScheme="mustard"
              >
                Borrow
              </Button>
            </div>
            <div className="p-8">
              <div className="mb-1 text-lg">Next Payment</div>
              <div className="mb-5 text-2xl">{nextPaymentLabel}</div>
              <Button
                as="button"
                className="w-full text-xl"
                size="xl"
                iconSize="lg"
                iconLeft="ArrowUp"
                colorScheme="eggplant"
                disabled={creditLineStatus === CreditLineStatus.InActive}
              >
                Pay
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-sand-100">
            {/* Part 1 */}
            <div className="border-b-2 border-sand-200 p-8">
              {/* Credit Status */}
              <div className="grid grid-cols-2">
                <div className="mb-5 text-2xl">Credit Status</div>
              </div>

              {/* Progress Bar */}
              <CreditLineProgressBar
                className="h-3.5"
                balanceWithInterest={balanceWithInterest}
                availableToDrawDown={availableToDrawdown}
              />

              {/* $ Available & $ Drawdown */}
              <div className="mt-3 grid grid-cols-2">
                <div>
                  <div className="text-2xl">$5,000.00</div>
                  <div className="text-lg">Available to borrow</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl">$5,000.00</div>
                  <div className="text-lg">Available to drawdown</div>
                </div>
              </div>

              {/* Full Balance repayment due: */}
              {creditLineStatus !== CreditLineStatus.InActive && (
                <div className="mt-8 flex items-center">
                  <Icon name="Clock" className="mr-2" />
                  <div className="text-lg">
                    {`Full balance repayment due ${formatDate(
                      creditLine.termEndTime.toNumber() * 1000,
                      "MMM d, yyyy"
                    )}`}
                  </div>
                </div>
              )}
            </div>

            {/* Part 2 */}
            <div className="p-8">
              <div className="grid grid-cols-3 gap-y-8">
                <div>
                  <div className="mb-0.5 text-2xl">
                    {formatCrypto({
                      token: "USDC",
                      amount: creditLine.maxLimit,
                    })}
                  </div>
                  <div className="text-sand-500">Limit</div>
                </div>
                <div>
                  <div className="mb-0.5 text-2xl">
                    {formatPercent(creditLine.interestAprDecimal)}
                  </div>
                  <div className="text-sand-500">Interest rate APR</div>
                </div>
                <div>
                  <div className="mb-0.5 text-2xl">
                    {creditLine.paymentPeriodInDays.toString()}
                  </div>
                  <div className="text-sand-500">Payment frequency</div>
                </div>
                <div>
                  <div className="mb-0.5 text-2xl">
                    {creditLine.termInDays.toString()}
                  </div>
                  <div className="text-sand-500">Payback term</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const allDealsQuery = gql`
  query AllDeals @api(name: cms) {
    Deals(limit: 100) {
      docs {
        id
      }
    }
  }
`;

export const getStaticPaths: GetStaticPaths<{ address: string }> = async () => {
  const res = await apolloClient.query<AllDealsQuery>({
    query: allDealsQuery,
  });

  const paths =
    res.data.Deals?.docs?.map((pool) => ({
      params: {
        address: pool?.id || "",
      },
    })) || [];

  return {
    paths,
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<
  PoolCreditLinePageProps,
  { address: string }
> = async (context) => {
  const address = context.params?.address;
  if (!address) {
    throw new Error("No address param in getStaticProps");
  }
  const res = await apolloClient.query<
    PoolCreditLinePageCmsQuery,
    PoolCreditLinePageCmsQueryVariables
  >({
    query: poolCreditLineCmsQuery,
    variables: {
      id: address,
    },
    fetchPolicy: "network-only",
  });

  const poolDetails = res.data.Deal;
  if (!poolDetails) {
    return { notFound: true };
  }

  return {
    props: {
      dealDetails: poolDetails,
    },
  };
};
