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
const Route = require('./Route');
const Layer = require('./Layer');
const debug = require('debug')('koa-express-router:index');
const flatten = require('array-flatten');
const methods = require('methods');
const parseUrl = require('parseurl');

class Router {
  /**
   * Initialize a new `Router` with the given `options`.
   *
   * @typedef   {Object}          RouterOptions
   * @property  {boolean}         [caseSensitive=false]
   * @property  {boolean}         [mergeParams=false]
   * @property  {boolean}         [strict=false]
   * @property  {string}          [prefix='']
   * @param     {RouterOptions}   options
   * @public
   */
  constructor(options = {}) {
    this.params = {};
    this._params = [];
    const opts = Object.assign({}, Router.defaultOptions, options);
    this.caseSensitive = opts.caseSensitive;
    this.mergeParams = opts.mergeParams;
    this.strict = opts.strict;
    this.prefix = opts.prefix;
    /** @type {Layer[]} */
    this.stack = [];
  }

  /**
   * export router as a useable middleware
   * @return {IMiddleware}
   * @api public
   */
  routes(usedByRouter = true) {
    const self = this;
    /**
     *
     * @param {Context} ctx
     * @param {{(): Promise<any>}} next
     */
    async function router(ctx, next) {
      return self.handle(ctx, next);
    }
    router.router = self;
    if (!usedByRouter && self.prefix) {
      const wrapper = new Router();
      wrapper.use(router);
      return wrapper.routes();
    }
    return router;
  }

  /**
   * Map the given param placeholder `name`(s) to the given callback.
   *
   * Parameter mapping is used to provide pre-conditions to routes
   * which use normalized placeholders. For example a _:user_id_ parameter
   * could automatically load a user's information from the database without
   * any additional code,
   *
   * The callback uses the same signature as middleware, the only difference
   * being that the value of the placeholder is passed, in this case the _id_
   * of the user. Once the `next()` function is invoked, just like middleware
   * it will continue on to execute the route, or subsequent parameter functions.
   *
   * Just like in middleware, you must either respond to the request or call next
   * to avoid stalling the request.
   *
   * ```js
   *  router.param('user_id', async (ctx, next, id, name) => {
   *    try {
   *      await User.find(id);
   *    } catch (e) {
   *      throw new Error('failed to load user');
   *    }
   *    ctx.user = user;
   *    return next();
   *  });
   * ```
   *
   * @param {string}              name
   * @param {...IParamMiddleware} middlewares
   * @api public
   */
  param(name, ...middlewares) {
    // apply param functions
    const params = this._params;
    const len = params.length;
    let ret;

    for (let fn of middlewares) {
      for (let i = 0; i < len; i += 1) {
        ret = params[i](name, fn);
        if (ret) {
          fn = ret;
        }
      }

      // ensure we end up with a middleware function
      if (typeof fn !== 'function') {
        throw new Error(`invalid param() call for ${name}, got ${inspect(fn, { depth: null })}`);
      }

      this.params[name] = this.params[name] || [];
      this.params[name].push(fn);
    }

    return this;
  }

  /**
   * Dispatch a ctx into the router.
   * @param {Context} ctx
   * @param {{(signal?: string): any}} next
   * @api private
   */
  async handle(ctx, next = () => {}) {
    const self = this;

    debug('dispatching %s %s', ctx.method, ctx.url);

    let idx = 0;
    let removed = '';
    let slashAdded = false;
    const protohost = getProtohost(ctx.url) || '';
    const paramcalled = {};

    // store options for OPTIONS request
    // only used if OPTIONS request
    const options = [];

    // middleware and routes
    const stack = self.stack;

    // manage inter-router constiables
    const parentParams = ctx.params;
    const parentUrl = ctx.baseUrl || '';

    const propsToRestore = ['baseUrl', 'params', 'next'];
    // store vals
    const vals = new Array(propsToRestore.length);
    for (let i = 0; i < propsToRestore.length; i += 1) {
      vals[i] = ctx[propsToRestore[i]];
    }

    ctx.next = router_next;
    ctx.baseUrl = parentUrl;
    ctx.originalUrl = ctx.originalUrl || ctx.url;

    return router_next();

    // a wrapper for next
    // which is called to do some cleaning job before continuing to the next router
    async function done() {
      // for options requests, respond with a default if nothing else responds
      // WARNING: not sure whether it is correct here
      if (ctx.method === 'OPTIONS' && options.length > 0) {
        setOptionsResponse(ctx, options);
      }
      // restore vals
      for (let i = 0; i < propsToRestore.length; i += 1) {
        ctx[propsToRestore[i]] = vals[i];
      }

      // call next to continue to the next router
      return next();
    }

    async function router_next(signal) {
      // remove added slash
      if (slashAdded) {
        ctx.url = ctx.url.substr(1);
        slashAdded = false;
      }

      // restore altered ctx.url
      if (removed.length !== 0) {
        ctx.baseUrl = parentUrl;
        ctx.url = protohost + removed + ctx.url.substr(protohost.length);
        removed = '';
      }

      // no more matching layers  // signal to skip router
      if (idx >= stack.length || signal === 'router') {
        // call done to continue to the next router, or simply return to response
        return done();
      }

      // get pathname of request
      const path = getPathname(ctx);

      if (path == null) {
        // call done to continue to the next router, or simply return to response
        // when would this happen? path === undefined?
        return done();
      }

      // find next matching layer
      /** @type {Layer} */
      let layer;
      /** @type {boolean} */
      let match;
      /** @type {Route} */
      let route;

      while (match !== true && idx < stack.length) {
        layer = stack[idx];
        idx += 1;
        match = matchLayer(layer, path, ctx.query);
        route = layer.route;

        if (match !== true) {
          continue;
        }

        if (!route) {
          // process non-route handlers normally
          continue;
        }

        const method = ctx.method;
        const has_method = route._handles_method(method);

        // build up automatic options response
        if (!has_method && method === 'OPTIONS') {
          appendMethods(options, route._options());
        }

        // don't even bother matching route
        if (!has_method && method !== 'HEAD') {
          match = false;
          continue;
        }
      }

      // no match
      if (match !== true) {
        // call done to go on, or simply return to response
        return done();
      }

      // store route for dispatch on change
      if (route) {
        ctx.route = route;
      }

      // capture one-time layer values
      ctx.params = self.mergeParams
        ? mergeParams(layer.params, parentParams)
        : layer.params;
      const layerPath = layer.path;

      // this should be done for the layer
      return self.process_params(layer, paramcalled, ctx, async (paramSignal) => {
        if (paramSignal) {
          return router_next(paramSignal);
        }
        if (route) {
          // ==> route.handle(ctx, next)
          return layer.handle_request(ctx, router_next);
        }

        // use
        return trim_prefix(layer, layerPath, path);
      });
    }

    async function trim_prefix(layer, layerPath, path) {
      if (layerPath.length !== 0) {
        // Validate path breaks on a path separator
        const c = path[layerPath.length];
        if (c && c !== '/' && c !== '.') {
          return router_next();
        }

        // Trim off the part of the url that matches the route
        // middleware (.use stuff) needs to have the path stripped
        debug('trim prefix (%s) from url %s', layerPath, ctx.url);
        removed = layerPath;
        ctx.url = protohost + ctx.url.substr(protohost.length + removed.length);

        // Ensure leading slash
        if (!protohost && ctx.url[0] !== '/') {
          ctx.url = `/${ctx.url}`;
          slashAdded = true;
        }

        // Setup base URL (no trailing slash)
        ctx.baseUrl = parentUrl + (removed[removed.length - 1] === '/'
          ? removed.substring(0, removed.length - 1)
          : removed);
      }

      debug('%s %s : %s', layer.name, layerPath, ctx.originalUrl);

      // use ==> middleware(ctx, next)
      return layer.handle_request(ctx, router_next);
    }
  }

  /**
   * Process any parameters for the layer.
   * @return {Promise<string>} signal
   * @api private
   */
  async process_params(layer, called, ctx, next) {
    const params = this.params;

    // captured parameters from the layer, keys and values
    const keys = layer.keys;

    // fast track
    if (!keys || keys.length === 0) {
      // return empty signal to go on
      return next();
    }

    let i = 0;
    let name;
    let paramIndex = 0;
    let key;
    let paramVal;
    let paramCallbacks;
    let paramCalled;

    // process params in order
    // param callbacks can be async
    function param(signal) {
      if (signal) {
        // return concrete signal to router
        return next(signal);
      }

      if (i >= keys.length) {
        // return empty signal to go on
        return next();
      }

      paramIndex = 0;
      key = keys[i];
      i += 1;
      name = key.name;
      paramVal = ctx.params[name];
      paramCallbacks = params[name];
      paramCalled = called[name];

      if (paramVal === undefined || !paramCallbacks) {
        // check out next param
        return param();
      }

      // param previously called with same value or error occurred
      if (paramCalled && (paramCalled.match === paramVal
        || (paramCalled.signal && paramCalled.signal !== 'route'))) {
        // restore value
        ctx.params[name] = paramCalled.value;

        // check next param with signal
        return param(paramCalled.signal);
      }

      called[name] = paramCalled = {
        signal: null,
        match: paramVal,
        value: paramVal,
      };

      // matched: call param middleware
      return paramCallback();
    }

    // single param callbacks
    async function paramCallback(signal) {
      const paramMiddleware = paramCallbacks[paramIndex];
      paramIndex += 1;

      // store updated value
      paramCalled.value = ctx.params[key.name];

      if (signal) {
        // store signal and return back to param
        paramCalled.signal = signal;
        return param(signal);
      }

      // check out next param
      if (!paramMiddleware) {
        return param();
      }

      return paramMiddleware(ctx, paramCallback, paramVal, key.name);
    }

    return param();
  }

  /**
   * Use the given middleware function, with optional path, defaulting to "/".
   *
   * Use (like `.all`) will run for any http METHOD, but it will not add
   * handlers for those methods so OPTIONS requests will not consider `.use`
   * functions even if they could respond.
   *
   * The other difference is that _route_ path is stripped and not visible
   * to the handler function. The main effect of this feature is that mounted
   * handlers can operate without any code changes regardless of the "prefix"
   * pathname.
   *
   * @api public
   */
  use(...middlewares) {
    // default path to '/'
    let path = '/';
    let query;
    let firstArg = middlewares[0];

    if (!Array.isArray(firstArg)) {
      // no effect on the the input middlewares array
      firstArg = [firstArg];
    }

    // if the first argument is a path array
    if (firstArg.every(one => typeof one === 'string' || one instanceof RegExp)) {
      path = middlewares.shift();
    }

    middlewares = flatten(middlewares);

    if (middlewares[0] && typeof middlewares[0] !== 'function') {
      query = middlewares.shift();
    }

    if (middlewares.length === 0) {
      throw new TypeError('Router.use() requires a middleware function');
    }

    for (let i = 0; i < middlewares.length; i += 1) {
      const fn = middlewares[i];

      if (typeof fn !== 'function') {
        throw new TypeError(`Router.use() requires a middleware function but got a ${inspect(fn, { depth: null })}`);
      }

      let prefixedPath = path;
      // merge '/usedPath/' and '/routerPath' to '/usedPath/routerPath'
      if (fn.router && fn.router.prefix) {
        if (prefixedPath.endsWith('/') && fn.router.prefix.startsWith('/')) {
          prefixedPath = prefixedPath.slice(0, -1);
        }
        prefixedPath += fn.router.prefix;
      }

      // add the middleware
      debug('use %o %s', prefixedPath, fn.name || '<anonymous>');

      const layer = new Layer(prefixedPath, {
        sensitive: this.caseSensitive,
        strict: false,
        end: false,
      }, fn);

      layer.route = undefined;
      layer.query = query;
      this.stack.push(layer);
    }

    return this;
  }

  /**
   * Create a new Route for the given path.
   *
   * Each route contains a separate middleware stack and VERB handlers.
   *
   * See the Route api documentation for details on adding handlers
   * and middleware to routes.
   *
   * @param  {string}   path
   * @param  {any}      [query]
   * @api public
   */
  route(path, query) {
    const route = new Route(path);
    const layer = new Layer(path, {
      sensitive: this.caseSensitive,
      strict: this.strict,
      end: true,
    }, route.dispatch.bind(route));
    layer.route = route;
    layer.query = query;
    this.stack.push(layer);
    return route;
  }

  /**
   * all
   * @param {string} path
   * @param {...IMiddleware} middlewares
   */
  all(path, ...middlewares) {
    return this.method('all', path, ...middlewares);
  }

  /**
   *
   * @param  {string} method
   * @param  {string} path
   * @param  {...IMiddleware} middlewares
   */
  method(method, path, ...middlewares) {
    let query;
    if (middlewares[0] && typeof middlewares[0] !== 'function') {
      query = middlewares.shift();
    }
    const route = this.route(path, query);
    route[method](...middlewares);
    return this;
  }
}

Router.defaultOptions = {
  caseSensitive: false,
  mergeParams: false,
  strict: false,
  prefix: false,
};

module.exports = Router;

methods.forEach((method) => {
  Router.prototype[method] = function router_method_handler(path, ...middlewares) {
    return this.method(method, path, ...middlewares);
  };
});

// @ts-ignore
Route.prototype.del = Route.prototype.delete;

// append methods to a list of methods
function appendMethods(list, addition) {
  for (let i = 0; i < addition.length; i += 1) {
    const method = addition[i];
    if (list.indexOf(method) === -1) {
      list.push(method);
    }
  }
}

// get pathname of request
function getPathname(ctx) {
  try {
    return parseUrl(ctx).pathname;
  } catch (err) {
    return undefined;
  }
}

// Get get protocol + host for a URL
function getProtohost(url) {
  if (typeof url !== 'string' || url.length === 0 || url[0] === '/') {
    return undefined;
  }

  const searchIndex = url.indexOf('?');
  const pathLength = searchIndex !== -1
    ? searchIndex
    : url.length;
  const fqdnIndex = url.substr(0, pathLength).indexOf('://');

  return fqdnIndex !== -1
    ? url.substr(0, url.indexOf('/', 3 + fqdnIndex))
    : undefined;
}

/**
 * Match path to a layer.
 *
 * @param {Layer}   layer
 * @param {string}  path
 * @param {any}     query
 * @private
 */

function matchLayer(layer, path, query) {
  return layer.match(path, query);
}

// merge params with parent params
function mergeParams(params, parent) {
  if (typeof parent !== 'object' || !parent) {
    return params;
  }

  // make copy of parent for base
  const obj = Object.assign({}, parent);

  // simple non-numeric merging
  if (!(0 in params) || !(0 in parent)) {
    return Object.assign(obj, params);
  }

  let i = 0;
  let o = 0;

  // determine numeric gaps
  while (i in params) {
    i += 1;
  }

  while (o in parent) {
    o += 1;
  }

  // offset numeric indices in params before merge
  for (i -= 1; i >= 0; i -= 1) {
    params[i + o] = params[i];

    // create holes for the merge when necessary
    if (i < o) {
      delete params[i];
    }
  }

  return Object.assign(obj, params);
}

/**
 * send an OPTIONS response
 * @param {Context} ctx
 * @param {any} options
 */
function setOptionsResponse(ctx, options) {
  const body = options.join(',');
  ctx.set('Allow', body);
  ctx.body = body;
}
