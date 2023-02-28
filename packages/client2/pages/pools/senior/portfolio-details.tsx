import { gql } from "graphql-request";
import Image from "next/future/image";

import { Button, Stat, StatGrid, Link } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SeniorPoolPortfolioDetailsFieldsFragment,
  SeniorPoolPortfolioPoolsDealsFieldsFragment,
} from "@/lib/graphql/generated";
import { PortfolioCurrentDistribution } from "@/pages/pools/senior/portfolio-current-distribution";

export const SENIOR_POOL_PORTFOLIO_DETAILS_FIELDS = gql`
  fragment SeniorPoolPortfolioDetailsFields on SeniorPool {
    name @client
    category @client
    icon @client
    defaultRate
    totalLoansOutstanding
    tranchedPools(
      orderBy: actualSeniorPoolInvestment
      orderDirection: desc
      # Active pools with contributions to SP
      where: {
        balance_gt: 0
        termEndTime_gt: 0
        actualSeniorPoolInvestment_gt: 0
      }
    ) {
      id
      balance
      termEndTime
      actualSeniorPoolInvestment
      isLate @client
      isInDefault @client
    }
  }
`;

export const SENIOR_POOL_PORTFOLIO_POOLS_DEALS_FIELDS = gql`
  fragment SeniorPoolPortfolioPoolsDealsFields on Deal {
    id
    name
    category
    dealType
    borrower {
      id
      name
      logo {
        url
      }
    }
  }
`;

interface PortfolioDetailsProps {
  seniorPool?: SeniorPoolPortfolioDetailsFieldsFragment;
  dealMetadata?: Record<string, SeniorPoolPortfolioPoolsDealsFieldsFragment>;
}

export function PortfolioDetails({
  seniorPool,
  dealMetadata,
}: PortfolioDetailsProps) {
  if (!seniorPool || !dealMetadata) {
    return null;
  }

  return (
    <>
      <div className="mb-6 rounded-xl bg-mustard-100 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-mustard-300">
              <Image
                src={seniorPool.icon}
                alt={`${seniorPool.name} icon`}
                fill
                className="object-contain"
              />
            </div>
            <div className="ml-3.5 flex flex-col">
              <div className="mb-0.5 font-medium">{seniorPool.name}</div>
              <div className="text-xs text-sand-500">{seniorPool.category}</div>
            </div>
          </div>
          <Button
            as="a"
            colorScheme="secondary"
            variant="rounded"
            iconRight="ArrowTopRight"
            className="mr-1.5"
            target="_blank"
            rel="noopener"
            // TODO: Zadra get real link
            href={"https://google.ca"}
          >
            Read more
          </Button>
        </div>
        <div className="mb-5 text-sm">
          The Goldfinch Senior Pool is automatically managed by The Goldfinch
          protocol. Capital is automatically allocated from The Goldfinch Senior
          Pool across the senior tranches (second-loss) of tranched Goldfinch
          direct-lending deals according to the{" "}
          <Link
            openInNewTab
            href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/leveragemodel"
          >
            Leverage Model
          </Link>
          .
        </div>
        <div className="flex">
          <Button
            as="a"
            colorScheme="secondary"
            variant="rounded"
            iconLeft="Link"
            className="mr-2"
            target="_blank"
            rel="noopener"
            // TODO: Zadra get real link
            href={"https://google.ca"}
          >
            Website
          </Button>
          <Button
            as="a"
            colorScheme="secondary"
            variant="rounded"
            iconLeft="LinkedIn"
            className="mr-2"
            target="_blank"
            rel="noopener"
            // TODO: Zadra get real link
            href={"https://google.ca"}
          >
            LinkedIn
          </Button>
          <Button
            as="a"
            colorScheme="secondary"
            variant="rounded"
            iconLeft="Twitter"
            className="mr-2"
            target="_blank"
            rel="noopener"
            // TODO: Zadra get real link
            href={"https://google.ca"}
          >
            Twitter
          </Button>
        </div>
      </div>
      <StatGrid className="mb-6" bgColor="mustard-50" borderColor="sand-300">
        <Stat
          label="No. of portfolio loans"
          value={seniorPool.tranchedPools.length}
          // TODO: Zadra get tooltip content
          tooltip="TODO: No. of portfolio loans"
        />
        <Stat
          label="Default Rate"
          value={formatPercent(seniorPool.defaultRate)}
          tooltip="The total default rate across all Borrower Pools on the Goldfinch protocol, calculated as the current total writedown value divided by the total loan value."
        />
        <Stat
          label="Principal outstanding"
          value={formatCrypto({
            token: "USDC",
            amount: seniorPool.totalLoansOutstanding,
          })}
          tooltip="The total value of Senior Pool capital currently deployed in active Borrower Pools across the protocol."
        />
      </StatGrid>
      <PortfolioCurrentDistribution
        seniorPool={seniorPool}
        dealMetadata={dealMetadata}
      />
    </>
  );
}
