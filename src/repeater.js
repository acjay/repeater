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
	  */
	env.repeater = function(options) {
		return function () {
			var hostObj = this,
				before = funcOrNull.call(hostObj, options.before),
				validate = funcOrNull.call(hostObj, options.validate),
				onSuccess = funcOrNull.call(hostObj, options.onSuccess),
				onError = funcOrNull.call(hostObj, options.onError),
				lastly = funcOrNull.call(hostObj, options.lastly),
				attempt = null, 
				chain = null;

			// If a validator is provided, tack it on as a promise handler on the
			// attempt function.
			if (validate) {
				attempt = function () {
					return when(options.attempt.apply(hostObj, arguments)).then(validate);
				}
			}

			// Get the retry-wrapped function
			var decorated = env.repeater.retry.call(hostObj, options.maxAttempts, attempt, options);

			if (before) {
				chain = when(before.apply(hostObj, arguments)).then(decorated);
			} else {
				chain = decorated(arguments);
			}
			chain = chain.then(funcOrNull.call(hostObj, onSuccess), funcOrNull.call(hostObj, onError));
			chain = chain.ensure(lastly);
			return chain;
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
	  *     function or method on the same object, but it will only be called
	  *     once per call of the decorated function.
	  * @param func the function to try
	  * @param options object containing optional parameters:
	  *     beforeRetry: function taking the value promised by func to be 
	  *         called between retries. Could be used for logging, delaying, 
	  *         updating UI, etc. If an exception is thrown by beforeRetry, the
	  *         rejection handler will itself reject instead of retrying the 
	  *         func, and will proceed on to the next attempt or final failure.
	  *     provideAllErrors: if set to truthy, if all attempts are exhausted
	  *         without success, all rejection values are returned in an array.
	  *         Default behavior is to return only the last.
	  * @return the decorated version of func
	  */
	env.repeater.retry = function(maxAttempts, func, options) {
		options = options || {};

		if (typeof options.maxAttempts !== 'number' || typeof options.maxAttempts !== 'function') {
			options.maxAttempts = 1;
		}

		return function () {
			var hostObj = this, // context of func if it's a method
				funcArgs = arguments,
				chain = null,
				errorLog = [], 
				succeeded = false,
				tries = callIfFunc.call(hostObj, maxAttempts),
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
				// Turn func into a promise, even if it's synchronous
				try {
					return when(func.apply(hostObj, funcArgs));
				} catch (err) {
					return when.reject(err);
				}
			}

			function retryFailureFilter(err) {
				var nextAttempt = null;

				// Store the reject() arguments
				errorLog.push(err);

				if (options.beforeRetry) {
					// If beforeRetry throws an exception, the rejection 
					// will reject instead of calling the function.
					nextAttempt = when(callIfFunc.call(hostObj, options.beforeRetry, err)).then(promiseFunc);
				} else {
					nextAttempt = promiseFunc();
				}

				// Forward the promise of the next attempt
				return nextAttempt;
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
	  * as a beforeRetry callback to space out attempts of a 
	  * retry-wrapped task.
	  * 
	  * @param ms the number of milliseconds to delay
	  * @param an optional function to call after the delay
	  * @return a promise that is resolved after a delay
	  */
	env.repeater.delay = function (ms, func) {
		return when.promise(function (resolve, reject) {
			setTimeout(function () {
				if (typeof func === 'function') {
					try {
						when(func.apply(null)).then(resolve, reject);	
					} catch (err) {
						reject(err);
					}
				} else {
					resolve();
				}
			}, ms);
		});
	};

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
			chain = chain.otherwise(options.onError);

			return chain;
		};
	};


	function funcOrNull(f) {
		var _this = this;
		return typeof f === 'function' ? function () { return f.apply(_this, arguments); } : null;
	}

	function callIfFunc(f) {
		return typeof f === 'function' ? f.apply(this, Array.prototype.slice(arguments, 1)) : f;
	}

	if (typeof module !== 'undefined') {
		module.exports = env.repeater;
	}
})(this);