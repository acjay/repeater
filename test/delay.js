// In the browser, these will be global; from the console, need to require
var repeater = this.repeater || require('../src/repeater'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js');

describe('Delay', function () {
	var delay = 5;

	it('should call its callback', function (done) {
		var flag = false,
			callback = function (arg) { flag = true; }, 
			delayed = repeater.delay(delay, callback);

		delayed.then(function () {
			expect(flag);
			done();
		}, function () {
			expect.fail('delay promise should not be rejected');
		}).then(null, done);
	});

	it('should be rejected if its callback rejects', function (done) {
		var callback = function (arg) { throw {}; },
			delayed = repeater.delay(delay, callback);

		delayed.then(function () {
			expect.fail('delay promise should not be resolved');
		}, function () {
			done();
		}).then(null, done);
	});
});