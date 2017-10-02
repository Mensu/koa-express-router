/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * Copyright(c) 2017 Mensu Chen (yxshw55@qq.com)
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

const pathRegexp = require('path-to-regexp');
const debug = require('debug')('koa-express-router:layer');

/**
 * Module constiables.
 * @private
 */

const hasOwnProperty = Reflect.hasOwnProperty;

/**
 * Module exports.
 * @public
 */

class Layer {
  /**
   *
   * @param {string} path
   * @param {any} options
   * @param {(ctx: Context, next: () => Promise<any>) => any} fn
   */
  constructor(path, options, fn) {
    debug('new %o', path);
    const opts = options || {};

    /** @type {string} */
    this.method = undefined;
    this.handle = fn;
    this.name = fn.name || '<anonymous>';
    this.params = undefined;
    /** @type {string} */
    this.path = undefined;
    this._query = undefined;
    /** @type {{[key: string]: (expected: any, actual: any) => boolean}} */
    this.queryCheckers = {};
    /** @type {string[]} */
    this.queryKeys = [];
    this.route = undefined;
    this.regexp = pathRegexp(path, this.keys = [], opts);

    // set fast path flags
    this.regexp.fast_star = path === '*';
    this.regexp.fast_slash = path === '/' && opts.end === false;
  }

  /**
   * Handle the request for the layer.
   *
   * @param {Context}            ctx
   * @param {{(): Promise<any>}} next
   * @api private
   */
  handle_request(ctx, next) {
    const fn = this.handle;

    if (fn.length > 3) {
      // not a standard request handler
      return next();
    }

    return this.handle(ctx, next);
  }

  /**
   * Check if this route matches `path`, if so
   * populate `.params`.
   *
   * @param  {string}  path
   * @param  {any}     query
   * @return {boolean}
   * @api private
   */

  match(path, query) {
    let match;
    const queryMatched = this.queryMatch(query);

    if (path !== null) {
      // fast path non-ending match for / (any path matches)
      if (this.regexp.fast_slash) {
        this.params = {};
        this.path = '';
        return queryMatched;
      }

      // fast path for * (everything matched in a param)
      if (this.regexp.fast_star) {
        this.params = { 0: decode_param(path) };
        this.path = path;
        return queryMatched;
      }

      // match the path
      match = this.regexp.exec(path);
    }

    if (!match) {
      this.params = undefined;
      this.path = undefined;
      return false;
    }

    // store values
    this.params = {};
    this.path = match[0];

    const keys = this.keys;
    const params = this.params;

    for (let i = 1; i < match.length; i += 1) {
      const key = keys[i - 1];
      const prop = key.name;
      const val = decode_param(match[i]);

      if (val !== undefined || !(hasOwnProperty.call(params, prop))) {
        params[prop] = val;
      }
    }

    return queryMatched;
  }

  get query() {
    return this._query;
  }

  set query(newQuery) {
    if (!newQuery || Object.keys(newQuery).length === 0) {
      this._query = undefined;
      this.queryKeys = [];
      this.queryCheckers = {};
      return;
    }
    this._query = newQuery;
    this.queryKeys = Object.keys(newQuery);
    this.queryCheckers = {};
    // set checkers
    this.queryKeys.forEach((key) => {
      let checker;
      if (typeof newQuery[key] === 'string') {
        checker = (expected, actual) => actual === expected;
      } else if (newQuery[key] instanceof RegExp) {
        checker = (expected, actual) => expected.exec(actual);
      } else if (Array.isArray(newQuery[key])) {
        checker = (expected, actual) => expected.indexOf(actual) !== -1;
      } else if (typeof newQuery[key] === 'function') {
        checker = (expected, actual) => expected(actual);
      } else {
        checker = (expected, actual) => {
          try {
            return expected === JSON.parse(actual);
          } catch (e) {
            return false;
          }
        };
      }
      this.queryCheckers[key] = checker;
    });
  }

  /**
   * check whether query matches
   * @param {any} actualQuery
   */
  queryMatch(actualQuery) {
    if (!this._query) {
      return true;
    }

    return this.queryKeys.every(key => this.queryCheckers[key](this._query[key], actualQuery[key]));
  }
}

module.exports = Layer;

/**
 * Decode param value.
 *
 * @param {string} val
 * @return {string}
 * @private
 */

function decode_param(val) {
  if (typeof val !== 'string' || val.length === 0) {
    return val;
  }

  try {
    return decodeURIComponent(val);
  } catch (err) {
    if (err instanceof URIError) {
      err.message = `Failed to decode param '${val}'`;
      err.status = err.statusCode = 400;
    }

    throw err;
  }
}
