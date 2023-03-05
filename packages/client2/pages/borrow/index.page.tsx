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
  CreditLineStatus,
  CREDIT_LINE_ACCOUNTING_FIELDS,
  getCreditLineAccountingAnalyisValues,
} from "./helpers";

gql`
  ${CREDIT_LINE_ACCOUNTING_FIELDS}
  query BorrowPage($userId: String!) {
    tranchedPools(
      where: { borrowerContract_: { user: $userId } }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      creditLine {
        id
        interestAprDecimal
        ...CreditLineAccountingFields
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
    default:
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

  const tranchedPools = data?.tranchedPools ?? [];

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
          <div className="mb-3 grid grid-cols-12 gap-6 whitespace-nowrap px-6 text-sand-500">
            <div className="col-span-6 block lg:col-span-4">Pool</div>
            <div className="col-span-3 hidden justify-self-end lg:block">
              Credit Line
            </div>
            <div className="col-span-2 hidden justify-self-end lg:block">
              Next Payment
            </div>
            <div className="col-span-2 hidden justify-self-end lg:block">
              Status
            </div>
            <div className="col-span-6 block justify-self-end lg:col-span-1">
              Due Date
            </div>
          </div>
          {tranchedPools.map((tranchedPool) => {
            const { creditLine } = tranchedPool;

            const {
              creditLineLimit,
              remainingPeriodDueAmount,
              creditLineStatus,
            } = getCreditLineAccountingAnalyisValues(creditLine);

            const dueDateLabel = getDueDateLabel({
              creditLineStatus,
              nextDueTime: creditLine.nextDueTime,
            });

            const nextPayment = formatCrypto({
              token: "USDC",
              amount: remainingPeriodDueAmount,
            });

            return (
              <div key={creditLine.id}>
                <CreditLineCard
                  className="mb-4"
                  href={`/borrow/${tranchedPool.id}`}
                  dealMetaData={dealMetadata[tranchedPool.id]}
                  description={`${formatCrypto({
                    amount: creditLineLimit,
                    token: "USDC",
                  })} at ${formatPercent(creditLine.interestAprDecimal)}`}
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
