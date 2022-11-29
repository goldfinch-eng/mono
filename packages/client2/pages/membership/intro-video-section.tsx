import clsx from "clsx";
import { ReactNode } from "react";

export function IntroVideoSection({ className }: { className?: string }) {
  return (
    <div className={clsx("rounded-lg border border-sand-200 p-8", className)}>
      <h2 className="mb-10 text-2xl">
        How it works: Goldfinch Membership Vaults
      </h2>
      <div className="sm:hidden" style={{ aspectRatio: "660 / 1234" }}>
        <video autoPlay muted loop>
          <source
            src="/membership/intro-animation-vertical.mp4"
            type="video/mp4"
          />
        </video>
        <div className="mt-5 flex flex-col justify-evenly gap-5 text-center">
          <Steps />
        </div>
      </div>
      <div className="hidden sm:block" style={{ aspectRatio: "1898 / 816" }}>
        <video autoPlay muted loop>
          <source
            src="/membership/intro-animation-horizontal.mp4"
            type="video/mp4"
          />
        </video>
        <div className="sr-only">
          <Steps />
        </div>
      </div>
    </div>
  );
}

function Steps() {
  return (
    <>
      <Step heading="Deposit GFI and Capital">
        Put both GFI and Capital (FIDU, Backer NFT) in the Vault to become a
        Member. You can withdraw from the Vault at any time.
      </Step>
      <Step heading="Receive Boosted Yields">
        Enhance your yields with Member Rewards, a percentage of the Goldfinch
        Treasury distributed pro-rata based on your Member Vault position.
      </Step>
      <Step heading="Claim Rewards Weekly">
        Member Rewards are distributed weekly in FIDU, increasing your exposure
        to the Senior Pool. Withdrawing during a weekly cycle will forfeit
        rewards for that cycle.
      </Step>
    </>
  );
}

function Step({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="text-left">
      <div className="mb-2 text-lg font-medium">{heading}</div>
      <div>{children}</div>
    </div>
  );
}
