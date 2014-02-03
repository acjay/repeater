// In the browser, these will be global; from the console, need to require
var repeater = this.repeater || require('../src/repeater'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js');

describe('Prop', function () {
	it('should retrive values from the context its called with', function () {
		var propVal = {},
			hostObj = { myProperty: propVal },
			getter = repeater.prop('myProperty');

		expect(getter.call(hostObj)).to.be(propVal);
	});
});