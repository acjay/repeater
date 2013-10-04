// In the browser, these will be global; from the console, need to require
var repeater = this.repeater || require('../src/repeater'),
	when = this.when || require('../node_modules/when/when'),
	expect = this.expect || require('../node_modules/expect.js/expect.js'),
	util = this.util || require('./util.js');

describe('Resumable Chain', function () {
	describe('with 3 successful functions', function () {
		var state,
			getState = function () { return state; };

		beforeEach(function () {
			state = {};
			state.options = util.optionsMethodFactory({ 
				first: 1, second: 1, third: 1, onError: 0
			});
			state.asyncFunc = repeater.resumable(null, [state.options.first, state.options.second, state.options.third], state.options);
			state.shouldResolve = true;
		});

		it('should resolve after go is called');
		it('should call the first function once', util.assertCalled(getState, 'first', 1));
		it('should call the second function once', util.assertCalled(getState, 'second', 1));
		it('should call the third function once', util.assertCalled(getState, 'third', 1));
		it('should not call onError', util.assertCalled(getState, 'onError', 0));
	});

	describe('with two successful functions and one that rejects twice and then resolves', function () {
		var state,
			getState = function () { return state; };

		beforeEach(function () {
			state = {};
			state.options = util.optionsMethodFactory({ 
				first: 1, second: 3, third: 1, onError: 0
			});
			state.asyncFunc = repeater.resumable(null, [state.options.first, state.options.second, state.options.third], state.options);
		});

		describe('when resumable is called once', function () {
			beforeEach(function () {
				state.shouldResolve = false;
			});

			it('should call the first function once', util.assertCalled(getState, 'first', 1));
			it('should call the second function once', util.assertCalled(getState, 'second', 1));
			it('should not call the third function', util.assertCalled(getState, 'third', 0));
			it('should call onError once', util.assertCalled(getState, 'onError', 1));
		});
		
		describe('when resumable is called twice', function () {
			beforeEach(function (done) {
				// pre-run first attempt
				state.asyncFunc().ensure(done); 
				state.shouldResolve = false;
			});

			it('should call the first function once', util.assertCalled(getState, 'first', 1));
			it('should call the second function twice', util.assertCalled(getState, 'second', 2));
			it('should not call the third function', util.assertCalled(getState, 'third', 0));
			it('should call onError twice', util.assertCalled(getState, 'onError', 2));
		});

		describe('when resumable is called three times', function () {
			beforeEach(function (done) {
				// pre-run first and second attempts
				state.asyncFunc().ensure(function () {
					state.asyncFunc().ensure(done); 
				});
				state.shouldResolve = true;
			});

			it('should call the first function once', util.assertCalled(getState, 'first', 1));
			it('should call the second function three times', util.assertCalled(getState, 'second', 3));
			it('should call the third function once', util.assertCalled(getState, 'third', 1));
			it('should call onError twice', util.assertCalled(getState, 'onError', 2));
		});

		describe('when resumable is called four times', function () {
			beforeEach(function (done) {
				// pre-run first and second attempts
				state.asyncFunc().ensure(function () {
					state.asyncFunc().ensure(done); 
				});
				state.shouldResolve = true;
			});

			it('should call the first function once', util.assertCalled(getState, 'first', 1));
			it('should call the second function three times', util.assertCalled(getState, 'second', 3));
			it('should call the third function once', util.assertCalled(getState, 'third', 1));
			it('should call onError twice', util.assertCalled(getState, 'onError', 2));
		});
	});
});