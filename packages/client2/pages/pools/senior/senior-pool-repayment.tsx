import { gql } from "@apollo/client";
import { format as formatDate } from "date-fns";
import Image from "next/future/image";
import { useMemo } from "react";

import { formatCrypto } from "@/lib/format";
import { SeniorPoolRepaymentFieldsFragment } from "@/lib/graphql/generated";
import {
  generateRepaymentSchedule,
  REPAYMENT_SCHEDULE_FIELDS,
} from "@/lib/pools";

export const SENIOR_POOL_REPAYMENTS_FIELDS = gql`
  ${REPAYMENT_SCHEDULE_FIELDS}
  fragment SeniorPoolRepaymentFields on SeniorPool {
    repayingPools: tranchedPools(
      orderBy: nextDueTime
      orderDirection: asc
      where: { nextDueTime_not: 0 }
    ) {
      id
      name @client
      borrowerLogo @client
      ...RepaymentScheduleFields
    }
  }
`;

interface SeniorPoolRepaymentSectionProps {
  seniorPool: SeniorPoolRepaymentFieldsFragment;
}

export function SeniorPoolRepaymentSection({
  seniorPool,
}: SeniorPoolRepaymentSectionProps) {
  const { repayingPools } = seniorPool;
  const allIncomingRepayments = useMemo(() => {
    const now = new Date();
    const beginningOfThisMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    const oneYearFromBeginningOfMonth = new Date(
      beginningOfThisMonth.getTime() + 3.154e7 * 1000
    );
    const allIncomingRepayments = repayingPools
      .flatMap((pool) =>
        generateRepaymentSchedule(pool).map((r) => ({
          ...r,
          name: pool.name,
          borrowerLogo: pool.borrowerLogo,
        }))
      )
      .filter(
        (repayment) =>
          repayment.estimatedPaymentDate >= beginningOfThisMonth.getTime() &&
          repayment.estimatedPaymentDate <=
            oneYearFromBeginningOfMonth.getTime()
      );
    allIncomingRepayments.sort(
      (a, b) => a.estimatedPaymentDate - b.estimatedPaymentDate
    );
    return allIncomingRepayments;
  }, [repayingPools]);
  return (
    <div className="overflow-hidden rounded-lg border border-sand-300">
      <div className="py-8 px-6">chart goes here</div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-xs [&_th]:px-3.5 [&_th]:py-2 [&_th]:font-normal [&_td]:px-3.5 [&_td]:py-2">
          <thead>
            <tr className="sticky top-0 z-10 bg-mustard-100">
              <th scope="col" className="text-left">
                Source
              </th>
              <th scope="col" className="text-left">
                Payment date
              </th>
              <th scope="col" className="text-right">
                Amount expected
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-300">
            {allIncomingRepayments.map(
              (
                {
                  name,
                  borrowerLogo,
                  estimatedPaymentDate,
                  principal,
                  interest,
                },
                index
              ) => (
                <tr key={index}>
                  <td className="flex items-center gap-1 text-left">
                    {borrowerLogo ? (
                      <div className="relative h-3 w-3 overflow-hidden rounded-full">
                        <Image src={borrowerLogo} fill sizes="12px" alt="" />
                      </div>
                    ) : null}
                    <span>{name}</span>
                  </td>
                  <td className="text-left">
                    {formatDate(estimatedPaymentDate, "MMM d, y")}
                  </td>
                  <td className="text-right">
                    {formatCrypto({
                      token: "USDC",
                      amount: principal.add(interest),
                    })}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
