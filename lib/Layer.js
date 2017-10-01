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
    /** @type {Obj} */
    this.query = undefined;
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
   * @param  {Context} ctx
   * @return {boolean}
   * @api private
   */

  match(path, ctx) {
    let match;
    const { query } = ctx;
    const queryMatched = this.queryMatch(query, ctx);

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

  /**
   * check whether query matches
   * @param {any} query
   * @param {Context} ctx
   */
  queryMatch(query, ctx) {
    if (!this.query) {
      return true;
    }

    return Object.keys(this.query).every((key) => {
      const expectedVal = this.query[key];
      const typeStr = typeof expectedVal;
      if (typeStr === 'string') {
        return expectedVal === query[key];
      }
      if (expectedVal instanceof RegExp) {
        return expectedVal.exec(query[key]);
      }
      if (Array.isArray(expectedVal)) {
        return expectedVal.indexOf(query[key]) !== -1;
      }
      if (typeStr === 'function') {
        return expectedVal(query[key], ctx);
      }
      try {
        return expectedVal === JSON.parse(query[key]);
      } catch (e) {
        return false;
      }
    });
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
