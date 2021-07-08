import { round } from "lodash-es";

export const paddedRound = (v, d) => round(v, d).toFixed(d);

export const pluralize = (v, singular, plural) => {
  return v > 0 ? (v === 1 ? singular : plural) : plural;
};

export const symDiffArray = (arr1, arr2) => {
  return arr1
    .filter((elem) => !arr2.includes(elem))
    .concat(arr2.filter((elem) => !arr1.includes(elem)));
}

export const symDiffArrayOfObjs = (arr1, arr2, onKey) => {
  let arr1Keys = arr1.map(a1 => a1[onKey])
  let arr2Keys = arr2.map(a2 => a2[onKey])
  return arr1
    .filter((a1) => !arr2Keys.includes(a1[onKey]))
    .concat(arr2.filter((a2) => !arr1Keys.includes(a2[onKey])));
}