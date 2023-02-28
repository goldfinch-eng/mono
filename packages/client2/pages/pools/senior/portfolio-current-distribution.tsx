import { format as formatDate } from "date-fns";
import { BigNumber, FixedNumber } from "ethers/lib/ethers";
import Image from "next/future/image";
import { useState } from "react";

import { Chip } from "@/components/design-system";
import { DropdownMenu } from "@/components/design-system/dropdown-menu";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SeniorPoolPortfolioDetailsFieldsFragment,
  SeniorPoolPortfolioPoolsDealsFieldsFragment,
} from "@/lib/graphql/generated";
import { getLoanRepaymentStatus, LoanRepaymentStatus } from "@/lib/pools";

interface PortfolioCurrentDistributionProps {
  seniorPool: SeniorPoolPortfolioDetailsFieldsFragment;
  dealMetadata: Record<string, SeniorPoolPortfolioPoolsDealsFieldsFragment>;
}

function PoolStatus({
  poolRepaymentStatus,
}: {
  poolRepaymentStatus: LoanRepaymentStatus;
}) {
  switch (poolRepaymentStatus) {
    case LoanRepaymentStatus.Late:
      return (
        <Chip colorScheme="mustard" size="sm">
          Grace Period
        </Chip>
      );
    case LoanRepaymentStatus.Current:
      return (
        <Chip colorScheme="dark-mint" size="sm">
          On Time
        </Chip>
      );
    case LoanRepaymentStatus.Default:
      return (
        <Chip colorScheme="yellow" size="sm">
          Default
        </Chip>
      );
    default:
      return null;
  }
}

enum DISTRIBUTION_GROUP_BY_CRITERIA {
  BY_DEAL,
  BY_BORROWER,
}

const options = [
  { value: DISTRIBUTION_GROUP_BY_CRITERIA.BY_DEAL, label: "by Deal" },
  { value: DISTRIBUTION_GROUP_BY_CRITERIA.BY_BORROWER, label: "by Borrower" },
];

interface PoolTableData {
  dealName?: string;
  icon?: string | null;
  portfolioShare: FixedNumber;
  capitalOwed: BigNumber;
  termEndTime?: BigNumber;
  poolRepaymentStatus?: LoanRepaymentStatus;
}
[];

const getTableDataByDeal = (
  dealMetadata: Record<string, SeniorPoolPortfolioPoolsDealsFieldsFragment>,
  seniorPool: SeniorPoolPortfolioDetailsFieldsFragment,
  totalSeniorPoolFundsCurrentlyInvested: BigNumber
) => {
  const poolTableData: PoolTableData[] = [];

  for (const pool of seniorPool.tranchedPools) {
    const dealDetails = dealMetadata[pool.id];

    const poolRepaymentStatus = getLoanRepaymentStatus(pool);

    const actualSeniorPoolInvestment =
      pool.actualSeniorPoolInvestment as BigNumber;

    const portfolioShare = FixedNumber.from(
      actualSeniorPoolInvestment
    ).divUnsafe(FixedNumber.from(totalSeniorPoolFundsCurrentlyInvested));

    poolTableData.push({
      dealName: dealDetails.name,
      icon: dealDetails.borrower.logo?.url,
      portfolioShare,
      capitalOwed: actualSeniorPoolInvestment,
      termEndTime: pool.termEndTime,
      poolRepaymentStatus,
    });
  }

  return poolTableData;
};

const getTableDataByBorrower = (
  dealMetadata: Record<string, SeniorPoolPortfolioPoolsDealsFieldsFragment>,
  seniorPool: SeniorPoolPortfolioDetailsFieldsFragment,
  totalSeniorPoolFundsCurrentlyInvested: BigNumber
) => {
  const dealDataByBorrowerId: Record<string, PoolTableData> = {};

  for (const pool of seniorPool.tranchedPools) {
    const deal = dealMetadata[pool.id];
    const borrowerId = deal.borrower.id;

    const actualSeniorPoolInvestment =
      pool.actualSeniorPoolInvestment as BigNumber;

    if (borrowerId) {
      if (!dealDataByBorrowerId[borrowerId]) {
        dealDataByBorrowerId[borrowerId] = {
          dealName: deal.borrower.name,
          icon: deal.borrower.logo?.url,
          portfolioShare: FixedNumber.from(
            actualSeniorPoolInvestment
          ).divUnsafe(FixedNumber.from(totalSeniorPoolFundsCurrentlyInvested)),
          capitalOwed: actualSeniorPoolInvestment,
        };
      } else {
        const currentPoolTableData = dealDataByBorrowerId[borrowerId];

        dealDataByBorrowerId[borrowerId] = {
          ...currentPoolTableData,
          portfolioShare: FixedNumber.from(
            actualSeniorPoolInvestment.add(currentPoolTableData.capitalOwed)
          ).divUnsafe(FixedNumber.from(totalSeniorPoolFundsCurrentlyInvested)),
          capitalOwed: actualSeniorPoolInvestment.add(
            currentPoolTableData.capitalOwed
          ),
        };
      }
    }
  }

  return Object.values(dealDataByBorrowerId);
};

export function PortfolioCurrentDistribution({
  seniorPool,
  dealMetadata,
}: PortfolioCurrentDistributionProps) {
  const [distributionGroupByCriteria, setDistributionGroupByCriteria] =
    useState(options[0]);

  const totalSeniorPoolFundsCurrentlyInvested = seniorPool.tranchedPools.reduce(
    (sum, { actualSeniorPoolInvestment }) =>
      sum.add(actualSeniorPoolInvestment as BigNumber),
    BigNumber.from(0)
  );

  const tableData =
    distributionGroupByCriteria.value === DISTRIBUTION_GROUP_BY_CRITERIA.BY_DEAL
      ? getTableDataByDeal(
          dealMetadata,
          seniorPool,
          totalSeniorPoolFundsCurrentlyInvested
        )
      : getTableDataByBorrower(
          dealMetadata,
          seniorPool,
          totalSeniorPoolFundsCurrentlyInvested
        );

  return (
    <div className="rounded-xl border border-sand-300">
      <div className="flex justify-between p-6">
        <div className="text-sm">Current distribution</div>
        <DropdownMenu
          options={options}
          selectedOption={distributionGroupByCriteria}
          onSelect={(option) => setDistributionGroupByCriteria(option)}
        />
      </div>

      <table className="w-full text-xs [&_th]:px-3.5 [&_th]:py-2 [&_th]:font-normal [&_td]:px-3.5 [&_td]:py-2">
        <thead>
          <tr className="border-b border-sand-300 bg-mustard-100">
            <th scope="col" className="w-[30%] text-left">
              Deal name
            </th>
            <th scope="col" className="w-[17.5%] text-right">
              Portfolio share
            </th>
            <th scope="col" className="w-[17.5%] text-right">
              Capital owed
            </th>
            <th scope="col" className="w-[17.5%] text-right">
              Maturity date
            </th>
            <th scope="col" className="w-[17.5%] text-right">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-300">
          {tableData?.map(
            ({
              dealName,
              icon,
              portfolioShare,
              capitalOwed,
              termEndTime,
              poolRepaymentStatus,
            }) => {
              return (
                <tr key={dealName} className="h-[2.9rem]">
                  <td className="w-[30%] max-w-0 text-left">
                    <div className="flex items-center">
                      <div className="relative mr-1.5 h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full border border-sand-200 bg-sand-200">
                        {icon ? (
                          <Image
                            src={icon}
                            alt={`${dealName}`}
                            className="object-cover"
                            fill
                          />
                        ) : null}
                      </div>
                      <div className="truncate">{dealName}</div>
                    </div>
                  </td>
                  <td className="text-right">
                    {formatPercent(portfolioShare.toUnsafeFloat())}
                  </td>
                  <td className="text-right">
                    {formatCrypto({
                      amount: capitalOwed,
                      token: "USDC",
                    })}
                  </td>
                  <td className="text-right">
                    {termEndTime
                      ? formatDate(
                          termEndTime.toNumber() * 1000,
                          "MMM dd, yyyy"
                        )
                      : "-"}
                  </td>
                  <td className="text-right">
                    {poolRepaymentStatus ? (
                      <PoolStatus poolRepaymentStatus={poolRepaymentStatus} />
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}
