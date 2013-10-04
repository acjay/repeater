var expect = this.expect || require('../node_modules/expect.js/expect.js');

(function (env) {
	env.util = {
		testAsync: function (func, onResolve, onReject, doneCallback, ensureCallback) {
			func().then(onResolve, onReject).then(null, doneCallback).ensure(ensureCallback);
		},
		testFuncFactory: function (triesToSucceed) {
			// Create a bunch of test funcs that track the number of times they are
			// called, and reject a specified number of times before resolving
			if (triesToSucceed == null) return null;

			var attempter = function () {
				attempter.args.push(Array.prototype.slice(arguments, 0));
				attempter.attempt += 1;
				if (attempter.attempt >= triesToSucceed && triesToSucceed > 0) {
					return attempter.attempt;
				} else {
					throw attempter.attempt;
				}
			};
			attempter.attempt = 0;
			attempter.args = [];
			return attempter;
		},
		optionsMethodFactory: function (triesDict) {
			// Create a bunch of test funcs to to serve as callbacks for repeater, to
			// confirm that callbacks are called under the presumed conditions
			var obj = {},
				prop;

			for (prop in triesDict) {
				obj[prop] = env.util.testFuncFactory(triesDict[prop]);
			}

			return obj;
		},
		assertCalled: function (getState, method, numCalls, ensureCallback) {
			// Check the number of calls and resolution status of a given 
			// method in the state.options object
			return function (done) {
				var state = getState();
				if (state.shouldResolve) {
					env.util.testAsync(state.asyncFunc, function () {
						expect(state.options[method].attempt).to.be(numCalls);
						done();
					}, null, done, ensureCallback);
				} else {
					env.util.testAsync(state.asyncFunc, function () {
						throw 'should not have resolved';
					}, function () {
						expect(state.options[method].attempt).to.be(numCalls);
						done();
					}, done, ensureCallback);
				}
			}
		}
	};

	if (typeof module !== 'undefined') {
		module.exports = env.util;
	}
})(this);