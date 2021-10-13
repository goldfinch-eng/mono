import styled from "styled-components"

const fontSizes = {
  sansSizeXxs: "12",
  sansSixeXs: "15",
  sansSizeS: "18",
  sansSizeM: "21",
  sansSizeBase: "24",
  sansSizeMl: "28",
  sansSizeL: "32",
  sansSizeXl: "36",
  sansSizeXxl: "42",
}

function getFontSize({size}) {
  let fontSize = "14"
  if (size === 12) fontSize = fontSizes.sansSizeXxs
  if (size === 15) fontSize = fontSizes.sansSixeXs
  if (size === 18) fontSize = fontSizes.sansSizeS
  if (size === 21) fontSize = fontSizes.sansSizeM
  if (size === 24) fontSize = fontSizes.sansSizeBase
  if (size === 28) fontSize = fontSizes.sansSizeMl
  if (size === 32) fontSize = fontSizes.sansSizeL
  if (size === 36) fontSize = fontSizes.sansSizeXl
  if (size === 42) fontSize = fontSizes.sansSizeXxl
  return `font-size: ${fontSize}px`
}

const Text = styled.span`
  margin: 0;
  ${getFontSize};
  ${({color}) => color && `color: ${color}`};
  ${({align}) => align && `text-align: ${align}`};
`

export default Text
