import { Heading } from "@/components/typography";

import { PortfolioSection } from "./portfolio-section";

export default function SeniorPoolPage() {
  return (
    <div>
      <Heading level={1} className="mb-4">
        Senior Pool
      </Heading>
      <PortfolioSection />
    </div>
  );
}
