import { gql } from "@apollo/client";
import clsx from "clsx";
import { format } from "date-fns";
import Image from "next/future/image";
import NextLink from "next/link";

import { Chip, ChipLink, Stat, StatGrid } from "@/components/design-system";
import { RichText } from "@/components/rich-text";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  BorrowerProfileFieldsFragment,
  BorrowerAllPoolFieldsFragment,
} from "@/lib/graphql/generated";
import {
  getLoanRepaymentStatus,
  LoanRepaymentStatus,
  REPAYMENT_STATUS_LOAN_FIELDS,
  sum,
} from "@/lib/pools";

export const BORROWER_OTHER_POOL_FIELDS = gql`
  ${REPAYMENT_STATUS_LOAN_FIELDS}
  fragment BorrowerAllPoolFields on TranchedPool {
    id
    name @client
    principalAmount
    termEndTime
    ...RepaymentStatusLoanFields
  }
`;

export const BORROWER_PROFILE_FIELDS = gql`
  fragment BorrowerProfileFields on Borrower {
    id
    name
    logo {
      url
    }
    orgType
    bio
    website
    twitter
    linkedin
  }
`;

interface BorrowerProfileProps {
  borrower: BorrowerProfileFieldsFragment;
  borrowerAllPools: BorrowerAllPoolFieldsFragment[];
  currentPoolAddress: string;
}

export function BorrowerProfile({
  borrower,
  borrowerAllPools,
  currentPoolAddress,
}: BorrowerProfileProps) {
  const otherPools = borrowerAllPools.filter(
    (pool) => pool.id !== currentPoolAddress
  );
  const numOtherPools = otherPools.length;
  const borrowerDefaultRate = 0; // TODO calculate this when we have proper off-chain writedown amounts per-pool
  const totalLoanPrincipal = sum("principalAmount", borrowerAllPools);
  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-xl bg-mustard-100 p-6">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-mustard-50">
              {borrower.logo?.url ? (
                <Image
                  alt={`${borrower.name} logo`}
                  src={borrower.logo.url}
                  quality={100}
                  sizes="40px"
                  fill
                />
              ) : null}
            </div>
            <div>
              <div className="font-medium">{borrower.name}</div>
              <div className="text-xs text-sand-500">{borrower.orgType}</div>
            </div>
          </div>
          <Chip
            iconLeft="Checkmark"
            colorScheme="mint"
            className="flex items-center gap-2"
          >
            Experienced borrower
          </Chip>
        </div>
        <RichText className="text-sm" content={borrower.bio} />
        <div className="flex flex-wrap gap-2">
          {borrower.website ? (
            <ChipLink
              iconLeft="Link"
              href={borrower.website}
              target="_blank"
              rel="noopener"
            >
              Website
            </ChipLink>
          ) : null}
          {borrower.linkedin ? (
            <ChipLink
              iconLeft="LinkedIn"
              href={borrower.linkedin}
              target="_blank"
              rel="noopener"
            >
              LinkedIn
            </ChipLink>
          ) : null}
          {borrower.twitter ? (
            <ChipLink
              iconLeft="Twitter"
              href={borrower.twitter}
              target="_blank"
              rel="noopener"
            >
              Twitter
            </ChipLink>
          ) : null}
        </div>
      </div>
      {numOtherPools > 0 ? (
        <StatGrid bgColor="mustard-50" numColumns={3}>
          <Stat
            label="Other deals"
            tooltip="[TODO] content"
            value={numOtherPools}
          />
          <Stat
            label="Total loss rate"
            tooltip="[TODO] content"
            value={formatPercent(borrowerDefaultRate)}
          />
          <Stat
            label="Total loan principal"
            tooltip="[TODO] content"
            value={formatCrypto({ token: "USDC", amount: totalLoanPrincipal })}
          />
          <div className="col-span-full bg-mustard-50">
            <table className="w-full text-xs [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3">
              <thead>
                <tr className="border-b border-sand-200 bg-white text-right [&>th]:font-normal">
                  <th scope="col" className="w-1/4 text-left">
                    Deal name
                  </th>
                  <th scope="col" className="w-1/4">
                    Loan principal
                  </th>
                  <th scope="col" className="w-1/4">
                    Maturity date
                  </th>
                  <th scope="col" className="w-1/4">
                    Repayment status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {otherPools.map((pool) => (
                  <tr
                    key={pool.id}
                    className="relative text-right hover:bg-white"
                  >
                    <td className="text-left">
                      <NextLink passHref href={`/pools/${pool.id}`}>
                        <a className="before:absolute before:inset-0">
                          {pool.name}
                        </a>
                      </NextLink>
                    </td>
                    <td>
                      {formatCrypto({
                        token: "USDC",
                        amount: pool.principalAmount,
                      })}
                    </td>
                    <td>
                      {format(
                        pool.termEndTime.toNumber() * 1000,
                        "MMM dd, yyyy"
                      )}
                    </td>
                    <td>
                      <RepaymentStatusChip
                        repaymentStatus={getLoanRepaymentStatus(pool)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StatGrid>
      ) : null}
    </div>
  );
}

function RepaymentStatusChip({
  repaymentStatus,
}: {
  repaymentStatus: LoanRepaymentStatus;
}) {
  return (
    <span
      className={clsx(
        "rounded-full border px-2 py-1 text-xs",
        repaymentStatus === LoanRepaymentStatus.Default
          ? "border-clay-200 bg-clay-100 text-clay-700"
          : repaymentStatus === LoanRepaymentStatus.Late
          ? "border-mustard-200 bg-mustard-100 text-mustard-700"
          : "border-mint-200 bg-mint-100 text-mint-700"
      )}
    >
      {repaymentStatus === LoanRepaymentStatus.Current
        ? "On time"
        : repaymentStatus === LoanRepaymentStatus.Late
        ? "Grace Period"
        : repaymentStatus === LoanRepaymentStatus.Default
        ? "Default"
        : repaymentStatus === LoanRepaymentStatus.NotDrawnDown
        ? "Not Drawn Down"
        : "Fully Repaid"}
    </span>
  );
}
