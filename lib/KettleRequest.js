/**
 * Kettle Requests
 *
 * Copyright 2012-2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/kettle/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

fluid.defaults("kettle.requests", {
    gradeNames: ["fluid.component"],
    events: {
        createRequest: null // fired by our handler once express determines that route + verb is a match
    },
    dynamicComponents: {
        request: {
            createOnEvent: "createRequest",
            type: "{arguments}.0.type",
            options: "{arguments}.0.options"
        }
    }
});

// The member name of the currently active request as held in Infusion's "resolve root" component
kettle.requestMemberName = fluid.typeNameToMemberName("kettle.request");
    
kettle.getCurrentRequest = function () {
    return fluid.resolveRootComponent[kettle.requestMemberName];
};

kettle.markActiveRequest = function (request) {
    var parent = fluid.resolveRootComponent,
        memberName = kettle.requestMemberName,
        instantiator = fluid.globalInstantiator,
        innerRequest = kettle.getCurrentRequest();
    if (request && innerRequest && innerRequest !== request) {
        fluid.fail("Error marking thread to request " + request.id + " - this thread is already marked to request " + innerRequest.id + " . Make sure to invoke this request asynchronously.");
    }
    if (request) {
        if (fluid.isDestroyed(request)) {
            fluid.fail("Error marking thread to request " + request.id + " which has already been destroyed");
        }
        instantiator.recordKnownComponent(parent, request, memberName, false);
    } else {
        if (parent[memberName]) { // unmarked automatically if destroyed
            instantiator.clearComponent(parent, memberName);
        }
    }
    return innerRequest;
};

// Returns a function wrapping the supplied callback with the supplied request - the
// callback will be executed in an environment where the request has been restored
kettle.withRequest = function (request, callback) {
    return function wrappedCallback () {
        // Avoid double-wrapping the same stack, just as a courtesy for debugging and efficiency
        // To be compatible to both when.js < 2.0.0 and when >= 2.0.0 we must be prepared for superfluous wrapping sometimes
        // Although in theory this could be removed now that when.js is gone, there are still use cases where the user may supply, e.g.
        // synchronously resolving promises.
        if (request && fluid.isDestroyed(request)) {
            fluid.log("Failing to resume callback for request " + request.id + " which has already concluded");
            return;
        }
        var innerRequest = kettle.markActiveRequest(request);
        if (innerRequest) {
            return callback.apply(null, arguments);
        } else {
            try {
                return callback.apply(null, arguments);
            } catch (err) { // ensure we handle this before we lose marking
                fluid.onUncaughtException.fire(err);
            } finally {
                kettle.markActiveRequest(null);
            }
        }
    };
};

// Every genuinely asynchronous callback propagated by a Kettle app must be wrapped by this
// function - in order to propagate the "marker" which identifies the current request object.
kettle.wrapCallback = function (callback) {
    var request = kettle.getCurrentRequest();
    return kettle.withRequest(request, callback);
};

fluid.defaults("kettle.request", {
    gradeNames: ["fluid.component"],
    mergePolicy: {
        requestMiddleware: "noexpand"
    },
    invokers: {
        handleRequest: "fluid.notImplemented",
        handleFullRequest: "fluid.notImplemented"
    },
    events: {
        onHandle: null,  // Fired in order to execute its listener, handleRequest, which invokes the user's handler
        onSuccess: null, // A convenient proxy for the main request handler to report disposition (equivalent to handlerPromise)
        onError: null,  // A convenient proxy for the main request handler to report disposition (equivalent to handlerPromise)
        onRequestEnd: null,
        onRequestSuccess: null, // Overall disposition of the entire request - handler actually sends response
        onRequestError: null // Overall disposition of the entire request - handler actually sends response
    },
    // sourced from dynamic args
    req: "{arguments}.1",
    res: "{arguments}.2",
    next: "{arguments}.3",
    members: {
        req: "{that}.options.req", // TODO: can't supply these direct from args because of framework members merging bug - get array instead
        res: "{that}.options.res",
        next: "{that}.options.next",
        /* Construct a "promisified" proxy for the handling of this request. It will
         * have handlers registered which forward to this request's success and error events.
         * The promise may be rejected or resolved by the user to represent that disposition
         * for the overall request */
        handlerPromise: "@expand:fluid.promise()"
    },
    listeners: {
        "onCreate.activate": "kettle.request.activate",
        "onHandle.handleRequest": {
            funcName: "kettle.request.handleRequest",
            args: "{that}"
        },
        "onSuccess.forward": "kettle.request.forwardPromise(resolve, {that}.handlerPromise, {arguments}.0)",
        "onError.forward": "kettle.request.forwardPromise(reject, {that}.handlerPromise, {arguments}.0)"
    }
});

// A handler which reports a 404 if the request has not already been handled (e.g. by some middleware, e.g. static)
kettle.request.notFoundHandler = function (request) {
    if (!request.handlerPromise.disposition) {
        request.handlerPromise.reject({statusCode: 404, message: "Cannot " + request.req.method + " " + request.req.originalUrl});
    }
};

kettle.request.forwardPromise = function (method, promise, val) {
    if (!promise.disposition) {
        promise[method](val);
    } else {
        // Don't use fluid.fail here to avoid infinite triggering of errors
        fluid.log("Error in forwarding result ", val, " to promise " + method + ": promise has already received " + promise.disposition);
    }
};

kettle.request.activate = function (that) {
    that.req.fluidRequest = that;
    kettle.markActiveRequest(that);
};

kettle.request.clear = function () {
    kettle.markActiveRequest(null);
};

kettle.request.handleRequest = function (that) {
    try {
        that.handleRequest(that);
    } catch (err) {
        if (!that.handlerPromise.disposition) {
            that.handlerPromise.reject({message: err.message, stack: err.stack});
        }
    } finally {
        kettle.markActiveRequest(null);
    }
};

// A function representing the "handler executing task" of the request's sequence

kettle.request.handleRequestTask = function (request) {
    if (!request.res.finished) { // don't handle if some middleware has already sent a full response - makes us deterministic on node 4
        request.events.onHandle.fire(request); // our actual request handler triggerer
    }
    return request.handlerPromise;
};

fluid.defaults("kettle.request.mismatch", {
    requestMiddleware: {
        mismatch: {
            middleware: "{middlewareHolder}.mismatch",
            priority: "first"
        }
    }
});

fluid.defaults("kettle.request.http", {
    gradeNames: ["kettle.request"],
    invokers: {
        handleFullRequest: "kettle.request.http.handleFullRequest"
    },
    listeners: {
        "onCreate.ensureResponseDisposes": {
            funcName: "kettle.request.http.ensureResponseDisposes",
            priority: "before:handleRequest"
        },
        "onRequestError.handle": {
            funcName: "kettle.request.http.errorHandler",
            args: ["{that}.res", "{arguments}.0"]
        },
        "onRequestSuccess.handle": {
            funcName: "kettle.request.http.successHandler",
            args: ["{that}", "{arguments}.0"]
        }
    }
});


fluid.defaults("kettle.request.http.mismatch", {
    gradeNames: ["kettle.request.http", "kettle.request.mismatch"],
    invokers: {
        handleRequest: "fluid.identity"
    }
});

kettle.request.http.handleFullRequest = function (request, fullRequestPromise, next) {
    fullRequestPromise.then(function (response) {
        request.events.onRequestSuccess.fire(response);
        next();
    }, function (err) {
        request.events.onRequestError.fire(err);
        // A variant implementation could decide to call next(err) if we were interested in invoking express' upstream handler
        next();
    });
};

/**
 * Send an error payload to the client if the request ends in error
 * @param  {Object} res an Express response object.
 * @param  {Object} error an error payload. Should include fields <code>statusCode</code> holding a numeric HTTP status code, and <code>message</code> holding an error message.
 */
kettle.request.http.errorHandler = function (res, error) {
    var outError = fluid.extend(true, {
        isError: true,
        message: "Unknown error",
        statusCode: 500
    }, error);
    res.status(outError.statusCode).json(fluid.censorKeys(outError, ["statusCode"]));
    return outError;
};

/**
 * Send a successful payload to the client if the success event is fired.
 * @param  {Object} res an Express response object.
 * @param  {Object} response a success payload.
 */
kettle.request.http.successHandler = function (request, response) {
    if (request.req.method.toLowerCase() === "options") {
        request.res.status(200);
        return;
    }
    if (typeof(response) !== "string") {
        request.res.json(response);
    } else {
        request.res.status(200).send(response);
    }
};

/**
 * Ensure that the response is properly disposed of when finished.
 * @param {Object} that request object.
 */
kettle.request.http.ensureResponseDisposes = function (that) {
    // NOTE: This is here because any of these events can represent the
    // moment when the server is finished with the response.
    // TODO: We perhaps want to extend the possibility that further handlers may interpose 
    // AFTER the main "handler" - in which case this timing point just becomes a prerequisite for
    // disposal rather than the direct trigger
    fluid.each(["close", "finish", "end", "error"], function addListener(event) {
        that.res.on(event, function eventListener() {
            // TODO: need to write a test case to validate possibility that this request may be destroyed
            if (!fluid.isDestroyed(that)) {
                that.events.onRequestEnd.fire();
                that.destroy();
            }
        });
    });
};
