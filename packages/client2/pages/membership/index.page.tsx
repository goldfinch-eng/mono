import { useState } from "react";

import { Button, Heading } from "@/components/design-system";
import { SEO } from "@/components/seo";

import { Explainer } from "./explainer";

export default function MembershipPage() {
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  return (
    <div>
      <SEO title="Membership" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading level={1}>Membership</Heading>
        <Button
          variant="rounded"
          colorScheme="secondary"
          iconRight="ArrowTopRight"
          onClick={() => setIsExplainerOpen(true)}
        >
          How does it work?
        </Button>
      </div>

      <Explainer
        isOpen={isExplainerOpen}
        onClose={() => setIsExplainerOpen(false)}
      />
    </div>
  );
}
