import clsx from "clsx";
import { FixedNumber } from "ethers/lib/ethers";
import Image from "next/future/image";
import NextLink from "next/link";

import {
  Icon,
  InfoIconTooltip,
  Link,
  ShimmerLines,
} from "@/components/design-system";
import { formatPercent } from "@/lib/format";

interface OpenDealCardProps {
  className?: string;
  title: string;
  subtitle: string;
  icon?: string | null;
  apy: FixedNumber;
  gfiApy: FixedNumber;
  termLengthInMonths?: number;
  dealType: "multitranche" | "unitranche" | "seniorPool";
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
  // TODO: Pending tooltip content from Jake
  const dealInfoItems = [
    {
      title: "Variable GFI APY",
      tooltipContent: (
        <div className="max-w-xs">
          The {dealType === "seniorPool" ? "Senior" : ""} Pool&rsquo;s est. GFI
          rewards APY. The GFI rewards APY is volatile and changes based on
          several variables including the price of GFI, the total capital
          deployed on Goldfinch, and Senior Pool&rsquo;s utilization. Learn more
          in the{" "}
          <Link
            href={
              dealType === "seniorPool"
                ? "https://docs.goldfinch.finance/goldfinch/protocol-mechanics/investor-incentives/senior-pool-liquidity-mining"
                : "https://docs.goldfinch.finance/goldfinch/protocol-mechanics/investor-incentives/backer-incentives"
            }
            openInNewTab
          >
            Goldfinch Documentation
          </Link>
          .
        </div>
      ),
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
        dealType === "seniorPool"
          ? "2 week withdraw requests"
          : "End of loan term",
    },
  ];

  return (
    <div
      className={clsx(
        "group relative flex h-[25rem] flex-col justify-between rounded-3xl border border-mustard-100 bg-mustard-100 py-8 px-10 transition-colors hover:bg-mustard-200",
        className
      )}
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
            <NextLink href={href} passHref>
              <a className="mb-1 font-semibold before:absolute before:inset-0">
                {title}
              </a>
            </NextLink>
            <div className="text-sm text-sand-500">{subtitle}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-6">
          <div className="mb-2 text-sm">Fixed USDC interest</div>
          <div className="flex items-end justify-between">
            <div className="font-serif text-4xl font-semibold leading-none">
              {formatPercent(apy)}
            </div>
            <Icon
              name="ArrowSmRight"
              size="md"
              className="pointer-events-none mb-1 -translate-x-full opacity-0 transition-all duration-150 ease-in-out group-hover:translate-x-0 group-hover:opacity-100"
            />
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
                <div className="mr-1 text-xs sm:text-sm">{item.title}</div>
                <InfoIconTooltip content={item.tooltipContent} size="sm" />
              </div>
              <div className="text-sm font-semibold sm:text-base">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OpenDealCardPlaceholder() {
  return (
    <div className="relative flex h-[25rem] flex-col justify-between rounded-3xl border border-mustard-100 bg-mustard-100 py-8 px-10 hover:bg-mustard-200">
      <div>
        <div className="mb-4 flex items-center">
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
      </div>

      <div>
        <div className="mb-6 flex items-end justify-between">
          <div className="w-full">
            <div className="mb-2 text-sm">
              <ShimmerLines lines={1} className="w-full" />
            </div>
            <div className="font-serif text-[2.5rem]">
              <ShimmerLines lines={1} className="w-full" />
            </div>
          </div>
        </div>
        <div className="grid divide-y divide-mustard-200 border-t border-mustard-200">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className={clsx(
                "flex items-center justify-between",
                item === [0, 1, 2].length - 1 ? "pt-3" : "py-3"
              )}
            >
              <div className="flex w-full">
                <div className="mr-1 w-full text-xs sm:text-sm">
                  <ShimmerLines lines={1} className="w-full" />
                </div>
              </div>
              <div className="w-full text-sm font-semibold sm:text-base">
                <ShimmerLines lines={1} className="w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
