import {iconInfo} from "../icons"
import Banner from "../banner"

export const EstimatedSeniorPoolMatchingGFILaunchBanner = () => {
  return (
    <Banner>
      <div className="message extra-small">
        {iconInfo}
        <span>
          <span className="bold">Note:</span> The APY shown includes estimated GFI rewards that match what LPs would get
          for staking. This is not live yet, but it is has been voted on and is expected to launch in March. Upon
          launch, this reward will be retroactive and ongoing.{" "}
          <a
            href="https://snapshot.org/#/goldfinch.eth/proposal/0x10a390307e3834af5153dc58af0e20cbb0e08d38543be884b622b55bfcd5818d"
            target="_blank"
            rel="noreferrer"
          >
            Learn more in this proposal
          </a>
        </span>
      </div>
    </Banner>
  )
}
