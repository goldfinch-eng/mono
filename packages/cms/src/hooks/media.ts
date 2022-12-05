import payload from "payload";
import type { CollectionAfterChangeHook } from "payload/types";
import type { Deal, Media } from "../generated/payload-types";
import { revalidate } from "../lib/revalidate";

export const afterMediaChange: CollectionAfterChangeHook<Media> = async ({
  doc,
}) => {
  const deals = await payload.find<Deal>({
    collection: "deals",
    where: { transactionStructure: { equals: doc.id } },
  });

  deals.docs.forEach(({ id }) => revalidate(`/pools/${id}`));
};
