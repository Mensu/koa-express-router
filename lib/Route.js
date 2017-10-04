/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * Copyright(c) 2017 Mensu Chen
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */
const { inspect } = require('util');
const methods = require('methods');
const debug = require('debug')('koa-express-router:route');
const Layer = require('./Layer');

class Route {
  /**
   * Initialize `Route` with the given `path`,
   *
   * @param {string} path
   * @public
   */
  constructor(path) {
    this.path = path;
    /** @type {Layer[]} */
    this.stack = [];

    debug('new %o', path);

    // route handlers for various http methods
    /** @type {{[method: string]: boolean}} */
    this.methods = {};
  }

  /**
   * Determine if the route handles a given method.
   * @api private
   */
  _handles_method(method) {
    if (this.methods._all) {
      return true;
    }

    let name = method.toLowerCase();

    if (name === 'head' && !this.methods.head) {
      name = 'get';
    }

    return Boolean(this.methods[name]);
  }

  /**
   * get supported HTTP methods
   * @return {string[]} supported HTTP methods
   * @api private
   */
  _options() {
    const methodsArr = Object.keys(this.methods);

    // append automatic head
    if (this.methods.get && !this.methods.head) {
      methodsArr.push('head');
    }

    for (let i = 0; i < methodsArr.length; i += 1) {
      // make upper case
      methodsArr[i] = methodsArr[i].toUpperCase();
    }

    return methodsArr;
  }

  /**
   * dispatch ctx into this route
   * @param {Context} ctx
   * @param {{(signal?: string): any}} next
   * @api public
  */
  async dispatch(ctx, next = () => {}) {
    let idx = 0;
    const stack = this.stack;
    if (stack.length === 0) {
      return next();
    }

    let method = ctx.method.toLowerCase();
    if (method === 'head' && !this.methods.head) {
      method = 'get';
    }

    ctx.route = this;

    return route_next();

    async function route_next(signal) {
      // signal to skip current route
      if (signal && signal === 'route') {
        return next();
      }

      // signal to skip current router
      if (signal && signal === 'router') {
        return next(signal);
      }

      const layer = stack[idx];
      idx += 1;
      if (!layer) {
        return next();
      }

      if (layer.method && layer.method !== method) {
        return route_next();
      }

      if (!layer.queryMatch(ctx.query)) {
        return route_next();
      }

      // ==> middleware(ctx, next)
      return layer.handle_request(ctx, route_next);
    }
  }

  /**
   * Add a handler for all HTTP verbs to this route.
   *
   * Behaves just like middleware and can respond or call `next`
   * to continue processing.
   *
   * You can use multiple `.all` call to add multiple handlers.
   *
   * ```js
   *   function check_something(ctx, next) {
   *     return next();
   *   };
   *
   *   function validate_user(ctx, next) {
   *     return next();
   *   };
   *
   *   route
   *   .all(validate_user)
   *   .all(check_something)
   *   .get(function(ctx, next) {
   *     ctx.body ='hello world';
   *   });
   *```
   * @param  {...IMiddleware} middlewares
   * @api public
   */
  all(...middlewares) {
    return this.method('_all', ...middlewares);
  }

  /**
   * delegated method handler
   * @param  {string}         methodName
   * @param  {...IMiddleware} middlewares
   * @api private
   */
  method(methodName, ...middlewares) {
    let query;
    if (middlewares[0] && typeof middlewares[0] !== 'function') {
      query = middlewares.shift();
    }
    const isAll = methodName === '_all';
    for (let i = 0; i < middlewares.length; i += 1) {
      const handle = middlewares[i];

      if (typeof handle !== 'function') {
        const msg = `Route.${isAll ? 'all' : methodName}() requires callback functions but got a ${inspect(handle, { depth: null })}`;
        throw new TypeError(msg);
      }

      debug('%s %o', methodName, this.path);

      const layer = new Layer('/', {}, handle);
      layer.method = isAll ? undefined : methodName;
      layer.query = query;

      this.methods[methodName] = true;
      this.stack.push(layer);
    }

    return this;
  }
}

methods.forEach((method) => {
  Route.prototype[method] = function route_method_handler(...middlewares) {
    return this.method(method, ...middlewares);
  };
});

// @ts-ignore
Route.prototype.del = Route.prototype.delete;

module.exports = Route;
