import { gql } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";
import Image from "next/image";
import NextLink from "next/link";
import { ReactNode } from "react";

import {
  Chip,
  InfoIconTooltip,
  ShimmerLines,
} from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SupportedCrypto,
  TranchedPoolCardFieldsFragment,
} from "@/lib/graphql/generated";
import {
  PoolStatus,
  getTranchedPoolStatus,
  TRANCHED_POOL_STATUS_FIELDS,
  computeApyFromGfiInFiat,
} from "@/lib/pools";

interface PoolCardProps {
  title?: string | null;
  subtitle?: string | null;
  apy: FixedNumber;
  apyWithGfi: FixedNumber;
  apyTooltipContent: ReactNode;
  limit?: BigNumber;
  userBalance: BigNumber;
  icon?: string | null;
  href: string;
  poolStatus?: PoolStatus;
}

export function PoolCard({
  title,
  subtitle,
  apy,
  apyWithGfi,
  apyTooltipContent,
  limit,
  userBalance,
  icon,
  href,
  poolStatus,
}: PoolCardProps) {
  return (
    <div className="relative flex space-x-4 rounded bg-sand-100 px-7 py-5 hover:bg-sand-200">
      <div className="relative h-12 w-12 overflow-hidden rounded-full bg-white">
        {icon && (
          <Image
            src={icon}
            alt={`${title} icon`}
            layout="fill"
            sizes="48px"
            objectFit="contain"
          />
        )}
      </div>
      <div className="w-2/5">
        <NextLink passHref href={href}>
          <a className="text-lg font-medium before:absolute before:inset-0">
            {title ?? "Unnamed Pool"}
          </a>
        </NextLink>
        <div>{subtitle}</div>
      </div>
      <div className="relative w-1/5">
        <div className="text-lg font-medium">{formatPercent(apy)} USDC</div>
        <div className="flex items-center">
          {formatPercent(apyWithGfi)} with GFI{" "}
          <InfoIconTooltip
            content={
              <div className="max-w-[320px] text-sm">{apyTooltipContent}</div>
            }
          />
        </div>
      </div>
      <div className="flex w-1/5 items-center justify-center">
        {limit
          ? formatCrypto(
              { token: SupportedCrypto.Usdc, amount: limit },
              { includeSymbol: true }
            )
          : "Unlimited"}
      </div>
      <div className="flex w-1/5 items-center justify-center">
        {formatCrypto(
          { token: SupportedCrypto.Usdc, amount: userBalance },
          { includeSymbol: true }
        )}
      </div>
      {poolStatus ? (
        <Chip
          className="absolute -top-2 -right-2"
          colorScheme={
            poolStatus === PoolStatus.Full
              ? "yellow"
              : poolStatus === PoolStatus.Open
              ? "purple"
              : poolStatus === PoolStatus.ComingSoon
              ? "blue"
              : poolStatus === PoolStatus.Repaid
              ? "purple"
              : "white"
          }
        >
          {poolStatus === PoolStatus.Full
            ? "FULL"
            : poolStatus === PoolStatus.Open
            ? "OPEN"
            : poolStatus === PoolStatus.ComingSoon
            ? "COMING SOON"
            : poolStatus === PoolStatus.Repaid
            ? "REPAID"
            : null}
        </Chip>
      ) : null}
    </div>
  );
}

export function PoolCardPlaceholder() {
  return (
    <div className="flex space-x-4 rounded bg-sand-100 px-7 py-5 hover:bg-sand-200">
      <div className="h-12 w-12 overflow-hidden rounded-full bg-white" />
      <div className="grow">
        <ShimmerLines lines={2} truncateFirstLine />
      </div>
      <div className="w-1/5">
        <ShimmerLines lines={2} truncateFirstLine={false} />
      </div>
      <div className="w-1/5">
        <ShimmerLines lines={1} truncateFirstLine={false} />
      </div>
      <div className="w-1/5">
        <ShimmerLines lines={1} truncateFirstLine={false} />
      </div>
    </div>
  );
}

export const TRANCHED_POOL_CARD_FIELDS = gql`
  ${TRANCHED_POOL_STATUS_FIELDS}
  fragment TranchedPoolCardFields on TranchedPool {
    id
    name @client
    category @client
    icon @client
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    creditLine {
      id
      maxLimit
    }
    # Beware, this is tightly coupled to $userAccount in the parent query
    backers(where: { user: $userAccount }) {
      id
      balance
    }
    ...TranchedPoolStatusFields
  }
`;

interface TranchedPoolCardProps {
  tranchedPool: TranchedPoolCardFieldsFragment;
  href: string;
  fiatPerGfi: number;
  seniorPoolApyFromGfiRaw: FixedNumber;
}

export function TranchedPoolCard({
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

  return (
    <PoolCard
      title={tranchedPool.name}
      subtitle={tranchedPool.category}
      icon={tranchedPool.icon}
      apy={tranchedPool.estimatedJuniorApy}
      apyWithGfi={apyFromGfiFiat}
      apyTooltipContent={
        <div>
          <div className="mb-4">
            Includes the senior pool yield from allocating to borrower pools,
            plus GFI distributions.
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
              <div>{formatPercent(seniorPoolApyFromGfiFiat)}</div>
            </div>
            <hr className="border-t border-sand-300" />
            <div className="flex justify-between">
              <div>Total Est. APY</div>
              <div>
                {formatPercent(
                  tranchedPool.estimatedJuniorApy
                    .addUnsafe(apyFromGfiFiat)
                    .addUnsafe(seniorPoolApyFromGfiFiat)
                )}
              </div>
            </div>
          </div>
        </div>
      }
      limit={tranchedPool.creditLine.maxLimit}
      userBalance={
        tranchedPool.backers?.reduce(
          (prev, current) => prev.add(current.balance),
          BigNumber.from(0)
        ) ?? BigNumber.from(0)
      }
      href={href}
      poolStatus={poolStatus}
    />
  );
}
