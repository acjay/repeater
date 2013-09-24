(function (env) {
	'use strict';

	var when = env.when || require('when');

	/**
	  * Function/method decorator for automatically retrying (a)synchronous
	  * functions a given number of times. All optional function arguments are
	  * executed within the context the decorator is called.
	  *
	  * Return a function that, when called, stores the arguments to func, 
	  * sets up the retry sequence, and returns a promise on the final
	  * result
	  *
	  * @param maxAttempts the maximum number of times to try func. Can be a 
	  *     function or method on the same object, but it will only be called
	  *     once per call of the decorated function.
	  * @param func the function to try
	  * @param options object containing optional parameters:
	  *     successPredicate: function taking the value promised by func and
	  *         returning true if the operation was truly successful. If either
	  *         false is returned or an exception is thrown, the attempt will
	  *         be considered a failure, and handled accordingly.
	  *     beforeRetry: function taking the value promised by func to be 
	  *         called between retries. Could be used for logging, delaying, 
	  *         updating UI, etc.
	  *     provideAllErrors: if set to truthy, if all attempts are exhausted
	  *         without success, all rejection values are returned in an array.
	  *         Default behavior is to return only the last.
	  *		beforeResolve: success function to perform before final resolution.
	  *         Provided because chaining a `then` on the decorated function
	  *         would cause many extra `then`'s upon repetition. This lets you
	  *         neatly package the code to be retried with closely related 
	  *         success handling code.
	  *		beforeReject: error function to perform before final rejection.
	  * @return the decorated version of func
	  */
	env.retryPromise = function(maxAttempts, func, options) {
		options = options || {};

		return function () {
			var _this = this, // context of func if it's a method
				funcArgs = arguments,
				chain = null,
				errorLog = [], 
				succeeded = false,
				tries = (typeof maxAttempts === 'function') ? maxAttempts.call(this) : maxAttempts,
				tryNumber = null;

			// Make the first attempt
			chain = promiseFunc();

			// Queue up handlers for retries
			for (tryNumber = 2; tryNumber <= tries; tryNumber++) {
				// Success filter could trigger failures, so split into 
				// continuation into two phases
				chain = chain.then(retrySuccessFilter).then(null, retryFailureFilter);
			}

			// Add handler for final failure
			chain = chain.then(retrySuccessFilter).then(null, finalRejctionFilter);

			if (typeof options.beforeResolve === 'function' || typeof options.beforeReject === 'function') {
				chain = chain.then(function (val) {
					return options.beforeResolve.call(_this, val);
				}, function (err) {
					return options.beforeReject.call(_this, err);
				});
			}

			return chain;

			function promiseFunc() {
				// Turn func into a promise, even if it's synchronous
				try {
					return when(func.apply(_this, funcArgs));
				} catch (err) {
					return when.reject(err);
				}
			}

			function retrySuccessFilter(val) {
				// func() succeeded, but the response might be a failure
				if (succeeded || typeof options.successPredicate !== 'function' || options.successPredicate.call(_this, val)) {
					succeeded = true;
					return val;
				} else {
					throw val;
				}
			}

			function retryFailureFilter(val) {
				var nextAttempt = null;

				// Store the reject() arguments
				errorLog.push(val);

				if (typeof options.beforeRetry === 'function') {
					nextAttempt = when(options.beforeRetry.call(_this, val)).then(promiseFunc);
				} else {
					nextAttempt = promiseFunc.call(_this);
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
	  * Promise compliant delay function. Can be used as a beforeRetry callback
	  * to space out attempts of a retryPromise-wrapped task.
	  * 
	  * @param ms the number of milliseconds to delay
	  * @param an optional function to call after the delay
	  * @return a function that, when called, returns a promise that is 
	  *     resolved after a delay
	  */
	env.retryPromise.delay = function (ms, func) {
		return function () {
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
	};

	if (typeof module !== 'undefined') {
		module.exports = env.retryPromise;
	}
})(this);