import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers";
import Image from "next/future/image";
import NextLink from "next/link";
import { ReactNode, ReactElement } from "react";

import { Shimmer } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { LoanRepaymentStatus } from "@/lib/pools";
import { assertUnreachable } from "@/lib/utils";

interface LayoutProps {
  className?: string;
  icon?: string | null;
  title: ReactNode;
  subtitle: ReactNode;
  href?: string;
  data: [
    ReactElement<DataProps>,
    ReactElement<DataProps>,
    ReactElement<DataProps>
  ];
}

export function ClosedDealCardLayout({
  className,
  icon,
  title,
  subtitle,
  href,
  data,
}: LayoutProps) {
  return (
    <div
      className={clsx(
        "relative grid grid-cols-1 gap-8 px-8 py-6 sm:grid-cols-3 lg:grid-cols-12 lg:gap-15",
        "rounded-xl border border-sand-200",
        "bg-white transition-colors",
        href ? "hover:bg-sand-100" : null,
        className
      )}
    >
      <div className="sm:col-span-3 lg:col-span-6">
        <div className="mb-2 flex items-center gap-2">
          <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-sand-200 bg-sand-200">
            {icon ? (
              <Image
                src={icon}
                alt=""
                className="object-cover"
                fill
                sizes="24px"
              />
            ) : null}
          </div>
          <div className="text-sm">
            {href ? (
              <NextLink href={href} passHref>
                <a className="before:absolute before:inset-0">{title}</a>
              </NextLink>
            ) : (
              title
            )}
          </div>
        </div>
        <div className="font-serif text-xl font-semibold">{subtitle}</div>
      </div>
      {data}
    </div>
  );
}

interface DataProps {
  label: ReactNode;
  value: ReactNode;
}

function Data({ label, value }: DataProps) {
  return (
    <div className="lg:col-span-2">
      <div className="mb-2 whitespace-nowrap text-sm">{label}</div>
      <div className="whitespace-nowrap text-base font-semibold">{value}</div>
    </div>
  );
}

export function ClosedDealCardPlaceholder() {
  return (
    <ClosedDealCardLayout
      title={<Shimmer className="w-10" />}
      subtitle={<Shimmer className="w-48" />}
      data={[
        <Data
          key="amount"
          label="Total loan amount"
          value={<Shimmer isTruncated={false} />}
        />,
        <Data
          key="date"
          label="Maturity date"
          value={<Shimmer isTruncated={false} />}
        />,
        <Data
          key="status"
          label="Status"
          value={<Shimmer isTruncated={false} />}
        />,
      ]}
    />
  );
}

function Status({
  poolRepaymentStatus,
}: {
  poolRepaymentStatus: LoanRepaymentStatus;
}) {
  switch (poolRepaymentStatus) {
    case LoanRepaymentStatus.Late:
      return <span className="text-mustard-450">Grace Period</span>;
    case LoanRepaymentStatus.Current:
      return <span className="text-mint-450">On Time</span>;
    case LoanRepaymentStatus.Repaid:
      return <span className="text-mint-600">Fully Repaid</span>;
    case LoanRepaymentStatus.Default:
      return <span className="text-clay-500">Default</span>;
    case LoanRepaymentStatus.NotDrawnDown:
      return <span>Not Drawn Down</span>;
    default:
      assertUnreachable(poolRepaymentStatus);
  }
}

interface ClosedDealCardProps {
  className?: string;
  borrowerName: string;
  icon?: string | null;
  dealName: string;
  termEndTime: BigNumber;
  loanAmount: BigNumber;
  repaymentStatus: LoanRepaymentStatus;
  href: string;
}

export function ClosedDealCard({
  className,
  borrowerName,
  icon,
  dealName,
  termEndTime,
  loanAmount,
  repaymentStatus,
  href,
}: ClosedDealCardProps) {
  return (
    <ClosedDealCardLayout
      className={className}
      title={borrowerName}
      subtitle={dealName}
      icon={icon}
      href={href}
      data={[
        <Data
          key="amount"
          label="Total loan amount"
          value={formatCrypto({
            token: "USDC",
            amount: loanAmount,
          })}
        />,
        <Data
          key="date"
          label="Maturity date"
          value={
            termEndTime.isZero()
              ? "-"
              : formatDate(termEndTime.toNumber() * 1000, "MMM d, y")
          }
        />,
        <Data
          key="status"
          label="Status"
          value={<Status poolRepaymentStatus={repaymentStatus} />}
        />,
      ]}
    />
  );
}
