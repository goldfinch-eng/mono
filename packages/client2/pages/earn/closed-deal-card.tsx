import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers/lib/ethers";
import Image from "next/future/image";

import { formatCrypto } from "@/lib/format";
import { PoolStatus } from "@/lib/pools";

interface ClosedDealCardProps {
  className?: string;
  borrowerName?: string;
  icon?: string | null;
  title: string;
  termEndTime: BigNumber;
  limit: BigNumber;
  poolStatus: PoolStatus;
  isLate: boolean;
}

const ClosedDealStatus = ({
  poolStatus,
  isLate,
}: {
  poolStatus: PoolStatus;
  isLate: boolean;
}) => {
  // TODO ZADRA: Rest of statuses
  let text = "";
  switch (poolStatus) {
    case PoolStatus.Full:
      text = isLate ? "Grace Period" : "On Time";
      break;
    case PoolStatus.Closed:
      text = "Cancelled";
      break;
    case PoolStatus.Repaid:
      text = "Fully Repaid";
      break;
    case PoolStatus.Paused:
      text = "Paused";
      break;
    // TODO Zadra: Default?
    case PoolStatus.Full:
      text = "Cancelled";
      break;
  }

  return <div className="font-semibold">{text}</div>;
};

export function ClosedDealCard({
  className,
  borrowerName,
  icon,
  title,
  termEndTime,
  limit,
  poolStatus,
  isLate = false,
}: ClosedDealCardProps) {
  return (
    <div
      className={clsx(
        "mb-2 grid grid-cols-12 rounded-xl bg-sand-100 py-6 px-8 hover:bg-sand-200",
        className
      )}
    >
      <div className="col-span-6 flex flex-col justify-center">
        <div className="mb-2 flex items-center">
          <div className="relative mr-2 h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white">
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
      {/* TODO: Map iterate array this  */}
      <div className="col-span-2 flex flex-col justify-center">
        <div className="mb-2 text-sm">Total loan amount</div>
        <div className="font-semibold">
          {formatCrypto({ amount: limit, token: "USDC" })}
        </div>
      </div>

      <div className="col-span-2 flex flex-col justify-center">
        <div className="mb-2 text-sm">Maturity date</div>
        <div className="font-semibold">
          {termEndTime.isZero()
            ? "-"
            : formatDate(termEndTime.toNumber() * 1000, "MMM d, y")}
        </div>
      </div>

      <div className="col-span-2 flex flex-col justify-center">
        <div className="mb-2 text-sm">Status</div>
        <ClosedDealStatus poolStatus={poolStatus} isLate={isLate} />
      </div>
    </div>
  );
}
