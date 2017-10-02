const after = require('after');
const should = require('should');
const Router = require('../lib');
const assert = require('assert');

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

describe('Router', () => {
  it('should return a function with router methods', () => {
    const router = new Router();
    assert(typeof router.routes === 'function');
    assert(typeof router.get === 'function');
    assert(typeof router.handle === 'function');
    assert(typeof router.use === 'function');
  });

  it('should support .use of other routers', async () => {
    const router = new Router();
    const another = new Router();
    return new Promise((done, reject) => {
      another.get('/bar', (ctx) => {
        ctx.end();
      });
      router.use('/foo', another.routes());

      return router.handle({ url: '/foo/bar', method: 'GET', end: done })
        .catch(reject);
    });
  });

  it('should support dynamic routes', async () => {
    const router = new Router();
    const another = new Router();
    return new Promise((done, reject) => {
      another.get('/:bar', (ctx) => {
        should(ctx.params.bar).equal('route');
        ctx.end();
      });
      router.use('/:foo', another.routes());

      return router.handle({ url: '/test/route', method: 'GET', end: done })
        .catch(reject);
    });
  });

  it('should handle blank URL', async () => {
    const router = new Router();

    router.use((ctx) => {
      // should not be called
      false.should.be.true();
    });

    return new Promise((done, reject) => {
      router.handle({ url: '', method: 'GET' }, done).catch(reject);
    });
  });

  it('should handle missing URL', async () => {
    const router = new Router();

    router.use((ctx) => {
      throw new Error('should not be called');
    });

    return new Promise((done, reject) => {
      router.handle({ method: 'GET' }, done).catch(reject);
    });
  });

  it('should not stack overflow with many registered routes', async () => {
    const handler = (ctx) => { ctx.end(new Error('wrong handler')); };
    const router = new Router();

    for (let i = 0; i < 6000; i++) {
      router.get(`/thing${i}`, handler);
    }

    router.get('/', (ctx) => {
      ctx.end();
    });

    return new Promise((done, reject) => {
      router.handle({ url: '/', method: 'GET', end: done })
        .catch(reject);
    });
  });

  describe('.handle', () => {
    it('should dispatch', async () => {
      const router = new Router();

      router.route('/foo').get((ctx) => {
        ctx.send('foo');
      });

      return new Promise((done, reject) => {
        const ctx = {
          url: '/foo',
          method: 'GET',
          send(val) {
            val.should.equal('foo');
            return done();
          },
        };
        router.handle(ctx).catch(reject);
      });
    });
  });

  describe('.multiple callbacks', () => {
    it('should throw if a callback is null', () => {
      assert.throws(() => {
        const router = new Router();
        router.route('/foo').all(null);
      });
    });

    it('should throw if a callback is undefined', () => {
      assert.throws(() => {
        const router = new Router();
        router.route('/foo').all(undefined);
      });
    });

    it('should throw if a callback is not a function', () => {
      assert.throws(() => {
        const router = new Router();
        router.route('/foo').all({}, 'not a function');
      });
    });

    it('should not throw if all callbacks are functions', () => {
      const router = new Router();
      router.route('/foo').all(() => {}).all(() => {});
    });
  });

  describe('error', () => {
    it('should skip non error middleware', async () => {
      const router = new Router();

      const promise = new Promise((done) => {
        router.use(async (ctx, next) => {
          try {
            return await next();
          } catch (e) {
            assert.equal(e.message, 'foo');
            return done();
          }
        });
      });
      promise.catch(() => {});

      router.get('/foo', (ctx, next) => {
        throw new Error('foo');
      });

      router.get('/bar', (ctx, next) => {
        throw new Error('bar');
      });

      router.use((ctx, next) => {
        assert(false);
      });

      return new Promise((done, reject) => {
        promise.then(done).catch(reject);
        router.handle({ url: '/foo', method: 'GET' }, done).catch(reject);
      });
    });

    it('should handle throwing inside routes with params', async () => {
      const router = new Router();

      const promise = new Promise((done) => {
        router.use(async (ctx, next) => {
          try {
            return await next();
          } catch (e) {
            assert.equal(e.message, 'foo');
            return done();
          }
        });
      });
      promise.catch(() => {});

      router.get('/foo/:id', (ctx, next) => {
        throw new Error('foo');
      });

      router.use((ctx, next) => {
        assert(false);
      });

      return new Promise((done, reject) => {
        promise.then(done).catch(reject);
        router.handle({ url: '/foo/2', method: 'GET' }).catch(reject);
      });
    });

    it('should handle throwing in handler after async param', async () => {
      const router = new Router();

      const promise = new Promise((done) => {
        router.use(async (ctx, next) => {
          try {
            return await next();
          } catch (e) {
            assert.equal(e.message, 'oh no!');
            return done();
          }
        });
      });
      promise.catch(() => {});

      router.param('user', async (ctx, next, val) => {
        await new Promise(resolve => process.nextTick(resolve));
        ctx.user = val;
        return next();
      });

      router.use('/:user', (ctx, next) => {
        throw new Error('oh no!');
      });
      return new Promise((done, reject) => {
        promise.then(done).catch(reject);
        router.handle({ url: '/bob', method: 'GET' }).catch(reject);
      });
    });

    it('should handle throwing inside error handlers', async () => {
      const router = new Router();

      const promise = new Promise((done) => {
        router.use(async (ctx, next) => {
          try {
            return await next();
          } catch (e) {
            assert.equal(e.message, 'oops');
            return done();
          }
        });
      });
      promise.catch(() => {});

      router.use(async (ctx, next) => {
        try {
          return await next();
        } catch (e) {
          throw new Error('oops');
        }
      });

      router.use((ctx, next) => {
        throw new Error('boom!');
      });

      return new Promise((done, reject) => {
        promise.then(done).catch(reject);
        router.handle({ url: '/', method: 'GET' }, done).catch(reject);
      });
    });
  });

  describe('FQDN', () => {
    it('should not obscure FQDNs', async () => {
      const ctx = { hit: 0, url: 'http://example.com/foo', method: 'GET' };
      const router = new Router();

      router.use((ctx, next) => {
        assert.equal(ctx.hit++, 0);
        assert.equal(ctx.url, 'http://example.com/foo');
        return next();
      });

      return new Promise((done, reject) => {
        router.handle(ctx, async () => {
          assert.equal(ctx.hit, 1);
          return done();
        })
          .catch(reject);
      });
    });

    it('should ignore FQDN in search', async () => {
      const ctx = { hit: 0, url: '/proxy?url=http://example.com/blog/post/1', method: 'GET' };
      const router = new Router();

      router.use('/proxy', (ctx, next) => {
        assert.equal(ctx.hit++, 0);
        assert.equal(ctx.url, '/?url=http://example.com/blog/post/1');
        return next();
      });

      return new Promise((done, reject) => {
        router.handle(ctx, async () => {
          assert.equal(ctx.hit, 1);
          return done();
        })
          .catch(reject);
      });
    });

    it('should ignore FQDN in path', async () => {
      const ctx = { hit: 0, url: '/proxy/http://example.com/blog/post/1', method: 'GET' };
      const router = new Router();

      router.use('/proxy', (ctx, next) => {
        assert.equal(ctx.hit++, 0);
        assert.equal(ctx.url, '/http://example.com/blog/post/1');
        return next();
      });

      return new Promise((done, reject) => {
        router.handle(ctx, async () => {
          assert.equal(ctx.hit, 1);
          return done();
        })
          .catch(reject);
      });
    });

    it('should adjust FQDN ctx.url', async () => {
      const request = { hit: 0, url: 'http://example.com/blog/post/1', method: 'GET' };
      const router = new Router();

      router.use('/blog', (ctx, next) => {
        assert.equal(ctx.hit++, 0);
        assert.equal(ctx.url, 'http://example.com/post/1');
        return next();
      });

      return new Promise((done, reject) => {
        router.handle(request, () => {
          assert.equal(request.hit, 1);
          return done();
        })
          .catch(reject);
      });
    });

    it('should adjust FQDN ctx.url with multiple handlers', async () => {
      const ctx = { hit: 0, url: 'http://example.com/blog/post/1', method: 'GET' };
      const router = new Router();

      router.use((ctx, next) => {
        assert.equal(ctx.hit++, 0);
        assert.equal(ctx.url, 'http://example.com/blog/post/1');
        return next();
      });

      router.use('/blog', (ctx, next) => {
        assert.equal(ctx.hit++, 1);
        assert.equal(ctx.url, 'http://example.com/post/1');
        return next();
      });


      return new Promise((done, reject) => {
        router.handle(ctx, () => {
          assert.equal(ctx.hit, 2);
          return done();
        })
          .catch(reject);
      });
    });

    it('should adjust FQDN ctx.url with multiple routed handlers', async () => {
      const ctx = { hit: 0, url: 'http://example.com/blog/post/1', method: 'GET' };
      const router = new Router();

      router.use('/blog', (ctx, next) => {
        assert.equal(ctx.hit++, 0);
        assert.equal(ctx.url, 'http://example.com/post/1');
        return next();
      });

      router.use('/blog', (ctx, next) => {
        assert.equal(ctx.hit++, 1);
        assert.equal(ctx.url, 'http://example.com/post/1');
        return next();
      });

      router.use((ctx, next) => {
        assert.equal(ctx.hit++, 2);
        assert.equal(ctx.url, 'http://example.com/blog/post/1');
        return next();
      });

      return new Promise((done, reject) => {
        router.handle(ctx, () => {
          assert.equal(ctx.hit, 3);
          return done();
        })
          .catch(reject);
      });
    });
  });

  describe('.all', () => {
    it('should support using .all to capture all http verbs', async () => {
      const router = new Router();

      let count = 0;
      router.all('/foo', () => { count++; });

      const url = '/foo?bar=baz';

      for (const method of methods) {
        await router.handle({ url, method });
      }

      assert.equal(count, methods.length);
    });

    it('should be called for any URL when "*"', async () => {
      let cb;
      const promise = new Promise((done, reject) => {
        cb = after(4, done);
      });
      promise.catch(() => {});

      const router = new Router();

      function no() {
        throw new Error('should not be called');
      }

      router.all('*', ctx => ctx.end());

      await router.handle({ url: '/', method: 'GET', end: cb }, no);
      await router.handle({ url: '/foo', method: 'GET', end: cb }, no);
      await router.handle({ url: 'foo', method: 'GET', end: cb }, no);
      await router.handle({ url: '*', method: 'GET', end: cb }, no);

      return promise;
    });
  });

  describe('.use', () => {
    it('should require middleware', () => {
      const router = new Router();
      assert.throws(() => { router.use('/', {}); }, /requires a middleware function/);
    });

    it('should reject string as middleware', () => {
      const router = new Router();
      assert.throws(() => { router.use('/', {}, 'foo'); }, /requires a middleware function but got a 'foo'/);
    });

    it('should reject number as middleware', () => {
      const router = new Router();
      assert.throws(() => { router.use('/', {}, 42); }, /requires a middleware function but got a 42/);
    });

    it('should reject null as middleware', () => {
      const router = new Router();
      assert.throws(() => { router.use('/', {}, null); }, /requires a middleware function but got a null/);
    });

    it('should reject Date as middleware', () => {
      const router = new Router();
      assert.throws(() => { router.use('/', {}, new Date()); }, /requires a middleware function but got a [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z/);
    });

    it('should be called for any URL', async () => {
      let cb;
      const promise = new Promise((done, reject) => {
        cb = after(4, done);
      });
      promise.catch(() => {});
      const router = new Router();

      function no() {
        throw new Error('should not be called');
      }

      router.use((ctx) => {
        ctx.end();
      });

      await router.handle({ url: '/', method: 'GET', end: cb }, no);
      await router.handle({ url: '/foo', method: 'GET', end: cb }, no);
      await router.handle({ url: 'foo', method: 'GET', end: cb }, no);
      await router.handle({ url: '*', method: 'GET', end: cb }, no);
      return promise;
    });

    it('should accept array of middleware', async () => {
      let count = 0;
      const router = new Router();

      function fn1(ctx, next) {
        assert.equal(++count, 1);
        return next();
      }

      function fn2(ctx, next) {
        assert.equal(++count, 2);
        return next();
      }

      const promise = new Promise((done) => {
        router.use([fn1, fn2], (ctx) => {
          assert.equal(++count, 3);
          return done();
        });
      });
      promise.catch(() => {});

      await router.handle({ url: '/foo', method: 'GET' });
      return promise;
    });
  });

  describe('.param', () => {
    it('should call param function when routing VERBS', async () => {
      const router = new Router();

      router.param('id', (ctx, next, id) => {
        assert.equal(id, '123');
        return next();
      });

      router.get('/foo/:id/bar', (ctx, next) => {
        assert.equal(ctx.params.id, '123');
        return next();
      });

      return new Promise((done, reject) => {
        router.handle({ url: '/foo/123/bar', method: 'get' }, done)
          .catch(reject);
      });
    });

    it('should call param function when routing middleware', async () => {
      const router = new Router();

      router.param('id', (ctx, next, id) => {
        assert.equal(id, '123');
        return next();
      });

      router.use('/foo/:id/bar', (ctx, next) => {
        assert.equal(ctx.params.id, '123');
        assert.equal(ctx.url, '/baz');
        return next();
      });

      return new Promise((done, reject) => {
        router.handle({ url: '/foo/123/bar/baz', method: 'get' }, done)
          .catch(reject);
      });
    });

    it('should only call once per request', async () => {
      let count = 0;
      const ctx = { url: '/foo/bob/bar', method: 'get' };
      const router = new Router();
      const sub = new Router();

      sub.get('/bar', (ctx, next) => next());

      router.param('user', (ctx, next, user) => {
        count++;
        ctx.user = user;
        return next();
      });

      router.use('/foo/:user/', new Router().routes());
      router.use('/foo/:user/', sub.routes());

      return new Promise((done, reject) => {
        router.handle(ctx, async () => {
          assert.equal(count, 1);
          assert.equal(ctx.user, 'bob');
          return done();
        })
          .catch(reject);
      });
    });

    it('should call only when id is a positive integer', async () => {
      let count = 0;
      const router = new Router();
      const sub = new Router();

      sub.get('/list', (ctx, next) => next());
      sub.get('/starList', (ctx, next) => next());

      router.param('id', (ctx, next, id) => {
        count++;
        ctx.id = id;
        return next();
      });

      router.param('starId', (ctx, next, starId) => {
        count++;
        ctx.starId = starId;
        return next();
      });

      router.use('/foo/:id([1-9]{1}[0-9]{0,})/sub/', sub.routes());
      router.use('/foo/:starId(.*)/sub/', sub.routes());

      return new Promise((done, reject) => {
        (async () => {
          const ctx1 = { url: '/foo/3/sub/list', method: 'get' };
          await router.handle(ctx1);
          assert.equal(count, 2);
          assert.equal(ctx1.id, 3);
          assert.equal(ctx1.starId, 3);

          const ctx2 = { url: '/foo/bad/sub/list', method: 'get' };
          await router.handle(ctx2);
          assert.equal(count, 3);

          const ctx3 = { url: '/foo/bad/sub/starList', method: 'get' };
          await router.handle(ctx3);
          assert.equal(count, 4);
          assert.equal(ctx3.starId, 'bad');
          return done();
        })().catch(reject);
      });
    });

    it('should call when values differ', async () => {
      let count = 0;
      const ctx = { url: '/foo/bob/bar', method: 'get' };
      const router = new Router();
      const sub = new Router();

      sub.get('/bar', (ctx, next) => next());

      router.param('user', (ctx, next, user) => {
        count++;
        ctx.user = user;
        return next();
      });

      router.use('/foo/:user/', new Router().routes());
      router.use('/:user/bob/', sub.routes());

      return new Promise((done, reject) => {
        router.handle(ctx, () => {
          assert.equal(count, 2);
          assert.equal(ctx.user, 'foo');
          return done();
        })
          .catch(reject);
      });
    });
  });

  describe('parallel requests', () => {
    it('should not mix requests', async () => {
      const req1 = { url: '/foo/50/bar', method: 'get' };
      const req2 = { url: '/foo/10/bar', method: 'get' };
      const router = new Router();
      const sub = new Router();

      let done;
      const promise = new Promise((resolve) => {
        done = after(2, resolve);
      });
      promise.catch(() => {});

      sub.get('/bar', (ctx, next) => next());

      router.param('ms', async (ctx, next, ms) => {
        ms = parseInt(ms, 10);
        ctx.ms = ms;
        await new Promise(resolve => setTimeout(resolve, ms));
        return next();
      });

      router.use('/foo/:ms/', new Router().routes());
      router.use('/foo/:ms/', sub.routes());

      await router.handle(req1, (err) => {
        assert.ifError(err);
        assert.equal(req1.ms, 50);
        assert.equal(req1.originalUrl, '/foo/50/bar');
        return done();
      });

      await router.handle(req2, (err) => {
        assert.ifError(err);
        assert.equal(req2.ms, 10);
        assert.equal(req2.originalUrl, '/foo/10/bar');
        return done();
      });
    });
  });

  describe('query condition', () => {
    it('should work on string and regexp condition', async () => {
      let order = 0;
      const router = new Router();

      router.use({ state: /ing$/ }, async (ctx, next) => {
        should(++order).equal(3);
        return next();
      });

      router.get('/', { state: 'started' }, async (ctx, next) => {
        should(++order).equal(1);
        return next();
      });

      router.get('/', { state: 'progressing' }, async (ctx, next) => {
        should(++order).equal(4);
      });

      router.use(async (ctx, next) => {
        should(++order).equal(2);
      });

      return new Promise((done, reject) => {
        (async () => {
          await router.handle({ url: '/', method: 'GET', query: { state: 'started' } });
          await router.handle({ url: '/', method: 'GET', query: { state: 'progressing' } });
          should(order).equal(4);
          return done();
        })().catch(reject);
      });
    });

    it('should work on array condition', async () => {
      let order = 0;
      const router = new Router();

      let expected = 1;
      router.get('/', { state: ['started', 'progressing'] }, async (ctx, next) => {
        should(++order).equal(expected);
        expected = 4;
        return next();
      });

      let expected2 = 2;
      router.use(async (ctx, next) => {
        should(++order).equal(expected2);
        if (expected2 === 2) {
          expected2 = 3;
        } else if (expected2 === 3) {
          expected2 = 5;
        } else {
          expected2 = 6;
        }
      });

      return new Promise((done, reject) => {
        (async () => {
          // 1, 2
          await router.handle({ url: '/', method: 'GET', query: { state: 'progressing' } });
          // 3
          await router.handle({ url: '/', method: 'GET', query: {} });
          // 4, 5
          await router.handle({ url: '/', method: 'GET', query: { state: 'started' } });
          // 6
          await router.handle({ url: '/', method: 'GET', query: { state: 'end' } });
          should(order).equal(6);
          return done();
        })().catch(reject);
      });
    });

    it('should work on json or function condition', async () => {
      let order = 0;
      const router = new Router();

      router.use(async (ctx, next) => {
        ++order;
        return next();
      });

      router.get('/', { state: val => val && val % 2 === 0 }, async (ctx, next) => {
        should(++order).equal(7);
        return next();
      });

      router.get('/', { state: 1 }, async (ctx, next) => {
        should(++order).equal(2);
        return next();
      });

      router.get('/', { state: false }, async (ctx, next) => {
        should(++order).equal(5);
        return next();
      });

      return new Promise((done, reject) => {
        (async () => {
          // 1, 2
          await router.handle({ url: '/', method: 'GET', query: { state: '1' } });
          // 3
          await router.handle({ url: '/', method: 'GET', query: {} });
          // 4, 5
          await router.handle({ url: '/', method: 'GET', query: { state: 'false' } });
          // 6, 7
          await router.handle({ url: '/', method: 'GET', query: { state: '4' } });
          // 8
          await router.handle({ url: '/', method: 'GET', query: { state: '[1, 2]' } });
          should(order).equal(8);
          return done();
        })().catch(reject);
      });
    });
  });
});
