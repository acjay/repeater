(function (env) {
	'use strict';

	var when = env.when || require('when');

	env.retryPromise = function(maxAttempts, func, options) {
		options = options || {};

		// Return a function that, when called, stores the arguments to func, 
		// sets up the retry sequence, and returns a promise on the final
		// result
		return function () {
			var funcArgs = arguments,
				chain = null,
				errorLog = [], 
				succeeded = false,
				tries = (typeof maxAttempts === 'function') ? maxAttempts.call(this) : maxAttempts,
				tryNumber = null;

			// Make the first attempt and save the promise
			chain = when(func.apply(this, funcArgs));

			// Queue up handlers for retries
			for (tryNumber = 2; tryNumber <= tries; tryNumber++) {
				chain.then(retrySuccessFilter).then(retrySuccessFilter, retryfailureFilter);
				//chain.then(retrySuccessFilter).then(null, finalRejctionFilter); // also fails
			}

			// Add handler for final failure
			chain.then(retrySuccessFilter).then(retrySuccessFilter, finalRejctionFilter);
			//chain.then(retrySuccessFilter).then(null, finalRejctionFilter); // also fails

			function retrySuccessFilter(val) {
				// func() succeeded, but the response might be a failure
				if (succeeded || typeof options.successPredicate !== 'function' || options.successPredicate(val)) {
					// Pipe the resolved promise (which will propogate through 
					// all upcoming promises)
					succeeded = true;
					return val;
				} else {
					// Trigger the error handler
					throw val;
				}
			}

			function retryFailureFilter(val) {
				errorLog.push(val);

				// Pipe the promise of the next attempt
				return func.apply(this, funcArgs);
			}

			function finalRejctionFilter(val) {
				errorLog.push(val);

				// throw an error to reject final promise
				if (options.provideAllErrors) {
					throw errorLog;
				} else {
					throw errorLog[errorLog.length - 1];
				}
			}

			return chain;
		};
	};

	if (typeof module !== 'undefined') {
		module.exports = env.retryPromise;
	}
})(this);