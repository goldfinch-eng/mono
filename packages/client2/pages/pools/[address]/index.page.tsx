import { Fragment } from "react";

import { Breadcrumb } from "@/components/design-system/breadcrumb";
import { Button } from "@/components/design-system/button";
import { Chip } from "@/components/design-system/chip";
import { Stat } from "@/components/design-system/stat";
import {
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system/tabs";
import { Heading, Paragraph } from "@/components/design-system/typography";

import FundingBar from "./funding-bar";
import SupplyPanel from "./supply-panel";

// Dummy data
const tags = [
  "Latin America",
  "Women-Owned Businesses",
  "Secured Loan",
  "Ethical Supply Chain",
  "Small Businesses",
];

export default function PoolPage() {
  return (
    <>
      <div className="mb-8 flex flex-row justify-between">
        <div>
          <Breadcrumb label="Divibank" image="/content/divibank-logo.png" />
        </div>
        <div>
          <Button size="sm" className="mr-2">
            Share
          </Button>
          <Button size="sm" iconRight="ArrowTopRight" className="!py-2">
            Contract
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10 ">
        <div className="col-span-8">
          <Heading level={1} className="mb-3 font-serif text-sand-800">
            Small Business Loans in Latin America
          </Heading>

          <div className="mb-12 flex flex-wrap gap-1">
            {tags.map((t) => (
              <Chip key={`tag-${t}`}>{t}</Chip>
            ))}
          </div>

          <div className="mb-15 grid grid-cols-3 rounded-lg border border-eggplant-50">
            <div className="col-span-3 border-b border-eggplant-50 p-5">
              <FundingBar
                goal={10000000}
                backerSupply={2000000}
                seniorSupply={5200000}
              />
            </div>
            <div className="border-r border-eggplant-50 p-5">
              <Stat
                label="Drawdown cap"
                value="$10,000,000"
                tooltip="Tooltip text goes here"
              />
            </div>
            <div className="border-r border-eggplant-50 p-5">
              <Stat
                label="Payment Term"
                value="1096 days"
                tooltip="Tooltip text goes here"
              />
            </div>
            <div className="p-5">
              <Stat
                label="Payment frequency"
                value="30 days"
                tooltip="Tooltip text goes here"
              />
            </div>
          </div>

          <div>
            <TabGroup>
              <TabList>
                <TabButton>Deal Overview</TabButton>
                <TabButton>Borrower Profile</TabButton>
              </TabList>
              <TabPanels>
                <TabContent>
                  <Heading level={3} className="mb-8 !text-4xl">
                    Deal Overview
                  </Heading>
                  <Paragraph className="!text-2xl">
                    This is the product description which will support long
                    text. Lorem ipsum dolor sit amet, consectetur adipiscing
                    elit. Donec et orci vitae odio efficitur eleifend ac vitae
                    tellus. In gravida auctor est nec ullamcorper. Aliquam at
                    eros viverra, congue neque ut, blandit quam. Class aptent
                    taciti sociosqu ad litora torquent.
                  </Paragraph>
                </TabContent>
                <TabContent>Content 2</TabContent>
              </TabPanels>
            </TabGroup>
          </div>
        </div>

        <div className="relative col-span-4">
          <SupplyPanel apy={0.383} />
        </div>
      </div>
    </>
  );
}
