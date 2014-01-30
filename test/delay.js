// In the browser, these will be global; from the console, need to require
var repeater = this.repeater || require('../src/repeater'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js');

describe('Delay', function () {
	var delay = 15;

	it('should resolve after delay', function (done) {
		var flag = false,
			startTime = (new Date).getTime(),
			delayed = repeater.delay(delay);

		delayed.then(function () {
			expect((new Date).getTime()).to.be.above(startTime + delay);
			// Assuming the delay shouldn't be more than twice what is 
			// specified. This is implementation-dependent though, so may have
			// to remove.
			expect((new Date).getTime()).to.be.below(startTime + delay * 2);
			done();
		}, function () {
			expect.fail('delay promise should not be rejected');
		}).then(null, done);
	});
});