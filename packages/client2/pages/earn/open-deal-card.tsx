import clsx from "clsx";
import { FixedNumber } from "ethers/lib/ethers";
import Image from "next/future/image";

import { formatPercent } from "@/lib/format";
import { Deal_DealType } from "@/lib/graphql/generated";

import {
  Chip,
  InfoIconTooltip,
  ShimmerLines,
} from "../../components/design-system";

interface OpenDealCardProps {
  className?: string;
  borrowerName?: string;
  icon?: string | null;
  title: string;
  description: string;
  apy: FixedNumber;
  gfiApy: FixedNumber;
  termLengthInMonths?: number;
  dealType?: Deal_DealType | null;
}

function ChipCta({ dealType }: { dealType?: Deal_DealType | null }) {
  // eventually here we add 90-day Callable, T-bills, etc.
  switch (dealType) {
    case "multitranche" || "unitranche":
      return null;
    default:
      return <Chip colorScheme="mustard">Diversified Portfolio</Chip>;
  }
}

export function OpenDealCard({
  className,
  borrowerName,
  icon,
  title,
  description,
  apy,
  gfiApy,
  termLengthInMonths,
  dealType,
}: OpenDealCardProps) {
  return (
    <div
      className={clsx(
        "flex h-[440px] flex-col justify-between rounded-3xl border border-mustard-200 bg-mustard-100 p-8",
        className
      )}
    >
      <div>
        <div className="mb-4 flex items-center">
          <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white">
            {icon ? (
              <Image
                src={icon}
                alt={`${borrowerName} icon`}
                fill
                className="object-contain"
              />
            ) : null}
          </div>
          <div className="ml-2 text-sm text-sand-700">{borrowerName}</div>
        </div>

        <div className="mb-4">
          <div className="font-serif text-2xl font-semibold	text-sand-800">
            {title}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-sm text-sand-700 opacity-70">{description}</div>
        </div>

        <ChipCta dealType={dealType} />
      </div>

      <div className="grid items-end divide-y divide-mustard-200 text-sm">
        <div className="flex justify-between py-2">
          <div className="flex">
            <div className="mr-1">Fixed USDC interest</div>
            <InfoIconTooltip
              content="[TODO] Fixed USDC interest tooltip"
              size="sm"
            />
          </div>

          <div>{formatPercent(apy)}</div>
        </div>

        <div className="flex justify-between py-2">
          <div className="flex">
            <div className="mr-1">Variable GFI APY</div>
            <InfoIconTooltip
              content="[TODO] Variable GFI APY tooltip"
              size="sm"
            />
          </div>
          <div>{formatPercent(gfiApy)}</div>
        </div>

        <div className="flex justify-between pt-2">
          <div className="flex">
            <div className="mr-1">Loan term</div>
            <InfoIconTooltip content="[TODO] Loan term tooltip" size="sm" />
          </div>
          <div>
            {termLengthInMonths ? `${termLengthInMonths} months` : "Open-ended"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpenDealCardPlaceholder() {
  return (
    <div className="flex h-[440px] flex-col justify-between rounded-3xl border border-mustard-200 bg-mustard-100 p-8">
      <div>
        {/* Icon & borrowerName */}
        <div className="mb-4 flex items-center">
          <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white" />
        </div>

        {/* Title */}
        <div className="mb-4">
          <div className="font-serif text-2xl font-semibold	text-sand-800">
            <ShimmerLines lines={1} truncateFirstLine />
          </div>
        </div>

        {/* Description */}
        <div className="mb-5">
          <ShimmerLines lines={4} truncateFirstLine={false} />
        </div>
      </div>

      <div className="grid items-end">
        <ShimmerLines lines={1} truncateFirstLine={false} className="py-2" />
        <ShimmerLines lines={1} truncateFirstLine={false} className="py-2" />
        <ShimmerLines lines={1} truncateFirstLine={false} className="pt-2" />
      </div>
    </div>
  );
}
