import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers/lib/ethers";
import Image from "next/future/image";
import NextLink from "next/link";
import { ReactNode } from "react";

import { ShimmerLines } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { PoolStatus } from "@/lib/pools";
import { assertUnreachable } from "@/lib/utils";

interface ClosedDealCardProps {
  className?: string;
  borrowerName?: string;
  icon?: string | null;
  title: string;
  termEndTime: BigNumber;
  limit: BigNumber;
  poolStatus: PoolStatus;
  isLate: boolean;
  href: string;
}

const ClosedDealStatus = ({
  poolStatus,
  isLate,
}: {
  poolStatus: PoolStatus;
  isLate: boolean;
}) => {
  switch (poolStatus) {
    case PoolStatus.Full:
      return isLate ? (
        <div className="text-mustard-450">Grace Period</div>
      ) : (
        <div className="text-mint-450">On Time</div>
      );
    case PoolStatus.Repaid:
      return <div className="text-mint-450">Fully repaid</div>;
    // TODO: How to determine if a pool has defaulted?
    case PoolStatus.Default:
      return <div className="text-clay-500">Default</div>;
    default:
      assertUnreachable(poolStatus as never);
  }
};

export function ClosedDealCard({
  className,
  borrowerName,
  icon,
  title,
  termEndTime,
  limit,
  poolStatus,
  isLate,
  href,
}: ClosedDealCardProps) {
  const cardSectionDetails: { title: string; content: string | ReactNode }[] = [
    {
      title: "Total loan amount",
      content: formatCrypto({ amount: limit, token: "USDC" }),
    },
    {
      title: "Maturity date",
      content: termEndTime.isZero()
        ? "-"
        : formatDate(termEndTime.toNumber() * 1000, "MMM d, y"),
    },
    {
      title: "Status",
      content: <ClosedDealStatus poolStatus={poolStatus} isLate={isLate} />,
    },
  ];

  return (
    <div
      className={clsx(
        "relative grid grid-cols-12 rounded-xl border border-sand-200 bg-white py-6 px-8 hover:bg-sand-100",
        className
      )}
    >
      <div className="col-span-12 mb-5 flex flex-col justify-center sm:col-span-6 sm:mb-0">
        <div className="mb-2 flex items-center">
          <div className="relative mr-2 h-5 w-5 shrink-0 overflow-hidden rounded-full bg-sand-200">
            {icon ? (
              <Image
                src={icon}
                alt={`${borrowerName} icon`}
                fill
                className="object-contain"
              />
            ) : null}
          </div>
          <div className="text-sm">{borrowerName}</div>
        </div>
        <div className="font-serif text-xl font-semibold">{title}</div>
      </div>
      {cardSectionDetails.map((item, i) => (
        <div
          key={i}
          className="col-span-12 mb-4 flex flex-col justify-center sm:col-span-2 sm:mb-0"
        >
          <NextLink href={href} passHref>
            <a className="mb-2 text-sm before:absolute before:inset-0">
              {item.title}
            </a>
          </NextLink>
          <div className="font-semibold">{item.content}</div>
        </div>
      ))}
    </div>
  );
}

export function ClosedDealCardPlaceholder({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "relative grid grid-cols-12 rounded-xl border border-sand-200 bg-white py-6 px-8 hover:bg-sand-100",
        className
      )}
    >
      <div className="col-span-12 mb-5 flex flex-col justify-center sm:col-span-6 sm:mb-0">
        <div className="mb-2 flex items-center">
          <div className="relative mr-2 h-5 w-5 shrink-0 overflow-hidden rounded-full bg-sand-200" />
          <div className="w-1/2 text-sm">
            <ShimmerLines lines={1} className="w-full" />
          </div>
        </div>
        <div className="font-serif text-xl font-semibold">
          <ShimmerLines lines={1} className="w-full" />
        </div>
      </div>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="col-span-12 mb-4 flex flex-col justify-center sm:col-span-2 sm:mb-0"
        >
          <div className="mb-2 text-sm">
            <ShimmerLines lines={1} className="w-full" />
          </div>
          <div className="font-semibold">
            <ShimmerLines lines={1} className="w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
