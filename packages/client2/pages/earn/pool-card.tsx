import { gql } from "@apollo/client";
import Image from "next/image";
import NextLink from "next/link";

import { TranchedPoolCardFieldsFragment } from "@/lib/graphql/generated";

interface PoolCardProps {
  title?: string | null;
  subtitle?: string | null;
  icon?: string | null;
  href: string;
}

export function PoolCard({ title, subtitle, icon, href }: PoolCardProps) {
  return (
    <div className="relative flex space-x-4 rounded bg-sand-100 px-7 py-5 hover:bg-sand-200">
      <div className="relative h-12 w-12 overflow-hidden rounded-full bg-white">
        {icon ? (
          <Image
            src={icon}
            alt={`${title} icon`}
            layout="fill"
            sizes="48px"
            objectFit="contain"
          />
        ) : null}
      </div>
      <div>
        <NextLink passHref href={href}>
          <a className="text-lg before:absolute before:inset-0">{title}</a>
        </NextLink>
        <div className="text-purple-100">{subtitle}</div>
      </div>
    </div>
  );
}

export const TRANCHED_POOL_CARD_FIELDS = gql`
  fragment TranchedPoolCardFields on TranchedPool {
    id
    name @client
    category @client
    icon @client
  }
`;

interface TranchedPoolCardProps {
  tranchedPool: TranchedPoolCardFieldsFragment;
  href: string;
}

export function TranchedPoolCard({
  tranchedPool,
  href,
}: TranchedPoolCardProps) {
  return (
    <PoolCard
      title={tranchedPool.name}
      subtitle={tranchedPool.category}
      icon={tranchedPool.icon}
      href={href}
    />
  );
}
