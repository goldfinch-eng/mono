import payload from "payload";
import type { CollectionAfterChangeHook } from "payload/types";
import type { Media } from "../generated/payload-types";
import { revalidate } from "../lib/revalidate";

export const afterMediaChange: CollectionAfterChangeHook<Media> = async ({
  doc,
}) => {
  const deals = await payload.find({
    collection: "deals",
    where: { transactionStructure: { equals: doc.id } },
  });

  deals.docs.forEach(({ id }) => revalidate(`/pools/${id}`));
};
