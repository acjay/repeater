// In the browser, these will be global; from the console, need to require
var repeater = this.repeater || require('../src/repeater'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js');

describe('Timeout', function () {
	it('should call its callback with the provided arguments', function (done) {
		var maxTime = 1000,
			flag = false,
			arg1Val = {},
			arg2Val = {},
			quickFunc = function (arg1, arg2) { flag = arg2; },
			timeout = repeater.timeout(maxTime, quickFunc);

		timeout(arg1Val, arg2Val).then(function () {
			expect(flag).to.be(arg2Val);
			done();
		}, function () {
			throw 'timeout should not expire';
		}).then(null, done);
	});

	it('should reject if the timer expires', function (done) {
		var successDelay = 1500,
			maxTime = 5,
			longFunc = function () { return repeater.delay(successDelay); },
			timeout = repeater.timeout(maxTime, longFunc);

		timeout().then(function () {
			throw 'func should not finish before timeout';
		}, function (err) {
			expect(err.name).to.be(repeater.timeout.errorName);
			done();
		}).then(null, done);
	});

	it('should resolve if func resolves, passing the resolution value', function (done) {
		var successDelay = 5,
			maxTime = 1000,
			successVal = {},
			successfulFunc = function () {
				return repeater.delay(successDelay).yield(successVal);
			},
			timeout = repeater.timeout(maxTime, successfulFunc);

		timeout().then(function (val) {
			expect(val).to.be(successVal);
			done();
		}, function (err) {
			throw 'func should not reject';
		}).then(null, done);
	});

	it('should throw if func throws synchronously', function () {
		var maxTime = 1000,
			failingFunc = function () { throw errVal; },
			timeout = repeater.timeout(maxTime, failingFunc);

		expect(timeout).to.throwException();
	});

	it('should reject if func rejects, passing the error', function (done) {
		var failDelay = 5,
			maxTime = 1000,
			errVal = {},
			failingFunc = function () {
				return repeater.delay(failDelay).then(function () { throw errVal; });
			},
			timeout = repeater.timeout(maxTime, failingFunc);

		timeout().then(function () {
			throw 'func should not resolve';
		}, function (err) {
			expect(err).to.be(errVal);
			done();
		}).then(null, done);
	});
});