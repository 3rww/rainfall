import { scaleLinear } from 'd3';
import {
    each as _each,
    mergeWith,
} from 'lodash';

export const store = {
    data: {},
    current: '',
};

/**
 * store rainfall tallies from the Rainfall API
 * @param {*} data
 */
export const RainfallTally = class {
    /**
     * pass in the initial API response, and pre-calculate some things
     */
    constructor(data) {
        // store the data
        this.data = data;
        // populate a list of times
        this.times = Object.keys(this.data);
        // total rainfall per cell
        this.total = {};
        // accumulation per cell
        this.accumulation = {};
        this.domainMax = 0;

        // stub out the accumulation property with all cell ids, each set to zero
        Object.keys(this.data[Object.keys(this.data)[0]]).forEach((x) => {
            this.accumulation[x] = 0;
            this.total[x] = 0;
        });

        // calculate total rainfall per cell, and determine max rainfall anywhere
        this._tally();
        // implement a streth function from D3 using available data
        this.stretch = scaleLinear()
            .domain([0, this.domainMax])
            .range([0.15, 1]);
    }
    /**
     * helper method, applies mergeWith with an additive customizer function
     * @param {*} source
     * @param {*} plus
     */
    static _merger(source, plus) {
        return mergeWith(source, plus, (objValue, srcValue) => objValue + srcValue);
    }
    /**
     * calculate total accumulation per cell. Effectively, this does what accumulator does, except
     * all at once and ahead of time.
     * @param {*} data
     */
    _tally() {
        // accumulate total rainfall per cell from the data
        _each(this.data, (v, k) => {
            this._merger(this.total, v);
        });
        // set the upper bounds
        _each(this.total, (v, k) => {
            if (v > this.domainMax) {
                this.domainMax = v;
            }
        });
    }
    /**
     * Increment rainfall total by cell ID, passing in a new rainfall response object for a given time.
     * Updates the accumulation property
     */
    accumulator(addThis) {
        return this._merger(this.accumulation, addThis);
    }
};