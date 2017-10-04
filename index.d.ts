import * as Koa from 'koa'

declare module 'koa' {
  interface Context {
    params: { [x: string]: string }
  }

  export interface IMiddleware {
    (ctx: Context, next: () => Promise<any>): any
  }

  export interface IParamMiddleware {
    (ctx: Context, next: () => Promise<any>, param: string | number, name: string): any
  }
}

interface Query {
  [key: string]: any
}

interface Options {
  /**
   * When `true` the route will be case sensitive.
   * @default false
   */
  caseSensitive?: boolean
  /**
   * When `false` the trailing slash is optional.
   * @default false
   */
  strict?: boolean
  /**
   * Preserve the ctx.params values from the parent router.
   * If the parent and the child have conflicting param names, the child’s value take precedence.
   * @default false
   */
  mergeParams?: boolean
  /**
   * common prefix of routes in this router
   */
  prefix?: string
}

declare class Router {
  /**
   * Initialize a new Router
   */
  constructor(options?: Options)

  /**
   * export router as a useable middleware
   */
  routes(usedByRouter?: boolean): Koa.IMiddleware

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
   * @public
   */
  use(...middleware: Koa.IMiddleware[]): Router;
  use(path: string | RegExp, ...middleware: Koa.IMiddleware[]): Router;
  use(path: string | RegExp, query: Query, ...middleware: Koa.IMiddleware[]): Router;

  all: IRouterHandler
  get: IRouterHandler
  post: IRouterHandler
  put: IRouterHandler
  delete: IRouterHandler
  patch: IRouterHandler
  options: IRouterHandler
  head: IRouterHandler

  checkout: IRouterHandler
  connect: IRouterHandler
  copy: IRouterHandler
  lock: IRouterHandler
  merge: IRouterHandler
  mkactivity: IRouterHandler
  mkcol: IRouterHandler
  move: IRouterHandler
  "m-search": IRouterHandler
  notify: IRouterHandler
  propfind: IRouterHandler
  proppatch: IRouterHandler
  purge: IRouterHandler
  report: IRouterHandler
  search: IRouterHandler
  subscribe: IRouterHandler
  trace: IRouterHandler
  unlock: IRouterHandler
  unsubscribe: IRouterHandler

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
   */
  param(param: string, ...middleware: Koa.IParamMiddleware[]): Router

  /**
   * Create a new Route for the given path.
   *
   * Each route contains a separate middleware stack and VERB handlers.
   *
   * See the Route api documentation for details on adding handlers
   * and middleware to routes.
   *
   */
  route(path: string, query?: Query): Route

  public static defaultOptions: Options
}

interface Route {
  all: IRouteHandler
  get: IRouteHandler
  post: IRouteHandler
  put: IRouteHandler
  delete: IRouteHandler
  patch: IRouteHandler
  options: IRouteHandler
  head: IRouteHandler

  checkout: IRouteHandler
  connect: IRouteHandler
  copy: IRouteHandler
  lock: IRouteHandler
  merge: IRouteHandler
  mkactivity: IRouteHandler
  mkcol: IRouteHandler
  move: IRouteHandler
  "m-search": IRouteHandler
  notify: IRouteHandler
  propfind: IRouteHandler
  proppatch: IRouteHandler
  purge: IRouteHandler
  report: IRouteHandler
  search: IRouteHandler
  subscribe: IRouteHandler
  trace: IRouteHandler
  unlock: IRouteHandler
  unsubscribe: IRouteHandler
}

type PathParams = string | RegExp | (string | RegExp)[];

interface IRouteHandler {
  /**
   * regist HTTP method handler
   */
  (...middlewares: Koa.IMiddleware[]): Route
  /**
   * regist HTTP method handler with query matching
   */
  (query: Query, ...middleware: Koa.IMiddleware[]): Route
}
interface IRouterHandler {
  /**
   * regist HTTP method handler
   */
  (path: PathParams, ...middlewares: Koa.IMiddleware[]): Router
  /**
   * regist HTTP method handler with query matching
   */
  (path: PathParams, query: Query, ...middleware: Koa.IMiddleware[]): Router
}

export = Router
