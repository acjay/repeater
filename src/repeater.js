/* 
 * repeater.js
 * https://github.com/acjay/repeater
 *
 * Copyright (c) 2013-2014 Alan Johnson 
 * Licensed under MIT license 
 * https://github.com/acjay/repeater/blob/master/license.txt
 */

(function (env) {
	'use strict';

	var when = env.when || require('when');

	/**
	  * Convenience method for repeater.retry. It allows setup code, attempt
	  * code and success/error handling code to be specified in a flat object
	  * to achieve a "declarative" workflow.
	  *
	  * @param options object containing workflow functions. All options for
	  *     `repeater.retry` are allowed, in addition to the following options:
	  *     {
	  *         maxAttempts: (required) the maximum number of attempts to make.
	  *         before: (optional) function to execute one-time setup code
	  *         attempt: (required) function containing code to be retried 
	  *             (becomes func parameter of `repeater.retry`).
	  *         validate: (optional) function containing validation code to 
	  *             determine whether the resolution value of attempt is valid.
	  *         onSuccess: (optional) function to execute when the function 
	  *             succeeds.
	  *         onFailure: (optional) function to execute when all retries are 
	  *             exhausted and the function hasn't succeeded.
	  *         lastly: (optional) function to execute on success or failure.
	  *     }
	  * @return an automatically retrying function/method
	  */
	env.repeater = function(options) {
		return function () {
			var before = funcOrNull.call(this, options.before),
				attempt = funcOrNull.call(this, options.attempt),
				validate = funcOrNull.call(this, options.validate),
				onSuccess = funcOrNull.call(this, options.onSuccess),
				onError = funcOrNull.call(this, options.onError),
				lastly = funcOrNull.call(this, options.lastly),
				retrySeq = null,
				decoratedRetrySeq = null,
				mainSeq = null;

			retrySeq = makePipeline.call(this, [attempt, validate]);
			decoratedRetrySeq = env.repeater.retry.call(this, options.maxAttempts, retrySeq, options);
			mainSeq = makePipeline.call(this, [before, decoratedRetrySeq, onSuccess]);
			return mainSeq.apply(this, arguments).otherwise(onError).ensure(lastly);
		}
	}

	/**
	  * Function/method decorator for automatically retrying (a)synchronous
	  * functions a given number of times. All optional function arguments are
      * executed within the context the decorator is called.
	  *
	  * Return a function that, when called, stores the arguments to func, 
	  * sets up the retry sequence, and returns a promise on the final
	  * result.
	  *
	  * @param maxAttempts the maximum number of times to try func. Can be a 
	  *     function taking the host object as an argument (like lodash's
	  * 	`_.property`, or method on the host object, but it will be called
	  *		once per call of the decorated function.
	  * @param func the function to try
	  * @param options object containing optional parameters:
	  *     {
	  *         beforeRetry: function taking the value promised by func to be 
	  *             called between retries. Could be used for logging, 
	  *	            delaying, updating UI, etc. If an exception is thrown, the
	  *             rejection handler will itself reject instead of retrying 
	  *             the func, and will proceed to the next attempt or final 
	  *             failure.
	  *         provideAllErrors: if set to truthy, if all attempts are 
	  *             exhausted without success, all rejection values are 
	  *             returned in an array. Default behavior is to return only 
	  *             the last rejection value.
	  *     }
	  * @return the decorated version of func
	  */
	env.repeater.retry = function(maxAttempts, func, options) {
		options = options || {};

		return function () {
			var hostObj = this, // context of func if it's a method
				beforeRetry = funcOrNull.call(hostObj, options.beforeRetry),
				funcArgs = arguments,
				chain = null,
				errorLog = [], 
				succeeded = false,
				tries = env.repeater.resolve.call(hostObj, maxAttempts),
				tryNumber = null;

			// Make the first attempt
			chain = promiseFunc();

			// Queue up handlers for retries
			for (tryNumber = 2; tryNumber <= tries; tryNumber++) {
				chain = chain.otherwise(retryFailureFilter);
			}

			// Add handler for final failure
			chain = chain.otherwise(finalRejctionFilter);

			return chain;

			function promiseFunc() {
				// Wrap func in a promise, even if it's synchronous
				try {
					return when(func.apply(hostObj, funcArgs));
				} catch (err) {
					return when.reject(err);
				}
			}

			function retryFailureFilter(err) {
				// Store the reject() arguments
				errorLog.push(err);

				// Resolve with the result of the retry
				// (promiseFunc ignores err if beforeRetry is not provided)
				return makePipeline.call(hostObj, [beforeRetry, promiseFunc])(err);
			}

			function finalRejctionFilter(val) {
				errorLog.push(val);

				// Forward a final rejected promise
				if (options.provideAllErrors) {
					throw errorLog;
				} else {
					throw errorLog[errorLog.length - 1];
				}
			}
		};
	};

	/**
	  * Promise compliant delay function. Can be wrapped in a function and used
	  * as a beforeRetry callback to space out attempts of a retry-wrapped 
	  * task.
	  * 
	  * @param ms the number of milliseconds to delay
	  * @return a promise that is resolved after a delay
	  */
	env.repeater.delay = function (ms) {
		return when.promise(function (resolve) { setTimeout(resolve, ms); });
	};

	/**
	  * Decorator to attach a timeout to an asynchronous function. If the
	  * timeout expires before the function resolves, the resulting promise
	  * will be rejected with an exception with 'Timeout Exception'. This name
	  * is also available as `repeater.timeout.errorName`. If the function
	  * succeeds before the timeout, it passes through the result of the
	  * function.
	  *
	  * If `func` returns a non-promise value, it will be returned directly,
	  * without any timeout countdown. This is because there would be no way
	  * for the timeout to preempt the result, anyway. If `func` throws an
	  * exception synchronously, so will the decorated version. Each of these
	  * behaviors insure that the decorated version acts the same as the
	  * original, whenver possible.
	  *
	  * @param ms the number of milliseconds before rejecting the promise. If
	  *		passed as a function, it will be evaluated in the context the
	  *		decorated function is called within, and the context will also be
	  *		passed as the first argument (for use with lodash's `_.property`,
	  *		for instance.
	  * @param func the function to decorate
	  * @return the decorated version of `func`
	  */
	env.repeater.timeout = function (ms, func) {
		return function () {
			var hostObj = this,
				promisedResult = func.apply(this, arguments);

			if (when.isPromiseLike(promisedResult)) {
				return when.promise(function (resolve, reject) {
					var effectiveMs = env.repeater.resolve.call(hostObj, ms),
						timebomb = {
								name: env.repeater.timeout.errorName,
								message: effectiveMs + 'ms elapsed without a result',
								toString: function () { return timebomb.name + ': ' + timebomb.message; }
						};

					// Setup a race between the countdown and the function
					env.repeater.delay(effectiveMs).then(function () {
						// If the promise has an abort method (like a jQuery 
						// jqxhr object), call it to cancel to operation. 
						env.repeater.resolve(promisedResult.abort);
						reject(timebomb); 
					});
					when(promisedResult, resolve, reject);
				});
			} else {
				return promisedResult;
			}
		};
	};
	env.repeater.timeout.errorName = 'Timeout Exception';

	/**
	  * Creates a resumable chain of possibly asynchronous functions. When the 
	  * result is called, the functions are executed in order, with 
	  * intermediate results passed down the line. If one of the functions 
	  * rejects or throws an exception, the process halts. If the same object 
	  * is called again, the sequence resumes from the failed function on. The 
	  * argument for the failed function is automatically remembered.
	  *
	  * @param context the `this` context for the functions
	  * @param funcs an array of functions to call
	  * @param optional parameters
	  *     {
	  *         initialArg: (optional) argument for first function
	  *         onError: (optional) rejection filter if a function fails
	  *     }
	  * @return a function that starts/resumes the sequence, when called
	  */
	env.repeater.resumable = function (context, funcs, options) {
		// Start at the begining of the chain
		var progress = 0,
			lastResult;

		options = options || {};
		lastResult = options.initialArg;

		// When called, this queues up a sequence from wherever the last call
		// errored out
		return function () {
			var startFuncIndex = progress,
				chain = when.reduce(funcs.slice(progress), function (prevResult, nextFunc, index) {
					// index is 0 based, recover the absolute index
					var funcIndex = startFuncIndex + index; 

					// Update our progress so we can resume if interrupted
					lastResult = prevResult;
					progress = funcIndex;

					return nextFunc.call(context, prevResult);
				}, lastResult)

			// Attach error handler
			chain = chain.otherwise(funcOrNull.call(context, options.onError));

			return chain;
		};
	};

	/**
	  * Pick a property off of the context with which `repeater.prop` is
	  * called.
	  *
	  * This is primarily useful for run-time configuration of combinator
	  * options, e.g. configuring the `maxAttempts` argument of 
	  * `repeater.retry` with a property or method result on the same object
	  * from which the decorated method is called.
	  *
	  * @param propName the property to return off of the context
	  * @return a function that gets the a property of its context
	  */
	env.repeater.prop = function (propName) {
		return function () {
			return this[propName];
		}
	}

	/**
	  * Calls its argument if that argument is a function, otherwise returns
	  * the argument. This is done recursively until an non-function is
	  * encountered.
	  *
	  *	@param funcOrVal the possible function to resolve
	  * @return the eventual value of recursively calling the results
	  */
	env.repeater.resolve = function (funcOrVal) {
		return typeof funcOrVal === 'function' ? env.repeater.resolve(funcOrVal.call(this)) : funcOrVal;
	}

	function funcOrNull(f) {
		var _this = this;
		return typeof f === 'function' ? function () { return f.apply(_this, arguments); } : null;
	}

	function makePipeline(ops) {
		var hostObj = this;

		// Returned function calls a series of functions, feeding the
		// arguments to the first, and intermediate results to the 
		// subsequent functions
		return function () {
			var firstOp = true,
				initialArgs = Array.prototype.slice.call(arguments, 0);
			return when.reduce(ops, function (prevResult, nextOp, index) {
				if (nextOp) {
					if (firstOp) {
						firstOp = false;
						return nextOp.apply(hostObj, initialArgs);
					} else {
						// Send the intermediate result, plus initial args to subsequent functions
						return nextOp.apply(hostObj, [prevResult].concat(Array.prototype.slice.call(initialArgs, 0)));
					}	
				} else {
					return prevResult;
				}
			}, {});	// Need to feed reduce an initial dummy value
		}			
	}

	if (typeof module !== 'undefined') {
		module.exports = env.repeater;
	}
})(this);