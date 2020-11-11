import { round } from 'lodash-es'

export const paddedRound = (v, d) => round(v, d).toFixed(d)

