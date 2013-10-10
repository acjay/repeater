// In the browser, these will be global; from the console, need to require
var repeater = this.repeater || require('../src/repeater'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js'),
	util = this.util || require('./util.js');

describe('Repeater', function () {
	it('should call call attempt with the provided arguments');
	it('should call work with only attempt provided');

	describe('with one resolving attempt', function () {
		var state,
			getState = function () { return state; };

		beforeEach(function () {
			state = {};
			state.options = util.optionsMethodFactory({ 
				before: 1, attempt: 1, validate: 1, beforeRetry: 1, onSuccess: 1, onError: 1, lastly: 1 
			});
			state.asyncFunc = repeater(state.options);
			state.shouldResolve = true;
		});

		it('should call before once', util.assertCalled(getState, 'before', 1));
		it('should call attempt once', util.assertCalled(getState, 'attempt', 1));
		it('should call validate once', util.assertCalled(getState, 'validate', 1));
		it('should not call beforeRetry', util.assertCalled(getState, 'beforeRetry', 0));
		it('should call onSuccess once', util.assertCalled(getState, 'onSuccess', 1));
		it('should not call onError', util.assertCalled(getState, 'onError', 0));
		it('should call lastly once', util.assertCalled(getState, 'lastly', 1));
	});

	describe('with one rejecting attempt', function () {
		var state,
			getState = function () { return state; };

		beforeEach(function () {
			state = {};
			state.options = util.optionsMethodFactory({ 
				before: 1, attempt: 2, validate: 1, beforeRetry: 1, onSuccess: 1, onError: 2, lastly: 1 
			});
			state.asyncFunc = repeater(state.options);
			state.shouldResolve = false;
		});

		it('should call before once', util.assertCalled(getState, 'before', 1));
		it('should call attempt once', util.assertCalled(getState, 'attempt', 1));
		it('should not call validate', util.assertCalled(getState, 'validate', 0));
		it('should not call beforeRetry', util.assertCalled(getState, 'beforeRetry', 0));
		it('should not call onSuccess', util.assertCalled(getState, 'onSuccess', 0));
		it('should call onError once', util.assertCalled(getState, 'onError', 1));
		it('should call lastly once', util.assertCalled(getState, 'lastly', 1));
	});

	describe('with one rejection then success', function () {
		var state,
			getState = function () { return state; };

		beforeEach(function () {
			state = {};
			state.options = util.optionsMethodFactory({ 
				before: 1, attempt: 2, validate: 1, beforeRetry: 1, onSuccess: 1, onError: 1, lastly: 1 
			});
			state.options.maxAttempts = 2;
			state.asyncFunc = repeater(state.options);
			state.shouldResolve = true;
		});

		it('should call before once', util.assertCalled(getState, 'before', 1));
		it('should call attempt twice', util.assertCalled(getState, 'attempt', 2));
		it('should call validate once', util.assertCalled(getState, 'validate', 1));
		it('should call beforeRetry once', util.assertCalled(getState, 'beforeRetry', 1));
		it('should call onSuccess once', util.assertCalled(getState, 'onSuccess', 1));
		it('should not call onError', util.assertCalled(getState, 'onError', 0));
		it('should call lastly once', util.assertCalled(getState, 'lastly', 1));
	});	
})