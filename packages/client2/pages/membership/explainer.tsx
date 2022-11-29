import { ReactNode } from "react";

import { Drawer, DrawerProps, Link } from "@/components/design-system";

type ExplainerProps = Omit<DrawerProps, "children" | "size" | "from">;

export function Explainer({ isOpen, onClose }: ExplainerProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      from="right"
      size="sm"
      title="How does Membership work?"
    >
      <div className="space-y-4">
        <Section heading="Introduction to vaults">
          <div className="space-y-4">
            <p>
              Goldfinch Membership is the first phase of a broader tokenomics
              redesign (Tokenomics v2), which was{" "}
              <Link href="https://gov.goldfinch.finance/t/gip-27-proposed-changes-to-membership-vaults-for-initial-release/1231">
                approved
              </Link>{" "}
              by the protocol&apos;s community in 2022 and focuses on enhancing
              the utility of GFI. Membership is designed to empower Goldfinch
              Investors to support the protocol&apos;s security and expansion
              while increasing their participation.
            </p>
            <p>
              Goldfinch Members receive yield enhancements via Member Rewards,
              which have been earmarked from the Goldfinch treasury and are
              distributed pro-rata based on one&apos;s Membership Vault
              position. In addition, Members will gain access to exclusive
              communication channels, special offers, and more.
            </p>
            <p>
              There are only two requirements to participate in Goldfinch
              Membership: being a Senior Pool LP or Backer on Goldfinch
              (represented by holding staked{" "}
              <Link
                openInNewTab
                href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/liquidityproviders#fidu"
              >
                FIDU
              </Link>{" "}
              and/or an active{" "}
              <Link
                openInNewTab
                href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/backers"
              >
                Backer NFT
              </Link>
              ), and holding{" "}
              <Link
                openInNewTab
                href="https://medium.com/goldfinch-fi/introducing-the-goldfinch-protocol-token-gfi-e09579fd9740"
              >
                GFI
              </Link>
              .
            </p>
            <p>
              To become a Member, one only needs to lock their staked FIDU or
              Backer NFTs, plus GFI, into a Membership Vault. To optimize the
              yields you can receive, balanced is best: matching the dollar
              value of the GFI and assets you deposit to the vault will balance
              the vault ratio and increase your potential Member Reward yield.
            </p>
          </div>
        </Section>
        <Section heading="How are the estimated Member Rewards calculated?">
          <p className="mb-4">
            Estimated Member Rewards are calculated based on a) one&apos;s
            Membership Vault position, and b) on the distribution of total
            capital in the Membership Vault overall.
          </p>
          <ul className="list-disc space-y-4 pl-5">
            <li>
              This number is an estimate because rewards are distributed
              pro-rata to Members at the end of each reward cycle—as such, other
              Investors entering or exiting the Membership Vault during a reward
              cycle will change the percentage of rewards one is expected to
              receive, due to changing what percentage of the Vault one&apos;s
              individual position represents.
            </li>
            <li>
              The estimated Member Rewards displayed is a dynamic number that
              reflects the distribution of total capital in the Membership Vault
              overall at that moment in time and one&apos;s Member Vault
              position at that moment in time.
            </li>
            <li>
              A Member&apos;s precise share of Member Rewards is calculated
              using the Cobb-Douglas function, an equation commonly used in
              economic analysis for balanced input relationships generating an
              output.
            </li>
            <li>
              If a participant deposits assets into the Membership Vault during
              a weekly reward cycle their assets will begin accumulating Member
              Rewards at the beginning of the next weekly reward cycle. While
              Members can withdraw their deposited assets at any time to exit
              Membership, if they withdraw before the end of a weekly reward
              cycle they will forfeit any Member Rewards they would have
              received during that cycle.
            </li>
          </ul>
        </Section>
      </div>
    </Drawer>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-sand-200 bg-sand-100 p-5">
      <h3 className="mb-4 text-lg font-medium">{heading}</h3>
      <div>{children}</div>
    </div>
  );
}
