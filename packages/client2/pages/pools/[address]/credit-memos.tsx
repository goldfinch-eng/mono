import { gql } from "@apollo/client";
import { format } from "date-fns";
import Image from "next/future/image";

import { Button } from "@/components/design-system";
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

interface CreditMemoProps {
  creditMemos: CreditMemoFieldsFragment[];
}

export function CreditMemos({ creditMemos }: CreditMemoProps) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Credit memos</h3>
      <p className="mb-8">
        Independent analysis and summary of this deal by credit experts
      </p>
      <ul className="divide-y divide-sand-100 border-y border-sand-100">
        {creditMemos.map((memo) => {
          const image =
            memo.thumbnail?.sizes?.thumbnail?.url ?? memo.thumbnail?.url;

          return (
            <li className="flex py-5" key={`credit-memo-${memo.id}`}>
              {image ? (
                <Image
                  src={image}
                  alt={
                    memo.thumbnail?.alt
                      ? memo.thumbnail?.alt
                      : memo.name
                      ? memo.name
                      : ""
                  }
                  className="mr-5 h-14 w-14 overflow-hidden rounded-full object-contain"
                  width={56}
                  height={56}
                />
              ) : null}
              <div className="flex-1">
                <div className="mb-4 flex justify-between">
                  <div>
                    <h4 className="mb-1 font-medium">{memo.name}</h4>
                    <h5 className="text-sm text-sand-500">{memo.subtitle}</h5>
                  </div>
                  <div className="flex gap-2">
                    {memo.executiveSummaryUrl ? (
                      <div>
                        <Button
                          variant="rounded"
                          colorScheme="secondary"
                          as="a"
                          href={memo.executiveSummaryUrl}
                          iconRight="ArrowTopRight"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Executive summary
                        </Button>
                      </div>
                    ) : null}

                    {memo.fullMemoUrl ? (
                      <div>
                        <Button
                          variant="rounded"
                          colorScheme="secondary"
                          as="a"
                          href={memo.fullMemoUrl}
                          iconRight="ArrowTopRight"
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Full memo
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {memo.content ? (
                  <p className="mb-3 whitespace-pre-line">{memo.content}</p>
                ) : null}
                {memo.date ? (
                  <div className="text-sm text-sand-500">
                    {format(new Date(memo.date), "MMM d, y")}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
