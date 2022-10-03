import { useState } from "react";

import { Button, Heading } from "@/components/design-system";
import { SEO } from "@/components/seo";

import { AssetGroup } from "./asset-group";
import { Explainer } from "./explainer";

export default function MembershipPage() {
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  return (
    <div>
      <SEO title="Membership" />
      <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
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

      <div className="mb-16">Chart goes here</div>
      <div>
        <h2 className="mb-10 text-4xl">Vault</h2>
        <div className="flex flex-col justify-between gap-10 lg:flex-row">
          <AssetGroup
            heading="Available assets"
            assets={[]}
            background="sand"
            className="grow"
            buttonText="Add to vault"
            onButtonClick={() => alert("unimplemented")}
          />
          <AssetGroup
            heading="Assets in vault"
            assets={[]}
            background="gold"
            className="grow"
            buttonText="Remove from vault"
            onButtonClick={() => alert("unimplemented")}
          />
        </div>
      </div>
    </div>
  );
}
