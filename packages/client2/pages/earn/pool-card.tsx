import { gql } from "@apollo/client";
import { FixedNumber } from "ethers";
import Image from "next/image";
import NextLink from "next/link";

import { Chip, ShimmerLines } from "@/components/design-system";
import { formatPercent } from "@/lib/format";
import { TranchedPoolCardFieldsFragment } from "@/lib/graphql/generated";
import {
  PoolStatus,
  getTranchedPoolStatus,
  TRANCHED_POOL_STATUS_FIELDS,
} from "@/lib/pools";

interface PoolCardProps {
  title?: string | null;
  subtitle?: string | null;
  apy?: number | FixedNumber | null;
  apyFromGfi?: number | FixedNumber | null;
  icon?: string | null;
  href?: string;
  poolStatus?: PoolStatus;
  /**
   * Set this if the pool card is being used as a placeholder during loading
   */
  isPlaceholder?: boolean;
}

export function PoolCard({
  title,
  subtitle,
  apy,
  apyFromGfi,
  icon,
  href,
  poolStatus,
  isPlaceholder = false,
}: PoolCardProps) {
  return (
    <div className="relative flex space-x-4 rounded bg-sand-100 px-7 py-5 hover:bg-sand-200">
      <div className="relative h-12 w-12 overflow-hidden rounded-full bg-white">
        {icon && !isPlaceholder ? (
          <Image
            src={icon}
            alt={`${title} icon`}
            layout="fill"
            sizes="48px"
            objectFit="contain"
          />
        ) : null}
      </div>
      <div className="grow">
        {isPlaceholder ? (
          <ShimmerLines lines={2} truncateFirstLine />
        ) : (
          <>
            {href ? (
              <NextLink passHref href={href}>
                <a className="text-lg before:absolute before:inset-0">
                  {title}
                </a>
              </NextLink>
            ) : (
              <div className="text-lg">{title}</div>
            )}
            <div className="text-eggplant-100">{subtitle}</div>
          </>
        )}
      </div>
      <div className="w-1/5">
        <div className="text-lg">
          {apy ? `${formatPercent(apy)} USDC` : "\u00A0"}
        </div>
        <div className="text-eggplant-100">
          {apyFromGfi ? `${formatPercent(apyFromGfi)} from GFI` : "\u00A0"}
        </div>
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

export const TRANCHED_POOL_CARD_FIELDS = gql`
  ${TRANCHED_POOL_STATUS_FIELDS}
  fragment TranchedPoolCardFields on TranchedPool {
    id
    name @client
    category @client
    icon @client
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    ...TranchedPoolStatusFields
  }
`;

interface TranchedPoolCardProps {
  tranchedPool: TranchedPoolCardFieldsFragment;
  href: string;
  fiatPerGfi: number;
}

export function TranchedPoolCard({
  tranchedPool,
  href,
  fiatPerGfi,
}: TranchedPoolCardProps) {
  const poolStatus = getTranchedPoolStatus(tranchedPool);
  return (
    <PoolCard
      title={tranchedPool.name}
      subtitle={tranchedPool.category}
      icon={tranchedPool.icon}
      apy={tranchedPool.estimatedJuniorApy}
      apyFromGfi={tranchedPool.estimatedJuniorApyFromGfiRaw.mulUnsafe(
        FixedNumber.fromString(fiatPerGfi.toString())
      )}
      href={href}
      poolStatus={poolStatus}
    />
  );
}
