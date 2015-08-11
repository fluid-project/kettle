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
    $ = fluid.registerNamespace("jQuery"),
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
            options: {
                gradeNames: "{arguments}.0.options.gradeNames"
            }
        }
    }
});

/**
 * Fire an onSuccess or onError event for a particular request object.
 * @param  {String} eventName a name of the event. Can be onSuccess or
 * onError.
 * @param  {Array} args an arbitrary arguments for the event firer.
 */
kettle.requests.eventHandler = function (eventName, args) {
    var request = kettle.getCurrentRequest();
    request.events[eventName].fire.apply(null, args);
};

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
        var innerRequest = kettle.markActiveRequest(request);
        if (innerRequest) {
            return callback.apply(null, arguments);
        } else {
            try {
                return callback.apply(null, arguments);
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
    invokers: {
        handleRequest: "fluid.notImplemented"
    },
    events: {
        onHandle: null,
        onRequestEnd: null,
        onError: null,
        onSuccess: null
    },
    // sourced from dynamic args
    req: "{arguments}.1",
    res: "{arguments}.2",
    next: "{arguments}.3",
    members: {
        req: "{that}.options.req", // TODO: can't supply these direct from args because of framework members merging bug - get array instead
        res: "{that}.options.res",
        next: "{that}.options.next",
        requestPromise: "@expand:kettle.request.constructRequestPromise({that})"
    },
    listeners: {
        "onCreate.activate": "kettle.request.activate",
        "onHandle.handleRequest": {
            funcName: "kettle.request.handleRequest",
            args: "{that}"
        },
        "onError.handle": {
            funcName: "fluid.notImplemented"
        },
        "onSuccess.handle": {
            funcName: "fluid.notImplemented"
        }
    }
});

kettle.request.activate = function (that) {
    that.req.fluidRequest = that;
    kettle.markActiveRequest(that);
};

kettle.request.handleRequest = function (that) {
    try {
        that.handleRequest(that);
    } finally {
        kettle.markActiveRequest(null);
    }
};

/** Construct a "promisified" proxy for the handling of this request. It will
 * have handlers registered which forward to this requests success and error events.
 * The promise may be rejected or resolved by the user to represent that disposition
 * for the overall request
 */
kettle.request.constructRequestPromise = function (request) {
    var togo = fluid.promise();
    togo.then(function (value) {
        request.events.onSuccess.fire(value);
    }, function (error) {
        request.events.onError.fire(error);
    });
    return togo;
};

fluid.defaults("kettle.request.http", {
    gradeNames: ["kettle.request"],
    listeners: {
        "onCreate.ensureResponseDisposes": {
            funcName: "kettle.request.http.ensureResponseDisposes",
            priority: "before:handleRequest"
        }, 
        "onError.handle": {
            funcName: "kettle.request.http.errorHandler",
            args: ["{that}.res", "{arguments}.0"]
        },
        "onSuccess.handle": {
            funcName: "kettle.request.http.successHandler",
            args: ["{that}.res", "{arguments}.0"]
        },
        "onHandle.proceed": {
            funcName: "kettle.request.http.proceed",
            args: "{that}.next",
            priority: "after:handleRequest"        
        }
    }
});

/**
 * Send an error payload to the client if the error event is fired.
 * @param  {Object} res an Express response object.
 * @param  {Object} error an error payload. Should include fields <code>statusCode</code> holding a numeric HTTP status code, and <code>message</code> holding an error message.
 */
kettle.request.http.errorHandler = function (res, error) {
    var outError = $.extend(true, {
        isError: true,
        message: "Unknown error",
        statusCode: 500
    }, error);
    res.send(outError, outError.statusCode);
};

/**
 * Send a successful payload to the client if the success event is fired.
 * @param  {Object} res an Express response object.
 * @param  {Object} response a success payload.
 */
kettle.request.http.successHandler = function (res, response) {
    console.log("KETTLE REQUEST SUCCESS SENDING " + response);
    if (typeof(response) !== "string") {
        res.json(response);
    } else {
        res.status(200).send(response);
    }
};

/**
 * Continue resolving current request
 * @param {Function} next proceeds to the next step of request resolution.
 */
kettle.request.http.proceed = function (next) {
    console.log("KETTLE PROCEED");
    next();
};

/**
 * Ensure that the response is properly disposed of when finished.
 * @param  {Object} that request object.
 */
kettle.request.http.ensureResponseDisposes = function (that) {
    // NOTE: This is here because any of these events can represent the
    // moment when the server is finished with the response.
    fluid.each(["close", "finish", "end", "error"], function addListener(event) {
        that.res.on(event, function eventListener() {
            that.events.onRequestEnd.fire();
            that.destroy();
        });
    });
};
