// In the browser, these will be global; from the console, need to require
var retryPromise = this.retryPromise || require('../lib/retryPromise'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js');

describe('Retry Promise', function () {
	var testFuncFactory = function (triesToSucceed) {
		var attempt = 1;
		return function () {
			if (attempt >= triesToSucceed) {
				return when(attempt++);
			} else {
				return when.reject(attempt++);
			}
		}
	};

	describe('called with maxAttempts = 1', function () {
		var maxAttempts = 1;

		it('should call func only once', function (done) {
			var asyncFunc = retryPromise(maxAttempts, testFuncFactory(1));
			asyncFunc().then(function (val) { 
				expect(val).to.be(1);
				done(); 
			}, function (val) {
				expect(val).to.be(1);
				done('func was called more than once');
			});
		});
		it('should resolve when func\'s promise is resolved', function (done) {
			var asyncFunc = retryPromise(maxAttempts, testFuncFactory(1));
			asyncFunc().then(function () {
				done();
			}, function () {
				done('promise was not resolved');
			});
		});
		it('should reject when func\'s promise is rejected', function (done) {
			var asyncFunc = retryPromise(maxAttempts, testFuncFactory(2));
			asyncFunc().then(function () { 
				done('promise was not rejected');
			}, function () {
				done();
			});
		});

		it('should reject when func\'s promise is resolved with a failing successPredicate', function (done) {
			var asyncFunc = retryPromise(maxAttempts, testFuncFactory(1), { successPredicate: function () { return false; } });
			asyncFunc().then(function () { 
				done('promise was incorrectly resolved');
			}, function () {
				done();
			});
		});
	})

	describe('called with maxAttempts = 3', function () {
		var maxAttempts = 3;

		describe('and func resolves on first call', function () {
			it('should resolve');
			it('should call func once');	
		});

		describe('and func\'s promise is rejected 3 times', function () {
			it('should reject');
			it('should call func 3 times');	
		})
		
		describe('and func reject twice then resolves', function () {
			it('should resolve');
			it('should call func 3 times');
		})
	})
})