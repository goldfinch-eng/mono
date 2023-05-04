import NextLink from "next/link";

import { Button } from "@/components/design-system";

export function BacktoOpenDealsButton() {
  return (
    <NextLink href="/earn" passHref>
      <Button
        as="a"
        variant="rounded"
        size="sm"
        colorScheme="sand"
        iconLeft="ArrowLeft"
        className="mb-7 self-start"
      >
        Back to Open Deals
      </Button>
    </NextLink>
  );
}
