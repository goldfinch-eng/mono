import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { gql } from "graphql-request";
import Image from "next/future/image";

import { Button, Chip } from "@/components/design-system";
import { CreditMemoFieldsFragment } from "@/lib/graphql/generated";

export const CREDIT_MEMO_FIELDS = gql`
  fragment CreditMemoFields on Deal_CreditMemos {
    id
    thumbnail {
      url
      alt
      sizes {
        thumbnail {
          url
        }
      }
    }
    name
    subtitle
    content
    date
    fullMemoUrl
    executiveSummaryUrl
  }
`;

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
      <div className="mb-5 flex flex-col items-start justify-between gap-2 md:flex-row">
        <div className="flex items-start pr-8">
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
        <Chip
          iconLeft="Checkmark"
          colorScheme="mint"
          className="flex h-8 min-w-fit items-center"
        >
          Vetted reviewer
        </Chip>
      </div>
      <div className="mb-5 text-sm">{content}</div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
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
