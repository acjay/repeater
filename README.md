repeater
========

Repeater is a set of libraries for error recovery, building off of the [when.js](https://github.com/cujojs/when) library for promises. The overall goal is to provide an engine for running sequences of asynchronous tasks, retrying them automatically when they fail, and resuming failed processes without repeating successful work. Ideally, the result is more modular and declarative code, fewer explicit promises.

repeater
--------

The bare repeater function takes a number of optional callbacks to encapsulate the a retryable process in one flat object, for a readable, declarative flow. The only required parameters below are `attempt`, the core code to be tried and retried, and `maxAttempts`, which determine the number of retries for `attempt`. All callbacks are executed within the context of the object the result of `repeater` is called in.

    var obj = {
        f: repeater({
            maxAttempts: function () {
                // ...logic to calculate current number of tries
                return n;
            },
            before: function (args) {
                // ...one-time setup code, lock UI
            },
            attempt: function () {
                // ...repeatable setup code
                return $.ajax(options);
            },
            validate: function (result) {
                // ...check result

                if (wasSuccessful) {
                    return result;
                } else {
                    throw err;
                }
            },
            beforeRetry: function (err) {
                // ...delay and update UI
            },
            onSuccess: function (result) {
                // ...handle success
            },
            onError: function (err) {
                // ...notify user
            },
            lastly: function () {
                // ...restore UI to available state
            }
        })
    }

Usually, the caller of `f` would do its own setup and chain its own continuation code to the `f()` call, but the callbacks within the object passed to `repeater` would handle strictly internally facing setup and teardown specific to `obj`. This leads to a clean separation of concerns between `obj` and its client.

repeater.retry
--------------

`repeater` is actually a simple wrapper around `repeater.retry`, which is the core engine. In simple cases, it may be desirable to use `repeater.retry` directly. A typical workflow for trying a function `f` is as follows.

If `f` is synchronous and we want to try it up to `N` times before giving up, it simply needs to return its result if it worked, or throw an error to trigger a retry.

    {
    	f: repeater.retry(N, function (args) {
    		// code for attempting functionality
    		
    		if (wasSuccessful) {
    			return result;
    		} else {
    			throw err;
    		}
    	})
	}

 If the core functionality of `f` is some asynchronous operation, then it should return the promise of the result.

    {
    	f: repeater.retry(N, function (args) {
    		// setup code

    		return $.ajax(options);
    	})
	}

 Supposing that even if the asynchronous operation succeeds, the process still may need to be retried, chain validation code onto the promise within the repeatable function.

     {
    	f: repeater.retry(N, function () {
    		// setup code

    		return when($.ajax(options)).then(function (result) {
    			// validation code

    			if (wasSuccessful) {
    				return result;
    			} else {
    				throw err;
    			}
    		});
    	})
	}

 If some setup code needs to be done just once, before any attempts, make another function for kicking off the process.

     {
        tryF: function () {
        	// one-time setup code

        	return f(args);
    	},
    	f: repeater.retry(N, function (args) {
    		// setup code

    		return $.ajax(options);
    	})
	}

 Supposing final success or failure of the operation needs to be handled in some way, chain that code to the promise returned by decorated `f`. These handlers can either re-return the result, re-throw the error, or convert either to a new final result.

     {
        tryF: function () {
        	return f(args)
        	.then(function onSuccess(result) {
        		// handle success
        	}, function onFailure(err) {
        		// handle failure
        	});
    	},
    	f: repeater.retry(N, function (args) {
    		// setup code

    		return $.ajax(options);
    	})
	}

Between attempts, if some code needs to be executed (e.g. a delay, user notification, etc.), pass a callback function in `options.beforeRetry`. Note that if beforeRetry rejects, the retry attempt fails without actually retrying `f`.

repeater.resumable
------------------

repeater.delay
--------------
