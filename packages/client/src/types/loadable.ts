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
