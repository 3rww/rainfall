import moment from 'moment'

/**
 * 
 * @param {str} dt - a date/time string
 * @param {str} when - one of ['start', 'end']
 */
export const parseDtToApiV1Kwargs = (dt, when) => {
    let m = moment.parseZone(dt)
    return {
        [`${when}year`] : m.year(),
        [`${when}month`] : m.month() + 1,
        [`${when}day`] : m.date(),
        [`${when}hour`] : m.hour()
    }
}