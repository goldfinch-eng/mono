import {Ticker} from "../../ethereum/erc20"
import {StakedPositionType} from "../../ethereum/pool"

export function positionTypeToTicker(positionType: StakedPositionType): Ticker {
  switch (positionType) {
    case StakedPositionType.Fidu:
      return Ticker.FIDU
    case StakedPositionType.CurveLP:
      return Ticker.CURVE_FIDU_USDC
    default:
      throw new Error(`Unexpected positionType: ${positionType}`)
  }
}

export function tickerToPositionType(ticker: Ticker): StakedPositionType {
  switch (ticker) {
    case Ticker.FIDU:
      return StakedPositionType.Fidu
    case Ticker.CURVE_FIDU_USDC:
      return StakedPositionType.CurveLP
    default:
      throw new Error(`Unexpected ticker: ${ticker}`)
  }
}
