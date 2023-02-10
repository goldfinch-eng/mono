import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers";
import Image from "next/future/image";
import NextLink from "next/link";
import { ReactNode } from "react";

import { Shimmer } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { PoolRepaymentStatus } from "@/lib/pools";
import { assertUnreachable } from "@/lib/utils";

interface LayoutProps {
  className?: string;
  icon?: string | null;
  title: ReactNode;
  subtitle: ReactNode;
  href?: string;
  data1Label: ReactNode;
  data1Value: ReactNode;
  data2Label: ReactNode;
  data2Value: ReactNode;
  data3Label: ReactNode;
  data3Value: ReactNode;
}

export function ClosedDealCardLayout({
  className,
  icon,
  title,
  subtitle,
  href,
  data1Label,
  data1Value,
  data2Label,
  data2Value,
  data3Label,
  data3Value,
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
      <Data label={data1Label} value={data1Value} />
      <Data label={data2Label} value={data2Value} />
      <Data label={data3Label} value={data3Value} />
    </div>
  );
}

function Data({ label, value }: { label: ReactNode; value: ReactNode }) {
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
      data1Label="Total loan amount"
      data1Value={<Shimmer isTruncated={false} />}
      data2Label="Maturity date"
      data2Value={<Shimmer isTruncated={false} />}
      data3Label="Status"
      data3Value={<Shimmer isTruncated={false} />}
    />
  );
}

function Status({
  poolRepaymentStatus,
}: {
  poolRepaymentStatus: PoolRepaymentStatus;
}) {
  switch (poolRepaymentStatus) {
    case PoolRepaymentStatus.Late:
      return <span className="text-mustard-450">Grace Period</span>;
    case PoolRepaymentStatus.Current:
      return <span className="text-mint-450">On Time</span>;
    case PoolRepaymentStatus.Repaid:
      return <span className="text-mint-450">Fully Repaid</span>;
    case PoolRepaymentStatus.Default:
      return <span className="text-clay-500">Default</span>;
    case PoolRepaymentStatus.NotDrawnDown:
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
  repaymentStatus: PoolRepaymentStatus;
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
      data1Label="Total loan amount"
      data1Value={formatCrypto({
        token: "USDC",
        amount: loanAmount,
      })}
      data2Label="Maturity date"
      data2Value={
        termEndTime.isZero()
          ? "-"
          : formatDate(termEndTime.toNumber() * 1000, "MMM d, y")
      }
      data3Label="Status"
      data3Value={<Status poolRepaymentStatus={repaymentStatus} />}
    />
  );
}
