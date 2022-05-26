import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"

export enum Platform {
  Goldfinch = "Goldfinch",
  Curve = "Curve",
}

type StakingTokenProps = {
  // Token to stake
  token: ERC20Metadata
  // Platform of the staking token
  platform: Platform
}

const Container = styled.div`
  display: flex;
`

const Icon = styled.img`
  background-color: #fff;
  padding: 4px;
  border-radius: 50%;
  height: ${({theme}) => theme.heights.iconHeight};
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

export default function StakingToken({token, platform}: StakingTokenProps) {
  const platformName = (() => {
    switch (platform) {
      case Platform.Curve:
        return "Curve LP"
      default:
        return platform.toString()
    }
  })()

  return (
    <Container>
      <Icon src={token.icon} alt={`${token.name} icon`} />
      <SymbolAndSubtitle>
        <Symbol>{token.ticker}</Symbol>
        <Subtitle>{`${platformName} token`}</Subtitle>
      </SymbolAndSubtitle>
    </Container>
  )
}
