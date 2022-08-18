import {useMediaQuery} from "react-responsive"
import styled from "styled-components"
import Tooltip from "../../ui/components/Tooltip"
import {WIDTH_TYPES} from "../styleConstants"

const StyledTooltip = styled(Tooltip)`
  max-width: 300px;
`

type FormMethod = "deposit" | "withdrawClaimZap" | "withdrawUnzap"
interface TranchedPoolFundsSourceTooltipProps {
  formMethod: FormMethod
}

const FORM_METHOD_TO_TOOLTIP_MESSAGE: {
  [K in FormMethod]: string
} = {
  deposit:
    "Select whether your supply capital will come from your wallet or be transferred from an amount you previously supplied to the Senior Pool",
  withdrawUnzap:
    "Withdraw principal deposited from a wallet or a staked FIDU position. Funds deposited from a wallet will be returned to the wallet. Funds deposited from a staked FIDU position will be converted back to FIDU and returned to your staked position.",
  withdrawClaimZap:
    "Redeem principal and interest deposited from a wallet or a staked FIDU position. Funds deposited from a wallet will be redeemed to the wallet. If redeeming funds deposited from a staked FIDU position you will be prompted to sign two transactions, and then the funds will be redeemed to your wallet.",
}

export default function TranchedPoolFundsSourceTooltip({formMethod}: TranchedPoolFundsSourceTooltipProps) {
  const isTabletOrMobile = useMediaQuery({
    query: `(max-width: ${WIDTH_TYPES.screenM})`,
  })

  return (
    <StyledTooltip
      id="tranched-pool-deposit-tooltip"
      delayHide={isTabletOrMobile ? 50 : 400}
      className="tooltip-container"
      place="left"
    >
      <div>
        <p>{FORM_METHOD_TO_TOOLTIP_MESSAGE[formMethod]}</p>
      </div>
    </StyledTooltip>
  )
}
