import { Sentinel } from "@/components/sentinel";

export function LegalAgreement({ onRead }: { onRead: () => void }) {
  return (
    <div>
      <div className="text-xs">
        By selecting “Submit” below, you hereby acknowledge that (i) you are
        agreeing to place your GFI, FIDU, or Backer NFTs (“Goldfinch Assets”),
        in the amounts shown above, into the Goldfinch Membership Vault
        (“Membership Vault”), and (ii) you have reviewed the Terms of Service
        for the Goldfinch protocol and are not prohibited from participating in
        the Goldfinch protocol. By placing your Goldfinch Assets in the
        Membership Vault, you may become eligible to receive Membership Rewards
        in the form of FIDU, based on a pro-rate allocation. For the avoidance
        of doubt, in order to become eligible to receive Membership Rewards
        during a specific epoch, your Goldfinch Assets must remain in the
        Membership Vault for the entire duration of that epoch. You may remove
        your Goldfinch Assets from the Membership Vault at any time; however,
        you will not be eligible to receive Membership Rewards for the epoch in
        which you remove your Goldfinch Assets from the Membership Vault. After
        you have earned Membership Rewards during a specific epoch, you may
        claim those rewards through the Goldfinch dApp.
      </div>
      <Sentinel onVisible={onRead} />
    </div>
  );
}
