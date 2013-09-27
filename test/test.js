// In the browser, these will be global; from the console, need to require
var retryPromise = this.retryPromise || require('../src/retry-promise'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js');

// when.then() captures exceptions generated by program errors and
// failed exceptions, so there needs to be an extra then to pass
// those back to mocha. See http://bit.ly/R72Dwd
function testAsync(func, onResolve, onReject, doneCallback) {
	func().then(onResolve, onReject).then(null, doneCallback);
}

describe('Retry Promise', function () {
	// Will fail a given number of times, and then succeed
	function testFuncFactory (triesToSucceed) {
		var attempt = 1;
		return function () {
			if (attempt < triesToSucceed) {
				throw attempt++;
			} else {
				return attempt++;
			}
		};
	}

	describe('called with maxAttempts = 1', function () {
		var maxAttempts = 1;

		describe('with successful func', function () {
			var successAttempt = 1;

			it('should call func only once', function (done) {
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function (val) { 
					expect(val).to.be(1);
					done(); 
				}, function (err) {
					expect(err).to.be(1);
					done();
				});
			});

			it('should resolve when func\'s promise is resolved', function (done) {
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function () {
					done();
				}, function () {
					expect().fail('promise was not resolved');
				}, done);
			});

			it('should call beforeResolve when func\'s promise is resolved', function (done) {
				var options = { beforeResolve: function () { done(); }};
					asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options);
				testAsync(asyncFunc, null, null, done);
			});

			it('should resolve with beforeResolve\'s promised value', function (done) {
				var resolutionValue = 'test',
					options = { beforeResolve: function () { return resolutionValue }};
					asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options);
				testAsync(asyncFunc, function (val) { 
					expect(val).to.be(resolutionValue); 
					done(); 
				}, null, done);
			});

			it('should reject if beforeResolve rejects', function (done) {
				var rejectionValue = 'test',
					options = { beforeResolve: function () { throw rejectionValue }};
					asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options);
				testAsync(asyncFunc, null, function (err) { 
					expect(err).to.be(rejectionValue); 
					done(); 
				}, done);
			});
		});

		describe('with unsuccessful func', function () {
			var successAttempt = 2;

			it('should reject when func\'s promise is rejected', function (done) {
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function () { 
					expect().fail('promise was not rejected');
				}, function () {
					done();
				}, done);
			});

			it('should call beforeReject when func\'s promise is resolved', function (done) {
				var options = { beforeReject: function () { done(); }};
					asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options);
				testAsync(asyncFunc, null, null, done);
			});

			it('should resolve if beforeReject resolves', function (done) {
				var resolutionValue = 'test',
					options = { beforeReject: function () { return resolutionValue }};
					asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options);
				testAsync(asyncFunc, function (val) { 
					expect(val).to.be(resolutionValue); 
					done(); 
				}, null, done);
			});

			it('should reject with beforeRejects\'s rejection value', function (done) {
				var rejectionValue = 'test',
					options = { beforeReject: function () { throw rejectionValue }};
					asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options);
				testAsync(asyncFunc, null, function (err) { 
					expect(err).to.be(rejectionValue); 
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
				asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options);
			testAsync(asyncFunc, function () {
				expect(flag);
				done();
			}, function () {
				expect(flag);
				done();
			}, done);
		});

		describe('using retryPromise.delay', function () {
			it('should delay, then resolve', function (done) {
				var nominalDelay = 50,
					options = { beforeRetry: retryPromise.delay(nominalDelay) },
					asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options),
					startTime = +new Date();
				testAsync(asyncFunc, function () {
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
					prop: 'test_value',
					asyncFunc: retryPromise(maxAttempts, function () { return this.prop; })
				};
			testObj.asyncFunc().then(function (val) {
				expect(val).to.be(testObj.prop);
				done();
			}, function (err) {
				expect().fail(err);
			}).then(null, done);
		});
		
		it('should call beforeRetry in its original context', function (done) {
			var flag = false,
				propVal = {},
				testObj = {
					prop: propVal,
					asyncFunc: retryPromise(maxAttempts, function () { 
						throw {};
					}, { 
						beforeRetry: function () { 
							flag = (this.prop === propVal);
						}
					})
				};
			testObj.asyncFunc().then(function (val) {
				expect().fail('promise should never be resolved');
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
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function () {
					done();
				}, function () {
					expect().fail('promise was not resolved');
				}, done);
			});

			it('should call func once', function (done) {
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function (val) {
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
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function () {
					expect().fail('promise was incorrectly resolved');
				}, function () {
					done();
				}, done);
			});

			it('should call func 3 times', function (done) {
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function (val) {
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
						asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
					testAsync(asyncFunc, function (val) {
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
						asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt), options);
					testAsync(asyncFunc, function (val) {
						expect().fail('promise was incorreclty resolved');
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
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function () {
					done();
				}, function () {
					expect().fail('promise was incorrectly rejected');
				}, done);
			});

			it('should call func 3 times', function (done) {
				var asyncFunc = retryPromise(maxAttempts, testFuncFactory(successAttempt));
				testAsync(asyncFunc, function (val) {
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

describe('Delay', function () {
	var delay = 5;

	it('should call its callback', function (done) {
		var flag = false,
			callback = function (arg) { flag = true; }, 
			delayed = retryPromise.delay(delay, callback);

		delayed.then(function () {
			expect(flag);
			done();
		}, function () {
			expect.fail('delay promise should not be rejected');
		}).then(null, done);
	});

	it('should be rejected if its callback rejects', function (done) {
		var callback = function (arg) { throw {}; },
			delayed = retryPromise.delay(delay, callback);

		delayed.then(function () {
			expect.fail('delay promise should not be resolved');
		}, function () {
			done();
		}).then(null, done);
	});
})