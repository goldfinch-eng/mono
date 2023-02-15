import clsx from "clsx";
import { format as formatDate } from "date-fns";
import Image from "next/future/image";

import { Button, Chip, Icon } from "@/components/design-system";
import { CreditMemoFieldsFragment } from "@/lib/graphql/generated";

interface CreditMemoAnalysisCardProps {
  creditMemo: CreditMemoFieldsFragment;
  className?: string;
}

export function CreditMemoAnalysisCard({
  creditMemo,
  className,
}: CreditMemoAnalysisCardProps) {
  const {
    thumbnail,
    name,
    content,
    subtitle,
    executiveSummaryUrl,
    fullMemoUrl,
    date,
  } = creditMemo;

  return (
    <div className={clsx(className, "rounded-xl bg-mustard-100 p-6")}>
      <div className="mb-5 flex justify-between">
        <div className="flex items-center pr-8">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand-200">
            {thumbnail?.url ? (
              <Image
                src={thumbnail?.url}
                alt={`${thumbnail?.alt}`}
                fill
                sizes="48px"
                className="object-contain"
              />
            ) : null}
          </div>
          <div className="ml-3.5">
            <div className="mb-0.5 font-medium">{name}</div>
            <div className="text-xs text-sand-500">{subtitle}</div>
          </div>
        </div>
        <Chip colorScheme="mint" className="flex h-8 min-w-fit items-center">
          <Icon name="Checkmark" size="sm" className="mr-2.5" />
          Vetted reviewer
        </Chip>
      </div>
      <div className="mb-5 text-sm">{content}</div>
      <div className="flex items-center justify-between">
        <div className="flex">
          {executiveSummaryUrl && (
            <Button
              as="a"
              colorScheme="secondary"
              variant="rounded"
              iconRight="ArrowTopRight"
              className="mr-1.5"
              target="_blank"
              rel="noopener"
              href={executiveSummaryUrl}
            >
              Executive Summary
            </Button>
          )}
          {fullMemoUrl && (
            <Button
              as="a"
              colorScheme="secondary"
              variant="rounded"
              iconRight="ArrowTopRight"
              target="_blank"
              rel="noopener"
              href={fullMemoUrl}
            >
              Full Memo
            </Button>
          )}
        </div>
        <div className="text-xs text-sand-500">
          {`Posted ${formatDate(new Date(date), "MMM d, y")}`}
        </div>
      </div>
    </div>
  );
}
