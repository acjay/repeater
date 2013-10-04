// In the browser, these will be global; from the console, need to require
var repeater = this.repeater || require('../src/repeater'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js'),
	util = this.util || require('./util.js');

describe('Retry', function () {
	describe('called with maxAttempts = 1', function () {
		var maxAttempts = 1;

		describe('with successful func', function () {
			var successAttempt = 1;

			it('should call func only once', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function (val) { 
					expect(val).to.be(1);
					done(); 
				}, function (err) {
					expect(err).to.be(1);
					done();
				}, done);
			});

			it('should resolve when func\'s promise is resolved', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function () {
					done();
				}, function () {
					throw new Error('promise was not resolved');
				}, done);
			});
		});

		describe('with unsuccessful func', function () {
			var successAttempt = 2;

			it('should reject when func\'s promise is rejected', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function () { 
					throw new Error('promise was not rejected');
				}, function () {
					done();
				}, done);
			});
		});
	});

	describe('called with beforeRetry', function () {
		var maxAttempts = 3,
			successAttempt = 2;

		it('should call beforeRetry function before retrying', function (done) {
			var flag = false,
				options = { beforeRetry: function () { flag = true; } },
				asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt), options);
			util.testAsync(asyncFunc, function () {
				expect(flag);
				done();
			}, function () {
				expect(flag);
				done();
			}, done);
		});

		describe('using repeater.retry.delay', function () {
			it('should delay, then resolve', function (done) {
				var nominalDelay = 50,
					options = { beforeRetry: repeater.delay(nominalDelay) },
					asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt), options),
					startTime = +new Date();
				util.testAsync(asyncFunc, function () {
					expect(+new Date() - startTime >= nominalDelay);
					done();
				}, null, done);				
			});
		});
	});

	describe('called as a method', function () {
		var maxAttempts = 3;

		it('should call func in its original context', function (done) {
			var testObj = {
					prop: {},
					asyncFunc: repeater.retry(maxAttempts, function () { return this.prop; })
				};
			testObj.asyncFunc().then(function (val) {
				expect(val).to.be(testObj.prop);
				done();
			}, function (err) {
				throw new Error(err);
			}).then(null, done);
		});
		
		it('should call beforeRetry in its original context', function (done) {
			var flag = false,
				propVal = {},
				testObj = {
					prop: propVal,
					asyncFunc: repeater.retry(maxAttempts, function () { 
						throw {};
					}, { 
						beforeRetry: function () { 
							flag = (this.prop === propVal);
						}
					})
				};
			testObj.asyncFunc().then(function (val) {
				throw new Error('promise should never be resolved');
			}, function (err) {
				expect(flag);
				done();
			}, done);
		});
	});

	describe('called with maxAttempts = 3', function () {
		var maxAttempts = 3;

		describe('and func resolves on first call', function () {
			var successAttempt = 1;

			it('should resolve', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function () {
					done();
				}, function () {
					throw new Error('promise was not resolved');
				}, done);
			});

			it('should call func once', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function (val) {
					expect(val).to.be(1);
					done();
				}, function (err) {
					expect(err).to.be(1);
					done();
				}, done);
			});
		});

		describe('and func\'s promise is rejected 3 times', function () {
			var successAttempt = 4;

			it('should reject', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function () {
					throw new Error('promise was incorrectly resolved');
				}, function () {
					done();
				}, done);
			});

			it('should call func 3 times', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function (val) {
					expect(val).to.be(3);
					done();
				}, function (err) {
					expect(err).to.be(3);
					done();
				}, done);
			});

			describe('and provideAllErrors is set', function () {
				it('all errors should be provided', function (done) {
					var options = { provideAllErrors: true },
						asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
					util.testAsync(asyncFunc, function (val) {
						expect.fail('promise was incorrectly resolved');
					}, function (err) {
						var errIndex;
						for (errIndex = 0; errIndex < err.length; errIndex++) {
							expect(err[errIndex]).to.be(errIndex + 1);
						}
						done();
					}, done);
				});				
			});

			describe('and beforeRetry throws exceptions', function () {
				it('should reject with beforeRetry\'s rejction error', function (done) {
					var errVal = {},
						options = { beforeRetry: function () { throw errVal; } };
						asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt), options);
					util.testAsync(asyncFunc, function (val) {
						throw new Error('promise was incorreclty resolved');
					}, function (err) {
						expect(err).to.be(errVal);
						done();
					}, done);
				})
			});
		});
		
		describe('and func reject twice then resolves', function () {
			var successAttempt = 3;

			it('should resolve', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function () {
					done();
				}, function () {
					throw new Error('promise was incorrectly rejected');
				}, done);
			});

			it('should call func 3 times', function (done) {
				var asyncFunc = repeater.retry(maxAttempts, util.testFuncFactory(successAttempt));
				util.testAsync(asyncFunc, function (val) {
					expect(val).to.be(3);
					done();
				}, function (err) {
					expect(err).to.be(3);
					done();
				}, done);
			});
		});
	});
});
