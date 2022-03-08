import { FieldReadFunction, InMemoryCacheConfig } from "@apollo/client";

import { goldfinchLogoPngUrl } from "@/components/logo";
import { metadata } from "@/constants";

function readFieldFromMetadata(
  fieldName: string,
  fallback: any = null
): FieldReadFunction {
  return (_, { readField }) => {
    const id = readField({ fieldName: "id" }) as string;
    if (!id) {
      console.warn(
        `Attempted to read the field ${fieldName} but ID was missing. Please include "id" in this query`
      );
      return;
    }
    return metadata[id]?.[fieldName] ?? fallback;
  };
}

export const typePolicies: InMemoryCacheConfig["typePolicies"] = {
  SeniorPool: {
    fields: {
      name: {
        read() {
          return "Goldfinch Senior Pool";
        },
      },
      category: {
        read() {
          return "Automated diversified portfolio";
        },
      },
      icon: {
        read() {
          return goldfinchLogoPngUrl;
        },
      },
    },
  },
  TranchedPool: {
    fields: {
      name: {
        read: readFieldFromMetadata("name"),
      },
      description: {
        read: readFieldFromMetadata("description"),
      },
      category: {
        read: readFieldFromMetadata("category"),
      },
      icon: {
        read: readFieldFromMetadata("icon"),
      },
    },
  },
};
