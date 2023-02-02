import clsx from "clsx";
import Image from "next/future/image";

import { Chip } from "../../components/design-system";

interface OpenDealCardProps {
  className?: string;
  owner: string;
  icon?: string | null;
  title: string;
  description: string;
}

export function OpenDealCard({
  className,
  owner,
  icon,
  title,
  description,
}: OpenDealCardProps) {
  return (
    <div
      className={clsx(
        "flex h-[410px] min-w-[410px] max-w-[410px] flex-col justify-between rounded-3xl border border-mustard-200 bg-mustard-100 px-10 py-8",
        className
      )}
    >
      <div>
        {/* Icon & Owner */}
        <div className="mb-4 flex items-center">
          <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-white">
            {icon ? (
              <Image
                src={icon}
                alt={`${owner} icon`}
                fill
                className="object-contain"
                sizes="48px"
              />
            ) : null}
          </div>
          <div className="ml-2 text-sm text-sand-700">{owner}</div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <div className="font-serif text-2xl font-semibold	text-sand-800">
            {title}
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <div className="text-sm text-sand-700 opacity-70">{description}</div>
        </div>

        {/* Pill */}
        <Chip colorScheme="mustard">Diversified Portfolio</Chip>
      </div>

      <div className="grid grid-cols-2 items-end border-b">
        <div>
          <div>Fixed USDC interest</div>
        </div>
        <div className="flex justify-self-end">12.46%</div>

        <div>
          <div>Variable GFI APY</div>
        </div>
        <div className="flex justify-self-end">7.21%</div>

        <div>
          <div>Loan term</div>
        </div>
        <div className="flex justify-self-end">Open-ended</div>
      </div>
    </div>
  );
}
