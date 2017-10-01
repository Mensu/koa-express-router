# koa-express-router

[![NPM version](http://img.shields.io/npm/v/koa-express-router.svg?style=flat)](https://npmjs.org/package/koa-express-router) [![NPM Downloads](https://img.shields.io/npm/dm/koa-express-router.svg?style=flat)](https://npmjs.org/package/koa-express-router)

> Express's Router adapted for Koa v2.x [koa](https://github.com/koajs/koa)

* Express-style routing using `router.use`, `router.all`, `router.METHOD`, `router.param` etc.
* support router prefix
* support matching by query

## Thanks To

- [Express](https://expressjs.com). This repo is based on the codes on [expressjs/express](https://github.com/expressjs/express)
- [path-to-regexp](https://github.com/pillarjs/path-to-regexp)

## Installation

```sh
npm install koa-express-router
```

## Usage

### Basics

#### code

```js
const Koa = require('koa');
const Router = require('koa-express-router');

// define sub router with an optional prefix
// different from express: use new to create instances
const subRtr = new Router({ prefix: '/sub' });

subRtr.use(async (ctx, next) => {
  if (/* some condition */false) {
      // possible to skip the current router and start matching following ones
      return next('router');
    }
  // ...
  ctx.body += '/sub use \n';
  return next();
});

subRtr.route('/list')
  .all(async (ctx, next) => {
    if (/* some condition */false) {
      // possible to skip the current route and start matching following ones #1
      return next('route');
    }
    // ...
    ctx.body += '/sub/list all 1\n';
    return next();
  })
  .get(async (ctx, next) => {
    // ...
    ctx.body += '/sub/list get\n';
  })
  .post(async (ctx, next) => {
    // ...
    ctx.body += '/sub/list post\n';
  });

subRtr.all('/list', async (ctx, next) => {
  // after #1 the logic would come here
  ctx.body += '/sub/list all 2\n';
});

const topRtr = new Router();
topRtr.use((ctx, next) => {
  ctx.body = 'global use\n';
  return next();
});
topRtr.param('someID', async (ctx, next, id, name) => {
  // id: matched value
  // name: 'someID'
  // ...
  ctx.body += `/top/:someID ${name} => ${id}\n`;
  return next();
});

// different from express: use .routes() to export
// should not pass anything to .routes() when to be used by a Router from 'koa-express-router'
topRtr.use('/top/:someID([1-9]{1}[0-9]{0,})/', subRtr.routes());

const app = new Koa();
// pass 'false' when .routes() may be used
//   by something other than a Router from 'koa-express-router'
app.use(topRtr.routes(false));
app.listen(3000);

```

### output

- ``GET /``
  ```
  global use

  ```
- ``PATCH /top/10/sub/`` (does not match any path in ``subRtr``)
  ```
  global use
  /top/:someID someID => 10
  /sub use

  ```
- ``GET /top/bad/sub/list`` (does not match ``subRtr``'s use)
  ```
  global use

  ```
- ``GET /top/2/sub/list``
  ```
  global use
  /top/:someID someID => 2
  /sub use
  /sub/list all 1
  /sub/list get

  ```
- ``PUT /top/3/sub/list``
  ```
  global use
  /top/:someID someID => 3
  /sub use
  /sub/list all 1
  /sub/list all 2

  ```

### Query Matching

**Note:** this feature is only designed for simple matching. If the matching condition becomes complex, it is recommended that the user consider ``return next('route')`` for better readability

```js
// use an object for query matching schema
// the value part can be a primitive
router.use({ type_id: 1, state: 'good' }, async (ctx, next) => {
  // matched on ?type_id=1&state=good
  return next();
});

router.route('/list')
  // the value part can be a function
  .get({ user_id: user_id => user_id < 1000 }, async (ctx, next) => {
    // case ?user_id=30
    // break
    return next('route');
  })
  .get({ user_id: /00$/ }, async (ctx, next) => {
    // case ?user_id=3000
    // break
    return next('route');
  })
  .get(async (ctx, next) => {
    // default case
    return next('route');
  });

router.post('/',
  // complex query condition
  async (ctx, next) => {
    const authorized = await checkAuthorized(ctx.query.user_id);
    if (authorized) {
      return next(); // #1
    }
    return next('route'); // #2
  },
  async (ctx, next) => {
    // authorized operations #1
  },
);

router.post('/',
  { user_id: /^[1-9]{1}[0-9]{0,}$/ },
  async (ctx, next) => {
    // limited operations #2
  },
);

```

## Caveats

- still not support other less common HTTP methods
- Not ready for production use
- Not benchmarked
