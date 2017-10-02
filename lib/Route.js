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

const { inspect } = require('util');
const debug = require('debug')('koa-express-router:route');
const Layer = require('./Layer');

/**
 * Module exports.
 * @public
 */

/**
 * Initialize `Route` with the given `path`,
 *
 * @param {string} path
 * @public
 */

class Route {
  /**
   * initialize a Route instance
   * @param {string} path
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
   * @private
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
   * @return {string[]} supported HTTP methods
   * @private
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
   * @private
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

    // ctx.route = this;

    return routeNext();

    async function routeNext(signal) {
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
        return routeNext();
      }

      if (!layer.queryMatch(ctx.query, ctx)) {
        return routeNext();
      }

      // ==> middleware(ctx, next)
      return layer.handle_request(ctx, routeNext);
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
   * HTTP get method
   * @param {...IMiddleware} middlewares
   */
  get(...middlewares) {
    return this.method('get', ...middlewares);
  }

  /**
   * HTTP post method
   * @param {...IMiddleware} middlewares
   */
  post(...middlewares) {
    return this.method('post', ...middlewares);
  }

  /**
   * HTTP delete method
   * @param {...IMiddleware} middlewares
   */
  delete(...middlewares) {
    return this.method('delete', ...middlewares);
  }

  /**
   * HTTP put method
   * @param {...IMiddleware} middlewares
   */
  put(...middlewares) {
    return this.method('put', ...middlewares);
  }

  /**
   * HTTP patch method
   * @param {...IMiddleware} middlewares
   */
  patch(...middlewares) {
    return this.method('patch', ...middlewares);
  }


  /**
   * HTTP head method
   * @param {...IMiddleware} middlewares
   */
  head(...middlewares) {
    return this.method('head', ...middlewares);
  }

  /**
   * HTTP options method
   * @param {...IMiddleware} middlewares
   */
  options(...middlewares) {
    return this.method('options', ...middlewares);
  }

  /**
   * 添加方法处理器
   * @param  {string}         methodName   方法名
   * @param  {...IMiddleware} middlewares  中间件
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

module.exports = Route;
