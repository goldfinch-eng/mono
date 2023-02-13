import clsx from "clsx";
import { FixedNumber } from "ethers/lib/ethers";
import Image from "next/future/image";
import NextLink from "next/link";
import { ReactNode } from "react";

import {
  Icon,
  InfoIconTooltip,
  Shimmer,
  ShimmerLines,
} from "@/components/design-system";
import { formatPercent } from "@/lib/format";

interface OpenDealCardProps {
  className?: string;
  title: string;
  subtitle: string;
  icon?: string | null;
  usdcApy: FixedNumber;
  gfiApy: FixedNumber;
  gfiApyTooltip: ReactNode;
  termLengthInMonths?: number;
  liquidity: string;
  href: string;
}

export function OpenDealCard({
  className,
  title,
  subtitle,
  icon,
  usdcApy,
  gfiApy,
  gfiApyTooltip,
  termLengthInMonths,
  liquidity,
  href,
}: OpenDealCardProps) {
  // TODO: Pending finalized tooltip content from Jake. Andre wrote what's here as placeholders.
  return (
    <div
      className={clsx(
        "group relative flex flex-col justify-between rounded-3xl border border-mustard-100 bg-mustard-100 py-8 px-10 transition-colors hover:bg-mustard-200",
        className
      )}
    >
      <div className="mb-15 flex items-center">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white">
          {icon ? (
            <Image
              src={icon}
              alt={`${title} icon`}
              fill
              sizes="48px"
              className="object-contain"
            />
          ) : null}
        </div>
        <div className="ml-4 flex flex-col">
          <NextLink href={href} passHref>
            <a className="mb-1 font-semibold before:absolute before:inset-0">
              {title}
            </a>
          </NextLink>
          <div className="text-sm text-sand-500">{subtitle}</div>
        </div>
      </div>

      <div>
        <div className="mb-6">
          <div className="mb-2 text-sm">Fixed USDC interest</div>
          <div className="flex items-end justify-between">
            <div className="font-serif text-4xl font-semibold leading-none">
              {formatPercent(usdcApy)}
            </div>
            <Icon
              name="ArrowSmRight"
              size="md"
              className="pointer-events-none mb-1 -translate-x-full opacity-0 transition-all duration-150 ease-in-out group-hover:translate-x-0 group-hover:opacity-100"
            />
          </div>
        </div>
        <div>
          <InfoLine
            label="Variable GFI APY"
            tooltip={<div className="max-w-xs">{gfiApyTooltip}</div>}
            value={formatPercent(gfiApy)}
          />
          <InfoLine
            label="Loan term"
            tooltip={
              termLengthInMonths
                ? "Length of the loan term up until the principal is due."
                : "This deal does not have a fixed term length."
            }
            value={
              termLengthInMonths ? `${termLengthInMonths} months` : "Open-ended"
            }
          />
          <InfoLine
            label="Liquidity"
            tooltip="When you can withdraw and reclaim your invested capital."
            value={liquidity}
          />
        </div>
      </div>
    </div>
  );
}

function InfoLine({
  label,
  value,
  tooltip,
}: {
  label: string;
  value?: string;
  tooltip?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-mustard-200 py-3 last:pb-0">
      <div className="flex">
        <div className="mr-1 text-xs sm:text-sm">{label}</div>
        {tooltip ? <InfoIconTooltip content={tooltip} size="sm" /> : null}
      </div>
      <div className="text-right text-sm font-semibold sm:text-base">
        {value ? value : <Shimmer style={{ width: "15ch" }} />}
      </div>
    </div>
  );
}

export function OpenDealCardPlaceholder() {
  return (
    <div className="relative flex flex-col justify-between rounded-3xl border border-mustard-100 bg-mustard-100 py-8 px-10">
      <div className="mb-15 flex items-center">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white" />
        <div className="ml-4 flex w-full flex-col">
          <div className="mb-1 font-semibold">
            <ShimmerLines lines={1} className="w-full" />
          </div>
          <div className="text-sm text-sand-500">
            <ShimmerLines lines={1} className="w-full" />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-6">
          <div className="mb-2 text-sm">Fixed USDC interest</div>
          <div className="flex items-end justify-between">
            <div className="font-serif text-4xl font-semibold leading-none">
              <Shimmer style={{ width: "6ch" }} />
            </div>
          </div>
        </div>
        <div>
          <InfoLine label="Variable GFI APY" />
          <InfoLine label="Loan term" />
          <InfoLine label="Liquidity" />
        </div>
      </div>
    </div>
  );
}
