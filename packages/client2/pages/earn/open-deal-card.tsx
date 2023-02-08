import { Transition } from "@headlessui/react";
import clsx from "clsx";
import { FixedNumber } from "ethers/lib/ethers";
import Image from "next/future/image";
import NextLink from "next/link";
import { Fragment, useState } from "react";

import {
  Icon,
  InfoIconTooltip,
  ShimmerLines,
} from "@/components/design-system";
import { formatPercent } from "@/lib/format";
import { Deal_DealType } from "@/lib/graphql/generated";

interface OpenDealCardProps {
  className?: string;
  title: string;
  subtitle: string;
  icon?: string | null;
  apy: FixedNumber;
  gfiApy: FixedNumber;
  termLengthInMonths?: number;
  dealType?: Deal_DealType | null;
  href: string;
}

export function OpenDealCard({
  className,
  title,
  subtitle,
  icon,
  apy,
  gfiApy,
  termLengthInMonths,
  dealType,
  href,
}: OpenDealCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const dealInfoItems = [
    {
      title: "Variable GFI APY",
      tooltipContent: "[TODO] Variable GFI APY tooltip",
      value: formatPercent(gfiApy),
    },
    {
      title: "Loan term",
      tooltipContent: "[TODO] Loan term tooltip",
      value: termLengthInMonths ? `${termLengthInMonths} months` : "Open-ended",
    },
    {
      title: "Liquidity",
      tooltipContent: "[TODO] Liquidity tooltip",
      value:
        dealType === "multitranche" || dealType === "unitranche"
          ? "End of loan term"
          : "2 weeks withdraw requests",
    },
  ];

  return (
    <div
      className={clsx(
        "relative flex h-[25rem] flex-col justify-between rounded-3xl border border-mustard-100 bg-mustard-100 py-8 px-10 hover:bg-mustard-200",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div>
        <div className="mb-4 flex items-center">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white">
            {icon ? (
              <Image
                src={icon}
                alt={`${title} icon`}
                fill
                className="object-contain"
              />
            ) : null}
          </div>
          <div className="ml-4 flex flex-col">
            <div className="mb-1 font-semibold">{title}</div>
            <div className="text-sm text-sand-500">{subtitle}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-2 text-sm">Fixed USDC interest</div>
            <div className="font-serif text-[2.5rem]">{formatPercent(apy)}</div>
          </div>
          <div className="mb-4">
            <Transition
              show={isHovered}
              as={Fragment}
              enter="transition-all duration-150 ease-in-out"
              enterFrom="-translate-x-full opacity-0"
              enterTo="translate-x-0 opacity-150"
              leave="transition-all duration-150 ease-in-out"
              leaveFrom="translate-x-0 opacity-150"
              leaveTo="-translate-x-full opacity-0"
            >
              <Icon name="ArrowSmRight" size="md" />
            </Transition>
          </div>
        </div>
        <div className="grid divide-y divide-mustard-200 border-t border-mustard-200">
          {dealInfoItems.map((item, i) => (
            <div
              key={i}
              className={clsx(
                "flex items-center justify-between",
                i === dealInfoItems.length - 1 ? "pt-3" : "py-3"
              )}
            >
              <div className="flex">
                <NextLink href={href} passHref>
                  <a className="mr-1 text-sm before:absolute before:inset-0">
                    {item.title}
                  </a>
                </NextLink>
                <InfoIconTooltip content={item.tooltipContent} size="sm" />
              </div>
              <div className="font-semibold">{item.value}</div>
            </div>
          ))}
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
