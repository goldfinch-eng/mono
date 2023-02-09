import { gql } from "@apollo/client";
import { FixedNumber } from "ethers";
import Image from "next/future/image";
import NextLink from "next/link";
import { ReactNode } from "react";

import {
  Chip,
  InfoIconTooltip,
  Link,
  ShimmerLines,
} from "@/components/design-system";
import { formatPercent } from "@/lib/format";
import {
  TranchedPoolCardFieldsFragment,
  TranchedPoolCardDealFieldsFragment,
  Deal_DealType,
} from "@/lib/graphql/generated";
import {
  PoolStatus,
  getTranchedPoolStatus,
  TRANCHED_POOL_STATUS_FIELDS,
  computeApyFromGfiInFiat,
} from "@/lib/pools";

interface PoolCardProps {
  title: string;
  subtitle: string;
  apy: FixedNumber;
  apyWithGfi: FixedNumber;
  apyTooltipContent: ReactNode;
  icon?: string | null;
  href: string;
  poolStatus?: PoolStatus;
  dealType?: Deal_DealType | null;
}

function getColorScheme(
  poolStatus?: PoolStatus
): "yellow" | "purple" | "blue" | "green" | "white" {
  switch (poolStatus) {
    case PoolStatus.Full:
    case PoolStatus.Closed:
      return "yellow";
    case PoolStatus.Open:
      return "purple";
    case PoolStatus.ComingSoon:
      return "blue";
    case PoolStatus.Repaid:
      return "green";
    case PoolStatus.Paused:
    default:
      return "white";
  }
}

function getChipContent(
  poolStatus?: PoolStatus | Deal_DealType
): string | null {
  switch (poolStatus) {
    case PoolStatus.Full:
      return "FULL";
    case PoolStatus.Closed:
      return "CLOSED";
    case PoolStatus.Open:
      return "OPEN";
    case PoolStatus.ComingSoon:
      return "COMING SOON";
    case PoolStatus.Repaid:
      return "REPAID";
    case "unitranche":
      return "Unitranche";
    case "multitranche":
      return "Multitranche";
    default:
      return null;
  }
}
export function PoolCard({
  title,
  subtitle,
  apy,
  apyWithGfi,
  apyTooltipContent,
  icon,
  href,
  poolStatus,
  dealType,
}: PoolCardProps) {
  return (
    <PoolCardLayout
      iconSlot={
        icon ? (
          <Image
            src={icon}
            alt={`${title} icon`}
            fill
            className="object-contain"
            sizes="48px"
          />
        ) : null
      }
      titleSlot1={
        <NextLink passHref href={href}>
          <a className="block text-lg font-medium before:absolute before:inset-0">
            {title ?? "Unnamed Pool"}
          </a>
        </NextLink>
      }
      titleSlot2={subtitle}
      dataSlot1={
        <div className="text-lg font-medium">{formatPercent(apy)} USDC</div>
      }
      dataSlot2={
        <div className="flex items-center">
          {formatPercent(apyWithGfi)} with GFI{" "}
          <InfoIconTooltip
            content={
              <div className="max-w-[320px] text-sm">{apyTooltipContent}</div>
            }
          />
        </div>
      }
      chipSlot={
        !!dealType ? (
          <Chip colorScheme="transparent">{getChipContent(dealType)}</Chip>
        ) : undefined
      }
      chipSlot2={
        <Chip colorScheme={getColorScheme(poolStatus)}>
          {getChipContent(poolStatus)}
        </Chip>
      }
    />
  );
}

export function PoolCardPlaceholder() {
  return (
    <PoolCardLayout
      iconSlot={null}
      titleSlot1={<ShimmerLines lines={1} truncateFirstLine />}
      titleSlot2={<ShimmerLines lines={1} truncateFirstLine={false} />}
      dataSlot1={<ShimmerLines lines={1} truncateFirstLine={false} />}
      dataSlot2={<ShimmerLines lines={1} truncateFirstLine={false} />}
      chipSlot={null}
    />
  );
}

interface PoolCardLayoutProps {
  iconSlot: ReactNode;
  titleSlot1: ReactNode;
  titleSlot2: ReactNode;
  dataSlot1: ReactNode;
  dataSlot2: ReactNode;
  chipSlot: ReactNode;
  chipSlot2?: ReactNode;
}

function PoolCardLayout({
  iconSlot,
  titleSlot1,
  titleSlot2,
  dataSlot1,
  dataSlot2,
  chipSlot,
  chipSlot2,
}: PoolCardLayoutProps) {
  return (
    <div className="pool-card relative grid items-center gap-x-4 rounded bg-sand-100 p-5 hover:bg-sand-200">
      <div
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white"
        style={{ gridArea: "icon" }}
      >
        {iconSlot}
      </div>
      <div style={{ gridArea: "title1" }}>{titleSlot1}</div>
      <div style={{ gridArea: "title2" }}>{titleSlot2}</div>
      <div className="mt-4 md:mt-0" style={{ gridArea: "data1" }}>
        {dataSlot1}
      </div>
      <div className="mb-4 md:mb-0" style={{ gridArea: "data2" }}>
        {dataSlot2}
      </div>
      <div
        className="flex gap-2 justify-self-start sm:justify-self-end"
        style={{ gridArea: "chip" }}
      >
        {chipSlot}
        {chipSlot2}
      </div>
    </div>
  );
}

export const TRANCHED_POOL_CARD_FIELDS = gql`
  ${TRANCHED_POOL_STATUS_FIELDS}
  fragment TranchedPoolCardFields on TranchedPool {
    id
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    creditLine {
      id
      maxLimit
      limit
      termInDays
    }
    ...TranchedPoolStatusFields
  }
`;

export const TRANCHED_POOL_CARD_DEAL_FIELDS = gql`
  fragment TranchedPoolCardDealFields on Deal {
    id
    name
    dealType
    category
    borrower {
      id
      name
      logo {
        url
      }
    }
  }
`;

interface TranchedPoolCardProps {
  details: TranchedPoolCardDealFieldsFragment;
  tranchedPool: TranchedPoolCardFieldsFragment;
  href: string;
  fiatPerGfi: number;
  seniorPoolApyFromGfiRaw: FixedNumber;
}

export function TranchedPoolCard({
  details,
  tranchedPool,
  href,
  fiatPerGfi,
  seniorPoolApyFromGfiRaw,
}: TranchedPoolCardProps) {
  const poolStatus = getTranchedPoolStatus(tranchedPool);
  const apyFromGfiFiat = computeApyFromGfiInFiat(
    tranchedPool.estimatedJuniorApyFromGfiRaw,
    fiatPerGfi
  );
  const seniorPoolApyFromGfiFiat = computeApyFromGfiInFiat(
    seniorPoolApyFromGfiRaw,
    fiatPerGfi
  );

  const totalApyWithGfi = tranchedPool.estimatedJuniorApyFromGfiRaw.isZero()
    ? tranchedPool.estimatedJuniorApy
    : tranchedPool.estimatedJuniorApy
        .addUnsafe(apyFromGfiFiat)
        .addUnsafe(seniorPoolApyFromGfiFiat);

  return (
    <PoolCard
      title={details.name}
      subtitle={details.category}
      icon={details.borrower?.logo?.url}
      apy={tranchedPool.estimatedJuniorApy}
      apyWithGfi={totalApyWithGfi}
      apyTooltipContent={
        <div>
          <div className="mb-4">
            The Pool&rsquo;s total current estimated APY, including the current
            USDC APY and est. GFI rewards APY. The GFI rewards APY is volatile
            and changes based on several variables including the price of GFI,
            the total capital deployed on Goldfinch, and Senior Pool&rsquo;s
            utilization. Learn more in the{" "}
            <Link
              href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/investor-incentives/backer-incentives"
              openInNewTab
            >
              Goldfinch Documentation
            </Link>
            .
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div>Base interest USDC APY</div>
              <div>{formatPercent(tranchedPool.estimatedJuniorApy)}</div>
            </div>
            <div className="flex justify-between">
              <div>Backer liquidity mining GFI APY</div>
              <div>{formatPercent(apyFromGfiFiat)}</div>
            </div>
            <div className="flex justify-between">
              <div>LP rewards match GFI APY</div>
              <div>
                {formatPercent(
                  tranchedPool.estimatedJuniorApyFromGfiRaw.isZero()
                    ? 0
                    : seniorPoolApyFromGfiFiat
                )}
              </div>
            </div>
            <hr className="border-t border-sand-300" />
            <div className="flex justify-between">
              <div>Total Est. APY</div>
              <div>{formatPercent(totalApyWithGfi)}</div>
            </div>
          </div>
        </div>
      }
      href={href}
      poolStatus={poolStatus}
      dealType={details.dealType}
    />
  );
}
