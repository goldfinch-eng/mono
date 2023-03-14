import { gql } from "@apollo/client";
import { Menu } from "@headlessui/react";
import { format as formatDate } from "date-fns";
import Image from "next/future/image";
import { useMemo, useState } from "react";
import {
  BarChart,
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  TooltipProps,
  Legend,
} from "recharts";
import { ContentType } from "recharts/types/component/DefaultLegendContent";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

import { Icon, Link } from "@/components/design-system";
import { cryptoToFloat, formatCrypto, formatFiat } from "@/lib/format";
import { SeniorPoolRepaymentFieldsFragment } from "@/lib/graphql/generated";

const tickFormatter = new Intl.NumberFormat("en-US");

export const SENIOR_POOL_REPAYMENTS_FIELDS = gql`
  fragment SeniorPoolRepaymentFields on SeniorPool {
    repayingPools: tranchedPools(
      orderBy: nextDueTime
      orderDirection: asc
      where: { nextDueTime_not: 0 }
    ) {
      id
      name @client
      borrowerLogo @client
      repaymentSchedule(orderBy: paymentPeriod, first: 1000) {
        id
        paymentPeriod
        estimatedPaymentDate
        interest
        principal
      }
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
  const [perspective, setPerspective] = useState<"past" | "future">("past");
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
    const endOfThisMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      0,
      0,
      0,
      -1
    );
    const oneYearFromBeginningOfMonth = new Date(
      beginningOfThisMonth.getTime() + 3.154e7 * 1000
    );
    const allIncomingRepayments = repayingPools
      .flatMap((pool) =>
        pool.repaymentSchedule.map((r) => ({
          interest: r.interest,
          principal: r.principal,
          estimatedPaymentDate: r.estimatedPaymentDate * 1000,
          name: pool.name,
          borrowerLogo: pool.borrowerLogo,
          href: `/pools/${pool.id}`,
        }))
      )
      .filter((repayment) => {
        if (perspective === "future") {
          return (
            repayment.estimatedPaymentDate >= beginningOfThisMonth.getTime() &&
            repayment.estimatedPaymentDate <=
              oneYearFromBeginningOfMonth.getTime()
          );
        } else {
          return repayment.estimatedPaymentDate < endOfThisMonth.getTime();
        }
      });
    allIncomingRepayments.sort(
      (a, b) => a.estimatedPaymentDate - b.estimatedPaymentDate
    );
    return allIncomingRepayments;
  }, [repayingPools, perspective]);

  const chartData = useMemo(() => {
    const now = new Date();
    const buckets = allIncomingRepayments.reduce((buckets, current) => {
      const date = new Date(current.estimatedPaymentDate);
      const key = `${date.getMonth()}-${date.getFullYear()}`;
      if (!buckets[key]) {
        buckets[key] = {
          period: formatDate(date, "MMM yy"),
          timestamp: date.getTime(),
          amount: 0,
          futureAmount: 0,
        };
      }
      if (current.estimatedPaymentDate <= now.getTime()) {
        buckets[key].amount =
          buckets[key].amount +
          cryptoToFloat({
            token: "USDC",
            amount: current.interest.add(current.principal),
          });
      } else {
        buckets[key].futureAmount =
          buckets[key].futureAmount +
          cryptoToFloat({
            token: "USDC",
            amount: current.interest.add(current.principal),
          });
      }

      return buckets;
    }, {} as Record<string, { period: string; amount: number; futureAmount: number; timestamp: number }>);
    return Object.values(buckets);
  }, [allIncomingRepayments]);

  return (
    <div className="overflow-hidden rounded-lg border border-sand-300">
      <div className="px-6 pt-8">
        <div>
          <Menu as="div" className="relative mb-2">
            <Menu.Button className="flex items-center gap-2 text-xs font-medium">
              {perspective === "future"
                ? "Future repayments"
                : "Past repayments"}
              <Icon name="ChevronDown" />
            </Menu.Button>
            <Menu.Items className="absolute left-0 z-10 mt-1 flex flex-col rounded-md bg-white text-xs">
              <Menu.Item>
                <button
                  className="block px-3 py-3 text-left hover:bg-sand-50"
                  onClick={() => setPerspective("past")}
                >
                  Past repayments
                </button>
              </Menu.Item>
              <Menu.Item>
                <button
                  className="block px-3 py-3 text-left hover:bg-sand-50"
                  onClick={() => setPerspective("future")}
                >
                  Future repayments
                </button>
              </Menu.Item>
            </Menu.Items>
          </Menu>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 20 }}>
            <Legend
              content={CustomChartLegend}
              wrapperStyle={{ top: "-1.5rem", right: 0, width: "max-content" }}
            />
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: "8px" }}
              interval={perspective === "future" ? 0 : 1}
              padding={{ left: 36 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              mirror
              type="number"
              tick={{ fontSize: "8px", dx: -8, dy: -6, textAnchor: "start" }}
              tickFormatter={(value) => tickFormatter.format(value)}
            />
            <Tooltip content={<CustomChartTooltip />} />
            <Bar dataKey="amount" fill="#65C397" stroke="#65C397" stackId="a" />
            <Bar
              dataKey="futureAmount"
              fill="rgba(178, 225, 203, 0.35)"
              stroke="#65C397"
              stackId="a"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-xs [&_th]:px-3.5 [&_th]:py-2 [&_th]:font-normal [&_td]:px-3.5 [&_td]:py-3">
          <thead>
            <tr className="sticky top-0 z-10 bg-mustard-100">
              <th scope="col" className="w-1/2 text-left">
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
                  href,
                  borrowerLogo,
                  estimatedPaymentDate,
                  principal,
                  interest,
                },
                index
              ) => (
                <tr key={index} className="relative">
                  <td className="w-1/2 max-w-0 !pr-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <div className="relative h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full border border-sand-200 bg-sand-200">
                        {borrowerLogo ? (
                          <Image src={borrowerLogo} fill sizes="12px" alt="" />
                        ) : null}
                      </div>
                      <Link
                        className="!block truncate !no-underline before:absolute before:inset-0 hover:!underline"
                        href={href}
                      >
                        {name}
                      </Link>
                    </div>
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

function CustomChartTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (active && payload) {
    const pastDataPoint = payload[0];
    const futureDataPoint = payload[1];
    return (
      <div className="rounded-lg bg-white p-2 text-xs shadow-lg outline-none">
        <div className="mb-1 font-medium">
          {formatDate(pastDataPoint.payload.timestamp, "MMMM yyyy")}
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: pastDataPoint.color,
              border: `1px solid ${pastDataPoint.color}`,
            }}
          />
          <div>
            Expected past repayment:{" "}
            {formatFiat({
              amount: pastDataPoint.payload.amount,
              symbol: "USD",
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: futureDataPoint.color,
              border: `1px solid ${pastDataPoint.color}`,
            }}
          />
          <div>
            Expected future repayment:{" "}
            {formatFiat({
              amount: futureDataPoint.payload.futureAmount,
              symbol: "USD",
            })}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

const CustomChartLegend: ContentType = ({ payload }) => {
  return (
    <div className="flex gap-4">
      {payload?.map(({ value, color }) => (
        <div key={value} className="flex items-center gap-2 text-xs">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color, border: `1px solid #65C397` }}
          />
          <div>
            {value === "futureAmount" ? "Est. payment" : "Paid to date"}
          </div>
        </div>
      ))}
    </div>
  );
};

export function SeniorPoolRepaymentSectionPlaceholder() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-sand-300"
      style={{ height: "600px" }}
    />
  );
}
