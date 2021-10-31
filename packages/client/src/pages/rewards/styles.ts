import styled from "styled-components"
import {mediaPoint} from "../../styles/mediaPoint"

interface DetailsContainerProps {
  open: boolean
  disabled: boolean
}

export const DetailsContainer = styled.div<DetailsContainerProps>`
  margin: -28px -30px 24px -30px;
  background-color: ${({theme}) => theme.colors.sandLight};
  padding: 30px;
  border-bottom-right-radius: 6px;
  border-bottom-left-radius: 6px;

  ${({open, theme}) => open && `border-top: 2px solid ${theme.colors.sand};`}

  ${({disabled, theme}) =>
    disabled &&
    `
      span, a {
        color: ${theme.colors.sandXxDark};
        pointer-events: none;
      }

      ${EtherscanLinkContainer} svg path {
        fill: ${theme.colors.sandXxDark};
      }
    `}

  ${({theme}) => mediaPoint(theme).screenL} {
    margin: -28px -25px 24px;
  }

  ${({theme}) => mediaPoint(theme).screenM} {
    margin: -28px 0 24px;
  }
`

export const ColumnsContainer = styled.div`
  display: flex;
  width: 100%;

  ${({theme}) => mediaPoint(theme).screenL} {
    flex-direction: column;
  }

  > * + * {
    margin-left: 12px;

    ${({theme}) => mediaPoint(theme).screenL} {
      margin: 24px 0 0 0;
    }
  }
`

export const Detail = styled.div`
  display: flex;
  flex-direction: column;

  > * + * {
    margin: 8px 0 0 0;
  }
`

export const DetailLabel = styled.span`
  color: ${({theme}) => theme.colors.purpLight};
  font-size: ${({theme}) => theme.typography.fontSize.sansSizeXs};
`

export const DetailValue = styled.span`
  color: ${({theme}) => theme.colors.purpDark};
  font-size: ${({theme}) => theme.typography.fontSize.sansSizeS};
`

export const Column = styled.div`
  width: 100%;

  > * + * {
    margin: 24px 12px 0 0;
  }
`

export const EtherscanLinkContainer = styled.div`
  margin-top: 40px;
`
