const after = require('after');
const should = require('should');
const Route = require('../lib/Route');

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

describe('Route', () => {
  it('should work without handlers', async () => {
    const ctx = { method: 'GET', url: '/' };
    const route = new Route('/foo');
    return new Promise((done, reject) => {
      route.dispatch(ctx, done).catch(reject);
    });
  });

  describe('.all', () => {
    it('should add handler', async () => {
      const ctx = { method: 'GET', url: '/' };
      const route = new Route('/foo');

      route.all((ctx, next) => {
        ctx.called = true;
        return next();
      });

      return new Promise((done, reject) => {
        route.dispatch(ctx, () => {
          should(ctx.called).be.ok();
          return done();
        })
          .catch(reject);
      });
    });

    it('should handle VERBS', async () => {
      let count = 0;
      const route = new Route('/foo');
      let cb;
      const promise = new Promise((done, reject) => {
        cb = after(methods.length, () => {
          count.should.equal(methods.length);
          done();
        });
      });
      promise.catch(() => {});

      route.all((ctx, next) => {
        count++;
        return next();
      });

      for (const method of methods) {
        const ctx = { method, url: '/' };
        await route.dispatch(ctx, cb);
      }

      return promise;
    });

    it('should stack', async () => {
      const ctx = { count: 0, method: 'GET', url: '/' };
      const route = new Route('/foo');

      route.all((ctx, next) => {
        ctx.count++;
        return next();
      });

      route.all((ctx, next) => {
        ctx.count++;
        return next();
      });

      return new Promise((done, reject) => {
        route.dispatch(ctx, () => {
          ctx.count.should.equal(2);
          return done();
        })
          .catch(reject);
      });
    });
  });

  describe('.VERB', () => {
    it('should support .get', async () => {
      const ctx = { method: 'GET', url: '/' };
      const route = new Route('');

      route.get((ctx, next) => {
        ctx.called = true;
        return next();
      });

      return new Promise((done, reject) => {
        route.dispatch(ctx, () => {
          should(ctx.called).be.ok();
          return done();
        })
          .catch(reject);
      });
    });

    it('should limit to just .VERB', async () => {
      const ctx = { method: 'POST', url: '/' };
      const route = new Route('');

      route.get((ctx, next) => {
        throw new Error('not me!');
      });

      route.post((ctx, next) => {
        ctx.called = true;
        return next();
      });

      return new Promise((done, reject) => {
        route.dispatch(ctx, () => {
          should(ctx.called).be.true();
          return done();
        })
          .catch(reject);
      });
    });

    it('should allow fallthrough', async () => {
      const ctx = { order: '', method: 'GET', url: '/' };
      const route = new Route('');

      route.get((ctx, next) => {
        ctx.order += 'a';
        return next();
      });

      route.all((ctx, next) => {
        ctx.order += 'b';
        return next();
      });

      route.get((ctx, next) => {
        ctx.order += 'c';
        return next();
      });

      return new Promise((done, reject) => {
        route.dispatch(ctx, () => {
          ctx.order.should.equal('abc');
          return done();
        })
          .catch(reject);
      });
    });
  });

  describe('errors', () => {
    it('should handle errors via arity 4 functions', async () => {
      const ctx = { order: '', method: 'GET', url: '/' };
      const route = new Route('');

      const promise = new Promise((done) => {
        route.all(async (ctx, next) => {
          try {
            return await next();
          } catch (e) {
            ctx.order += 'a';
            should(e).be.ok();
            should(e.message).equal('foobar');
            ctx.order.should.equal('a');
            return done();
          }
        });
      });
      promise.catch(() => {});

      route.all((ctx, next) => {
        throw new Error('foobar');
      });

      route.all((ctx, next) => {
        ctx.order += '0';
        return next();
      });

      return new Promise((done, reject) => {
        (async () => {
          await route.dispatch(ctx);
          await promise;
          return done();
        })().catch(reject);
      });
    });

    it('should handle throw', async () => {
      const ctx = { order: '', method: 'GET', url: '/' };
      const route = new Route('');

      const promise = new Promise((done) => {
        route.all(async (ctx, next) => {
          try {
            return await next();
          } catch (e) {
            ctx.order += 'a';
            should(e).be.ok();
            should(e.message).equal('foobar');
            ctx.order.should.equal('a');
            return done();
          }
        });
      });
      promise.catch(() => {});

      route.all((ctx, next) => {
        throw new Error('foobar');
      });

      route.all((ctx, next) => {
        ctx.order += '0';
        return next();
      });

      return new Promise((done, reject) => {
        (async () => {
          await route.dispatch(ctx);
          await promise;
          return done();
        })().catch(reject);
      });
    });

    it('should handle throwing inside error handlers', async () => {
      const ctx = { method: 'GET', url: '/' };
      const route = new Route('');

      const promise = new Promise((done) => {
        route.all(async (ctx, next) => {
          try {
            return await next();
          } catch (e) {
            ctx.message = e.message;
            should(ctx.message).equal('oops');
            return done();
          }
        });
      });
      promise.catch(() => {});

      route.all(async (ctx, next) => {
        try {
          return await next();
        } catch (e) {
          throw new Error('oops');
        }
      });

      route.get((ctx, next) => {
        throw new Error('boom!');
      });

      route.get((err, ctx, next) => {
        throw new Error('oops');
      });

      return new Promise((done, reject) => {
        (async () => {
          await route.dispatch(ctx);
          await promise;
          return done();
        })().catch(reject);
      });
    });

    it('should handle throw in .all', async () => {
      const ctx = { method: 'GET', url: '/' };
      const route = new Route('');

      const promise = new Promise((done) => {
        route.all(async (ctx, next) => {
          try {
            return await next();
          } catch (e) {
            should(e).be.ok();
            e.message.should.equal('boom!');
            return done();
          }
        });
      });
      promise.catch(() => {});

      route.all((ctx, next) => {
        throw new Error('boom!');
      });

      return new Promise((done, reject) => {
        (async () => {
          await route.dispatch(ctx);
          await promise;
          return done();
        })().catch(reject);
      });
    });

    it('should handle single error handler', async () => {
      const ctx = { method: 'GET', url: '/' };
      const route = new Route('');

      route.all(async (ctx, next) => {
        try {
          return await next();
        } catch (e) {
          // this should not execute
          true.should.be.false();
        }
      });

      return new Promise((done, reject) => {
        route.dispatch(ctx, done).catch(reject);
      });
    });
  });

  describe('query condition', () => {
    it('should work on string and regexp condition', async () => {
      let order = 0;
      const route = new Route('');

      route.all({ state: /ing$/ }, async (ctx, next) => {
        should(++order).equal(3);
        return next();
      });

      route.get({ state: 'started' }, async (ctx, next) => {
        should(++order).equal(1);
        return next();
      });

      route.get({ state: 'progressing' }, async (ctx, next) => {
        should(++order).equal(4);
      });

      route.get(async (ctx, next) => {
        should(++order).equal(2);
      });

      return new Promise((done, reject) => {
        (async () => {
          await route.dispatch({ url: '/', method: 'GET', query: { state: 'started' } });
          await route.dispatch({ url: '/', method: 'GET', query: { state: 'progressing' } });
          should(order).equal(4);
          return done();
        })().catch(reject);
      });
    });

    it('should work on array condition', async () => {
      let order = 0;
      const route = new Route('');

      let expected = 1;
      route.get({ state: ['started', 'progressing'] }, async (ctx, next) => {
        should(++order).equal(expected);
        expected = 4;
        return next();
      });

      let expected2 = 2;
      route.get(async (ctx, next) => {
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
          await route.dispatch({ url: '/', method: 'GET', query: { state: 'progressing' } });
          // 3
          await route.dispatch({ url: '/', method: 'GET', query: {} });
          // 4, 5
          await route.dispatch({ url: '/', method: 'GET', query: { state: 'started' } });
          // 6
          await route.dispatch({ url: '/', method: 'GET', query: { state: 'end' } });
          should(order).equal(6);
          return done();
        })().catch(reject);
      });
    });

    it('should work on json or function condition', async () => {
      let order = 0;
      const route = new Route('');

      route.get(async (ctx, next) => {
        ++order;
        return next();
      });

      route.get({ state: val => val && val % 2 === 0 }, async (ctx, next) => {
        should(++order).equal(7);
        return next();
      });

      route.get({ state: 1 }, async (ctx, next) => {
        should(++order).equal(2);
        return next();
      });

      route.get({ state: false }, async (ctx, next) => {
        should(++order).equal(5);
        return next();
      });

      return new Promise((done, reject) => {
        (async () => {
          // 1, 2
          await route.dispatch({ url: '/', method: 'GET', query: { state: '1' } });
          // 3
          await route.dispatch({ url: '/', method: 'GET', query: {} });
          // 4, 5
          await route.dispatch({ url: '/', method: 'GET', query: { state: 'false' } });
          // 6, 7
          await route.dispatch({ url: '/', method: 'GET', query: { state: '4' } });
          // 8
          await route.dispatch({ url: '/', method: 'GET', query: { state: '[1, 2]' } });
          should(order).equal(8);
          return done();
        })().catch(reject);
      });
    });
  });
});
