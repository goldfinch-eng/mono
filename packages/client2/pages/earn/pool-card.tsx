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
  computeApyFromGfiInFiat,
} from "@/lib/pools";

interface PoolCardProps {
  title?: string | null;
  subtitle?: string | null;
  apy: FixedNumber;
  apyFromGfi: FixedNumber;
  icon?: string | null;
  href: string;
  poolStatus?: PoolStatus;
}

export function PoolCard({
  title,
  subtitle,
  apy,
  apyFromGfi,
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
      <div className="grow">
        <NextLink passHref href={href}>
          <a className="text-lg before:absolute before:inset-0">
            {title ?? "Unnamed Pool"}
          </a>
        </NextLink>
        <div className="text-eggplant-100">{subtitle}</div>
      </div>
      <div className="w-1/5">
        <div className="text-lg">{formatPercent(apy)} USDC</div>
        <div className="text-eggplant-100">
          {formatPercent(apyFromGfi)} from GFI
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
      apyFromGfi={computeApyFromGfiInFiat(
        tranchedPool.estimatedJuniorApyFromGfiRaw,
        fiatPerGfi
      )}
      href={href}
      poolStatus={poolStatus}
    />
  );
}
