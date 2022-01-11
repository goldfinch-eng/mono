import {AssertionError} from "../utils"

export type Loadable<T> =
  | {
      loaded: true
      value: T
    }
  | {
      loaded: false
      value: undefined
    }

export type Loaded<T> = Loadable<T> & {loaded: true}

export type WithLoadedInfo<T extends {info: Loadable<U>}, U> = T & {info: Loaded<U>}

export function assertWithLoadedInfo<T extends {info: Loadable<U>}, U>(obj: T): asserts obj is WithLoadedInfo<T, U> {
  if (!obj.info.loaded) {
    throw new AssertionError("Info has not been loaded.")
  }
}
