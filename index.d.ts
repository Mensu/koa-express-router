declare module 'koa' {
  interface IContext {
    params: { [x: string]: string }
  }
  interface IMiddleware {
    (ctx: IContext, next: () => Promise<any>): any
  }
  interface IParamMiddleware {
    (ctx: IContext, next: () => Promise<any>, param: string | number, name: string): any
  }
  interface Query {
    [key: string]: any
  }
  interface Router {
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
    use(...middleware: Array<IMiddleware>): Router;
    use(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    use(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

    /**
     * HTTP get method
     */
    get(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    get(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

    /**
     * HTTP post method
     */
    post(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    post(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

    /**
     * HTTP put method
     */
    put(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    put(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

    /**
     * HTTP delete method
     */
    delete(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    delete(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

    /**
     * HTTP head method
     */
    head(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    head(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

    /**
     * HTTP options method
     */
    options(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    options(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

    /**
     * HTTP path method
     */
    patch(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    patch(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

    /**
     * all
     */
    all(path: string | RegExp, ...middleware: Array<IMiddleware>): Router;
    all(path: string | RegExp, query: Query, ...middleware: Array<IMiddleware>): Router;

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
    param(param: string, ...middleware: Array<IParamMiddleware>): Router
    /**
     * export router as a useable middleware
     */
    routes(usedByRouter?: boolean): IMiddleware
  }

  interface Route {
    /**
     * HTTP get method
     */
    get(...middleware: Array<IMiddleware>): Route
    get(query: Query, ...middleware: Array<IMiddleware>): Route

    /**
     * HTTP post method
     */
    post(...middleware: Array<IMiddleware>): Route
    post(query: Query, ...middleware: Array<IMiddleware>): Route

    /**
     * HTTP put method
     */
    put(...middleware: Array<IMiddleware>): Route
    put(query: Query, ...middleware: Array<IMiddleware>): Route

    /**
     * HTTP patch method
     */
    patch(...middleware: Array<IMiddleware>): Route
    patch(query: Query, ...middleware: Array<IMiddleware>): Route

    /**
     * HTTP delete method
     */
    delete(...middleware: Array<IMiddleware>): Route
    delete(query: Query, ...middleware: Array<IMiddleware>): Route

    /**
     * HTTP head method
     */
    head(...middleware: Array<IMiddleware>): Route
    head(query: Query, ...middleware: Array<IMiddleware>): Route

    /**
     * HTTP options method
     */
    options(...middleware: Array<IMiddleware>): Route
    options(query: Query, ...middleware: Array<IMiddleware>): Route

    /**
     * all
     */
    all(...middleware: Array<IMiddleware>): Route
    all(query: Query, ...middleware: Array<IMiddleware>): Route
  }
}
