import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"

export enum Platform {
  Goldfinch = "Goldfinch",
  Curve = "Curve",
}

type LPAndStakeTokensProps = {
  // Token to deposit
  depositToken: ERC20Metadata
  // LP token received in exchange
  poolToken: ERC20Metadata
  // Platform of the liquidity pool
  platform: Platform
}

const Container = styled.div`
  display: flex;
`

const IconContainer = styled.div`
  position: relative;
`

const Icon = styled.img`
  background-color: #fff;
  padding: 4px;
  border-radius: 50%;
  height: ${({theme}) => theme.heights.iconHeight};
`

const IconLeft = styled(Icon)`
  margin-right: ${({theme}) => theme.heights.iconHeight};
`

const IconRight = styled(Icon)`
  position: absolute;
  left: 35px;
`

const SymbolAndSubtitle = styled.div`
  padding-left: 10px;
  align-self: center;
`

const Symbol = styled.div`
  font-size: 18px;
  font-weight: normal;
`

const Subtitle = styled.div`
  font-size: 14px;
  font-weight: normal;
  color: #897da3;
  padding-top: 5px;
`

export default function LPAndStakeTokens({depositToken, poolToken, platform}: LPAndStakeTokensProps) {
  const platformName = (() => {
    switch (platform) {
      case Platform.Curve:
        return "Curve FIDU-USDC pool"
      default:
        return platform.toString()
    }
  })()

  return (
    <Container>
      <IconContainer>
        <IconLeft src={depositToken.icon} alt={`${depositToken.name} icon`} />
        <IconRight src={poolToken.icon} alt={`${poolToken.name} icon`} />
      </IconContainer>
      <SymbolAndSubtitle>
        <Symbol>{`Deposit ${depositToken.ticker}`}</Symbol>
        <Subtitle>{`via ${platformName}`}</Subtitle>
      </SymbolAndSubtitle>
    </Container>
  )
}
