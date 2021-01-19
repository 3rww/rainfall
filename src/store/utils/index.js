import { round } from 'lodash-es'

export const paddedRound = (v, d) => round(v, d).toFixed(d)

export const pluralize = (v, singular, plural) => {
  return (v > 0) ? (
    (v == 1) ? (
      singular
    ): (
      plural
    )
  ) : (
    plural
  )
}