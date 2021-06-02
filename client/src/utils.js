import _ from "lodash"

function croppedAddress(address) {
  if (!address) {
    return ""
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function displayNumber(val, decimals) {
  if (val === "") {
    return ""
  }
  const valFloat = parseFloat(val)
  if (!decimals && Math.floor(valFloat) === valFloat) {
    decimals = 0
  } else if (!decimals) {
    decimals = valFloat.toString().split(".")[1].length || 0
  }

  return commaFormat(valFloat.toFixed(decimals))
}

function commaFormat(numberString) {
  if (isNaN(numberString)) {
    return numberString
  }
  const [beforeDecimal, afterDecimal] = numberString.split(".")
  let withCommas = []
  _.reverse(_.split(beforeDecimal, "")).forEach((letter, i) => {
    if (i % 3 === 0 && i > 0) {
      withCommas.push(",")
    }
    withCommas.push(letter)
  })

  const decimalString = afterDecimal ? "." + afterDecimal : ""

  return `${_.join(_.reverse(withCommas), "")}${decimalString}`
}

function displayDollars(val, decimals = 2) {
  const valDisplay = isNaN(val) ? " --.--" : displayNumber(val, decimals)
  return "$" + valDisplay
}

function displayPercent(val, decimals = 2) {
  let valDisplay
  if (isNaN(val)) {
    valDisplay = "--.--"
  } else {
    valDisplay = displayNumber(val.multipliedBy(100), decimals)
  }
  return `${valDisplay}%`
}

function roundUpPenny(val) {
  return Math.ceil(val * 100) / 100
}

function roundDownPenny(val) {
  return Math.floor(val * 100) / 100
}

export { croppedAddress, displayNumber, displayDollars, roundUpPenny, roundDownPenny, displayPercent }
