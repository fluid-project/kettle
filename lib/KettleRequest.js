/**
 * Kettle Requests
 *
 * Copyright 2012-2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = fluid || require("infusion"),
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

/** Request marking infrastructure.
 *  Why do we mark requests?
 *  This is for historical reasons that may well not be valid. The primary use case is allowing an asynchronous
 *  callback which throws an uncaught top-level exception to have the request on behalf of which it is executing
 *  closed down cleanly. This is implemented in the uncaught exception handler in KettleUtils.js .
 *  There were other use cases involving the ability to ubiquitously resolve IoC references {request} and
 *  {kettle.request} from anywhere within a Kettle application to the currently active request. These don't seem
 *  very compelling.
 *  A fresh incarnation of this problem emerges in the post FLUID-6148 Infusion which allows async I/O to occur
 *  during component startup. Given we can't defend against that problem by similar means, nor usefully democratise
 *  the callback wrapping scheme operated in this file, we should probably axe it and insist, as we now do in
 *  ResourceLoader, that all failures are propagated using promise rejections - the most effective means of this
 *  would probably to stick a universal "exception to rejection" converter within FluidPromises.js but we should
 *  review what other similar libraries do.
 *  This is actually a deep philosophical issue related to the notion of "execution location". It will be better
 *  handled once we have much more lightweight components, and can abolish invokers/events into a more harmonious
 *  incarnation of "spatialised execution" aka "gyres".
 *  This is the type of comment which most rapidly goes out of date, but it seemed better to write something rather
 *  than nothing.
 */

// The member name of the currently active request as held in Infusion's "resolve root" component
kettle.requestMemberName = fluid.typeNameToMemberName("kettle.request");

/** Return the active `kettle.request` which is marked to the current thread
 * @return {kettle.request} The current `kettle.request` component, or `undefined` if no Kettle request is active
 */
kettle.getCurrentRequest = function () {
    return fluid.resolveRootComponent[kettle.requestMemberName];
};

/** Marks the supplied request as active. This may cause a failure if a different request is marked as active, of if the
 * supplied request has already been destroyed.
 * @param {kettle.request} request - The request to be marked to the current thread
 * @return {kettle.request|Undefined} Any current request which was in progress - the only non-failure cases are where
 * this is same as the supplied request or undefined
 */
kettle.markActiveRequest = function (request) {
    var parent = fluid.resolveRootComponent,
        memberName = kettle.requestMemberName,
        instantiator = fluid.globalInstantiator,
        innerRequest = kettle.getCurrentRequest();
    if (request && innerRequest && innerRequest !== request) {
        fluid.fail("Error marking thread to request " + request.id + " - this thread is already marked to request " + innerRequest.id + " . Make sure to invoke this request asynchronously.");
    }
    if (request) {
        if (innerRequest !== request) {
            if (fluid.isDestroyed(request)) {
                fluid.log("Error marking thread to request " + request.id + " which has already been destroyed");
            } else {
                instantiator.recordKnownComponent(parent, request, memberName, false);
            }
        }
    } else {
        if (parent[memberName]) { // unmarked automatically if destroyed
            instantiator.clearComponent(parent, memberName);
        }
    }
    return innerRequest;
};

/** Returns a function wrapping the supplied callback with the supplied request - the
 * callback will be executed in an environment where the request marking has been restored.
 * @param {kettle.request} request - The Kettle request with which the supplied callback is to be contextualised
 * @param {Function} callback - A function with arbitrary signature which will be wrapped
 * @return {Function} A function with the same signature as that supplied, but which when invoked will be in an environment
 * where the supplied request is marked.
 */
kettle.withRequest = function (request, callback) {
    return function wrappedCallback() {
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

/** Every genuinely asynchronous callback propagated by a Kettle app must be wrapped by this
 * function - in order to propagate the "marker" which identifies the current request object.
 * @param {Function} callback - A function with arbitrary signature which will be wrapped
 * @return {Function} A function with the same signature as that supplied, but which when invoked will be in an environment
 * where whatever Kettle request is current at the time of the call to `kettle.wrapCallback` is marked.
 */
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
        // Overridden by every request implementor. Supplied with this {request} object, implements the body of request handling
        handleRequest: "fluid.notImplemented",
        // Has default implementation per request technology (HTTP, WS). Not intended to be overridden unless a special
        // interaction with the express infrastructure is required
        handleFullRequest: "fluid.notImplemented"
    },
    events: {
        onHandle: null,  // Fired in order to execute its listener, handleRequest, which invokes the user's handler
        onSuccess: null, // A convenient proxy for the main request handler to report disposition (equivalent to outerHandlerPromise)
        onError: null,  // A convenient proxy for the main request handler to report disposition (equivalent to outerHandlerPromise)
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
         * for the overall request.
         * handlerPromise is a legacy version of the proxy that is resolved directly with a
         *  response body, whereas the newer outerHandlerPromise expects an object
         * containing a responseBody value and an optional responseOptions value.
         * TODO: on next breaking framework update, remove the legacy handlerPromise.
         *  */
        handlerPromise: "@expand:fluid.promise()",
        legacyHandlerPromise: "{that}.handlerPromise",
        outerHandlerPromise: "@expand:fluid.promise()"
    },
    listeners: {
        "onCreate.activate": {
            funcName: "kettle.request.activate",
            priority: "first"
        },
        "onCreate.forwardOuterHandlerPromise": {
            funcName: "kettle.request.forwardOuterHandlerPromise",
            args: ["{that}.legacyHandlerPromise", "{that}.outerHandlerPromise"]
        },
        "onCreate.handle": {
            funcName: "kettle.request.initiateHandleRequest",
            args: ["{that}", "{kettle.server}.rootSequence"],
            priority: "last"
        },
        "onHandle.handleRequest": {
            funcName: "kettle.request.handleRequest",
            args: "{that}"
        },
        "onSuccess.forward": "kettle.request.forwardPromise(resolve, {that}.outerHandlerPromise,  {arguments}.0, {arguments}.1)",
        "onError.forward": "kettle.request.forwardPromise(reject, {that}.outerHandlerPromise, {arguments}.0)"
    }
});

// A handler which reports a 404 if the request has not already been handled (e.g. by some middleware, e.g. static)
kettle.request.notFoundHandler = function (request) {
    /* istanbul ignore else - much middleware is naughty and does not call "next" if it thinks it has fully handled the request */
    if (!request.outerHandlerPromise.disposition) {
        request.outerHandlerPromise.reject({statusCode: 404, message: "Cannot " + request.req.method + " " + request.req.originalUrl});
    }
};

/** A natty method to help ensuring that request resolutions expressed via events are in sync with those expressed via
 * promises. It invokes the supplied promise method with the supplied argument, only in the case the promise has not
 * already resolved. If the promise has been resolved, this represents a consistency problem, but one which cannot be
 * handled since there will be no active request by which to report it, so the failure will simply be logged.
 * @param {String} method - The promise method to be invoked
 * @param {Promise} promise - The promise on which the method is to be invoked
 * @param {Any} value - The payload to be sent to the method. A response body when method is "resolve" and an error payload when method is "reject"
 * @param {Any} [responseOptions] - Optional additional metadata for the response, e.g. statusCode. Is only supplied when method is "resolve".
 */
kettle.request.forwardPromise = function (method, promise, value, responseOptions) {
    if (!promise.disposition) {
        if (method === "resolve") {
            promise.resolve({
                responseBody: value,
                responseOptions: responseOptions
            });
        } else if (method === "reject") {
            promise.reject(value);
        }
    } else {
        // Don't use fluid.fail here to avoid infinite triggering of errors
        fluid.log("Error in forwarding result ", value, " to promise " + method + ": promise has already received " + promise.disposition);
    }
};

/** Activate a freshly created request, firstly by assigning it to the `fluidRequest` member of the native HTTP request,
 * and then by marking it to the current thread (see the head of this file for a discussion of request marking)
 * @param {kettle.request} that - The freshly created request to be activated
 */
kettle.request.activate = function (that) {
    that.req.fluidRequest = that;
    kettle.markActiveRequest(that);
};

/** On either successful or failed conclusion of the request, unmark it from the current thread
 */
kettle.request.clear = function () {
    kettle.markActiveRequest(null);
};

/**
 * Convert any resolutions of legacyHandlerPromise to resolutions of outerHandlerPromise.
 * @param {Promise} legacyHandlerPromise the legacy Promise proxy for the request, which is resolved with the responseBody as the only parameter
 * @param {Promise} outerHandlerPromise the newer Promise proxy, which accepts a an object that specifies both a responseBody and responseOptions
 */
kettle.request.forwardOuterHandlerPromise = function (legacyHandlerPromise, outerHandlerPromise) {
    legacyHandlerPromise.then(function (responseBody) {
        kettle.request.forwardPromise("resolve", outerHandlerPromise, responseBody);
    }, outerHandlerPromise.reject);
};

/** Kick off the user's `handleRequest' invoker, and convert any exception thrown from it into a rejection, unless
 * the request has already been handled through some other cause. Given the request is definitely handled by the end
 * of this invocation, finally, unmark the request as active
 * @param {kettle.request} that - The request for which `handleRequest` is to be invoked
 */
kettle.request.handleRequest = function (that) {
    try {
        that.handleRequest(that);
    } catch (err) {
        if (!that.outerHandlerPromise.disposition) {
            that.outerHandlerPromise.reject({message: err.message, stack: err.stack});
        }
    } finally {
        kettle.markActiveRequest(null);
    }
};

/** A function representing the "handler executing task" of the request's sequence. This is tacked on to the end of
 * any sequence of tasks derived by concatenating static and then request-specific middleware.
 * Its action consists simply of firing the request's `onHandle` event, to which one main listener takes the action of
 * invoking `kettle.request.handleRequest`
 * @param {kettle.request} request - The request for which the handling task is to be launched
 * @return {Promise} The disposition of the handler promise representing the disposition of the overall request
 */
kettle.request.handleRequestTask = function (request) {
    if (!request.res.finished) { // don't handle if some middleware has already sent a full response - makes us deterministic on node 4
        request.events.onHandle.fire(request); // our actual request handler triggerer
    }
    return request.outerHandlerPromise;
};

/**
 * The central currency of sequencing in Kettle request handling. This is a task-like structure which accepts a request
 * and returns a promise. Analogous to the `RequestListener` callback which is the common currency of the express-based
 * ecosystem.
 * @callback requestTask
 * @param {kettle.request} request - The request on which the task will act
 * @return {Promise} Resolves with success or rejects with failure based on whether control should pass to the next task or not.
 * For middleware, a resolution simply passes control to the next task, whereas for the main request task, this signals
 * disposition of the overall request.
 */

/** Given the full sequence of request handling tasks, construct a single promise which sequences them. The yielded
 * promise will only resolve if the request's `outerHandlerPromise` has resolved.
 * @param {requestTask[]} fullSequence - An array of request tasks to be sequenced.
 * @param {kettle.request} request - The request for which the sequence is being orchestrated
 * @return {Promise} A promise guiding the disposition of the overall request, which will be dispatched to
 * the request's `handleFullRequest` method.
 */
kettle.request.sequenceRequest = function (fullSequence, request) {
    var sequence = fluid.promise.sequence(fullSequence, request);
    var togo = fluid.promise();
    // FIXME: this is a very odd block of code. It looks like the below then is essentially a no-op
    //        it requires a closer look once we're into straight refactoring.
    //        This function is only called in kettle.request.initiateHandleRequest,
    //        so if it is really simpler than it is currently, it should probably just
    //        be inlined there.
    sequence.then(function () { // only the handler's promise return counts for success resolution
        fluid.promise.follow(request.outerHandlerPromise, togo);
    }, togo.reject);
    return togo;
};

/** Assemble the full request handling task from both static and request-specific middleware, suffixed by the request's
 * `handleRequest" method, and pass control to the request's `handleFullRequest` method which sequences them.
 * @param {kettle.request} request - The request whose handling is to be initiated. This is triggered as the last action
 * of the request's `onCreate' event.
 * @param {requestTask[]} rootSequence - Array of tasks representing the parent server's root middleware sequence which
 * precedes any bound to this request
*/
kettle.request.initiateHandleRequest = function (request, rootSequence) {
    fluid.log("Kettle server allocated request object with type ", request.typeName);
    var requestSequence = kettle.middleware.getHandlerSequence(request, "requestMiddleware");
    var fullSequence = rootSequence.concat(requestSequence).concat([kettle.request.handleRequestTask]);
    // FIXME: we *think* the below line could just be replaced with
    // var handleRequestPromise = fluid.promise.sequence(fullSequence, request);
    var handleRequestPromise = kettle.request.sequenceRequest(fullSequence, request);
    request.handleFullRequest(request, handleRequestPromise, request.next);
    handleRequestPromise.then(kettle.request.clear, kettle.request.clear);
};

// A special request type signifying that the actual request type mismatches the one specified in the routing
// description - this request will terminate in an error
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
            args: ["{that}", "{arguments}.0", "{arguments}.1"]
        }
    }
});


fluid.defaults("kettle.request.http.mismatch", {
    gradeNames: ["kettle.request.http", "kettle.request.mismatch"],
    invokers: {
        handleRequest: "fluid.identity"
    }
});

/** The HTTP variant of the `handleFullRequest` method. It gears the resolution or rejection of the "full request promise"
 * into a firing of either the `onRequestSuccess` or `onRequestError` events, followed by returning control to express or
 * other app container invoking the top-level `next` function.
 * @param {kettle.request} request - The Kettle request to be handled
 * @param {Promise} fullRequestPromise - The promise representing Kettle's complete chain of middleware tasks plus the
 * `handleRequest` task.
 * @param {Function} next - The `next` disposition function handed to us by the overall container, e.g. express
 */
kettle.request.http.handleFullRequest = function (request, fullRequestPromise, next) {
    fullRequestPromise.then(function (payload) {
        payload = payload || {};
        request.events.onRequestSuccess.fire(payload.responseBody, payload.responseOptions);
        next();
    }, function (err) {
        request.events.onRequestError.fire(err);
        // A variant implementation could decide to call next(err) if we were interested in invoking express' upstream handler
        next();
    });
};

/**
 * Send an error payload to the client if the request ends in error
 * @param {Object} res - An Express response object
 * @param {Object} error - An error payload. Should include fields <code>statusCode</code> holding a numeric HTTP status code, and <code>message</code> holding an error message
 * @return {Object} A full error object suitable for forming a promise rejection payload
 */
kettle.request.http.errorHandler = function (res, error) {
    var outError = fluid.extend(true, {
        isError: true,
        message: "Unknown error",
        statusCode: 500
    }, error);
    if (error.message) { // Error object's "message" property fails to clone regularly on node 4.x
        outError.message = error.message;
    }
    res.status(outError.statusCode).json(fluid.censorKeys(outError, ["statusCode"]));
    return outError;
};

/**
 * Send a successful payload to the client if the success event is fired
 * @param {Component} request - A kettle.request component
 * @param {Object} responseBody The payload of a success response
 * @param {Number} responseOptions Additional metadata for the response, e.g. statusCode
 */
kettle.request.http.successHandler = function (request, responseBody, responseOptions) {
    // Extract response options and apply them to the request
    // The default status code for a successful HTTP response is 200 OK
    var statusCode = responseOptions && responseOptions.statusCode || 200;
    request.res.status(statusCode);

    var headers = responseOptions && responseOptions.headers || {};
    for (var field in headers) {
        request.res.set(field, headers[field]);
    }

    if (request.req.method.toLowerCase() === "options") {
        request.res.end();
        return;
    }

    if (typeof(responseBody) !== "string") {
        request.res.json(responseBody);
    } else {
        request.res.send(responseBody);
    }
};

/**
 * Ensure that the response is properly disposed of when finished
 * @param {Component} that - The `kettle.request` component
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
