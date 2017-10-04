# koa-express-router

> Express's Router adapted for [Koa](http://koajs.com) v2.x

[![NPM version](http://img.shields.io/npm/v/koa-express-router.svg?style=flat)](https://npmjs.org/package/koa-express-router) [![node version](https://img.shields.io/node/v/koa-express-router.svg?style=flat)](https://www.npmjs.com/package/koa-express-router) [![NPM Downloads](https://img.shields.io/npm/dm/koa-express-router.svg?style=flat)](https://npmjs.org/package/koa-express-router) [![Build Status](https://travis-ci.org/Mensu/koa-express-router.svg?branch=master)](https://travis-ci.org/Mensu/koa-express-router) [![License](http://img.shields.io/npm/l/koa-express-router.svg?style=flat)](LICENSE)

* Express-style routing using `router.use`, `router.all`, `router.METHOD`, `router.param` etc.
* Support router prefix
* Support query matching

## Thanks To

- [Express](https://expressjs.com). This repo is based on the codes on [expressjs/express](https://github.com/expressjs/express)
- [path-to-regexp](https://github.com/pillarjs/path-to-regexp)

## Installation

```sh
npm install koa-express-router
```

## Usage

### Basics

Just like ``express``

#### Differences

- use ``new`` to create instances
- use ``.routes()`` or ``.routes(false)`` to export a router

```js
const Koa = require('koa');
const Router = require('koa-express-router');

// change default settings
Router.defaultOptions.mergeParams = true;

// define sub router with an optional prefix
// NOTE: different from Express: use new to create instances
const subRtr = new Router({ prefix: '/sub' });

subRtr.use(async (ctx, next) => {
  if (/* some condition */false) {
    return next('router');  // possible to skip the current router
  }
  ctx.body += '/sub use \n';
  return next();
});

subRtr.route('/list')
  .all(async (ctx, next) => {
    if (/* some condition */false) {
      return next('route');  // possible to skip the current route (goto #1)
    }
    ctx.body += '/sub/list all 1\n';
    return next();
  })
  .get(async (ctx, next) => {
    ctx.body += '/sub/list get\n';
  })
  .post(async (ctx, next) => {
    ctx.body += '/sub/list post\n';
  });

subRtr.all('/list', async (ctx, next) => {
  // #1
  // the logic would come here
  ctx.body += '/sub/list all 2\n';
});

// define top router without a prefix
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

// NOTE: different from Express: use .routes() to export
// no need to pass arguments to .routes()
//   if .routes() is to be used by a Router from 'koa-express-router'
topRtr.use('/top/:someID([1-9]{1}[0-9]{0,})/', subRtr.routes());

const app = new Koa();
// pass 'false' when .routes() may be used
//   by app.use, compose, or something other than a Router from 'koa-express-router'
app.use(topRtr.routes(false));
app.listen(3000);

```

### Output

- GET /
  ```
  global use

  ```
- PATCH /top/10/sub/ (does not match any path in subRtr)
  ```
  global use
  /top/:someID someID => 10
  /sub use

  ```
- GET /top/bad/sub/list (does not match the use for subRtr.routes())
  ```
  global use

  ```
- GET /top/2/sub/list
  ```
  global use
  /top/:someID someID => 2
  /sub use
  /sub/list all 1
  /sub/list get

  ```
- PUT /top/3/sub/list
  ```
  global use
  /top/:someID someID => 3
  /sub use
  /sub/list all 1
  /sub/list all 2

  ```

### Query Matching

**Note:** this feature is only designed for simple matching. If the matching condition becomes complex, it is recommended that the user consider ``return next('route')`` for better readability. See below.

```js
// use an object for query matching schema
// the value part can be a primitive
router.use({ type_id: 1, state: 'good' }, async (ctx, next) => {
  // matched on ?type_id=1&state=good
  return next();
});

router.route('/list')
  // the value part can be a function
  .get({ user_id: val => Number(val) < 1000 }, async (ctx, next) => {
    // case ?user_id=30
    // ...
    // use next('route') to break (like break in switch-case statements), if needed
    return next('route');
  })
  // the value part can be a regexp
  .get({ user_id: /00$/ }, async (ctx, next) => {
    // case ?user_id=3000
    // ...
    // use next('route') to break
    return next('route');
  })
  // the value part can be a string array (meaning or)
  .get({ user_id: ['2222', '3333'] }, async (ctx, next) => {
    // case ?user_id=2222 or ?user_id=3333
    // ...
    // use next('route') to break
    return next('route');
  })
  .get(async (ctx, next) => {
    // default case
    return next('route');
  });

// complex query condition example
router.post('/',
  async (ctx, next) => {
    const authorized = await checkAuthorized(ctx.query.user_id);
    if (authorized) return next(); // goto #1
    return next('route'); // goto #2
  },
  async (ctx, next) => {
    // #1
    // authorized operations
  },
);

router.post('/',
  async (ctx, next) => {
    // #2
    // limited operations due to not being authorized
  },
);

```

## Caveats

- Not ready for production use
- <s>Not support other less common HTTP methods</s>
- Not benchmarked
