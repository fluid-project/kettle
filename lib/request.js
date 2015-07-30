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
        onNewRequest: null,
        onHandleRequest: null
    },
    listeners: {
        onHandleRequest: "{that}.handleRequest"
    },
    invokers: {
        onSuccessHandler: {
            funcName: "kettle.requests.eventHandler",
            args: ["onSuccess", "{arguments}"]
        },
        onErrorHandler: {
            funcName: "kettle.requests.eventHandler",
            args: ["onError", "{arguments}"]
        },
        handleRequest: {
            funcName: "kettle.requests.handleRequest",
            args: ["{arguments}.0", "{arguments}.1"]
        }
    },
    dynamicComponents: {
        request: {
            createOnEvent: "onNewRequest",
            type: "kettle.requests.request.http",
            options: {
                req: "{arguments}.0",
                res: "{arguments}.1",
                next: "{arguments}.2"
            }
        }
    },
    members: {
        middlewareListeners: {},
        middlewareEvents: {}
    }
});

fluid.defaults("kettle.requestProxy", {
    gradeNames: ["fluid.component"],
    events: {
        onError: null,
        onSuccess: null
    },
    listeners: {
        onError: "{kettle.requests}.onErrorHandler",
        onSuccess: "{kettle.requests}.onSuccessHandler"
    }
});

kettle.requests.handleRequest = function (request, context) {
    // TODO: As well as being completely cack-handed, this scheme supplies no useful diagnostics when the handler is not found
    request.handlerContext = fluid.model.composePath(
        "kettle.requests.request.handler", context);
    request.events.handle.fire();
};

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

/** Construct a "promisified" proxy for the handling of this request. It will
 * have handlers registered which forward to this requests success and error events.
 * The promise may be rejected or resolved by the user to represent that disposition
 * for the overall request
 */
kettle.requests.constructRequestPromise = function (request) {
    var togo = fluid.promise();
    togo.then(function (value) {
        request.events.onSuccess.fire(value);
    }, function (error) {
        request.events.onError.fire(error);
    });
    return togo;
};

fluid.defaults("kettle.requests.request", {
    gradeNames: ["fluid.component", "fluid.applyGradeLinkage"],
    invokers: {
        onErrorHandler: "kettle.requests.request.onErrorHandler",
        onSuccessHandler: "kettle.requests.request.onSuccessHandler",
        ensureResCompleted: {
            funcName: "kettle.requests.request.ensureResCompleted",
            args: "{that}"
        },
        attachFluidRequest: "kettle.requests.request.attachFluidRequest"
    },
    components: {
        handler: {
            type: "kettle.requests.request.handler",
            createOnEvent: "handle"
        }
    },
    events: {
        handle: null,
        onRequestEnd: null,
        onError: null,
        onSuccess: null
    },
    listeners: {
        onCreate: [
            "{that}.ensureResCompleted",
            "{that}.attachFluidRequest"
        ],
        onError: "{that}.onErrorHandler",
        onSuccess: "{that}.onSuccessHandler"
    }
});

fluid.defaults("kettle.requests.request.http", {
    gradeNames: ["kettle.requests.request", "{requests}.eventedRequestGrade"],
    mergePolicy: {
        "req": "nomerge",
        "res": "nomerge",
        "next": "nomerge"
    },
    members: {
        req: "{that}.options.req",
        res: "{that}.options.res",
        next: "{that}.options.next",
        requestPromise: "@expand:kettle.requests.constructRequestPromise({that})"
    },
    invokers: {
        onErrorHandler: {
            funcName: "kettle.requests.request.http.onErrorHandler",
            args: ["{that}.res", "{arguments}.0"]
        },
        onSuccessHandler: {
            funcName: "kettle.requests.request.http.onSuccessHandler",
            args: ["{that}.res", "{arguments}.0"]
        },
        ensureResCompleted: {
            funcName: "kettle.requests.request.http.ensureResCompleted"
        },
        // Adding a request object to express's req.
        attachFluidRequest: {
            funcName: "fluid.set",
            args: ["{that}.req", "fluidRequest", "{that}"]
        },
        proceed: {
            funcName: "kettle.requests.request.http.proceed",
            args: "{that}.next"
        }
    },
    listeners: {
        onAttach: "{that}.proceed"
    }
});

/**
 * Continue resolving current request.
 * @param  {Function} next proceeds to the next step of request resolution.
 */
kettle.requests.request.http.proceed = function (next) {
    next();
};

/**
 * Ensure that the response is properly disposed of when finished.
 * @param  {Object} that request object.
 */
kettle.requests.request.http.ensureResCompleted = function (that) {
    // NOTE: This is here because any of these events can represent the
    // moment when the server is finished with the response.
    fluid.each(["close", "finish", "end", "error"], function addListener(event) {
        that.res.on(event, function eventListener() {
            that.events.onRequestEnd.fire();
            that.destroy();
        });
    });
};

/**
 * Send an error payload to the client if the error event is fired.
 * @param  {Object} res a response object.
 * @param  {Object}   error an error payload.
 */
kettle.requests.request.http.onErrorHandler = function (res, error) {
    var outError = $.extend(true, {
        isError: true,
        message: "Unknown error",
        statusCode: 500
    }, error);
    res.send(outError, outError.statusCode);
};

/**
 * Send a successful payload to the client if the success event is fired.
 * @param  {Object} res a response object.
 * @param  {Object} response a success payload.
 */
kettle.requests.request.http.onSuccessHandler = function (res, response) {
    if (typeof(response) !== "string") {
        res.json(response);
    } else {
        res.send(response, 200);
    }
};
// ***TODO*** HEART OF DARKNESS! both withEnvironment and applyGradeLinkage
fluid.defaults("kettle.requests.request.handler", {
    gradeNames: ["fluid.component", "{request}.handlerContext", "fluid.applyGradeLinkage"],
    invokers: {
        // NB - this is a nonexistent function - this entire block is expected to
        // be overridden by a relevant grade.
        handle: "kettle.requests.request.handler.handle"
    },
    listeners: {
        onAttach: {
            listener: "fluid.withEnvironment",
            args: [{
                request: "{request}"
            }, "{that}.handle"]
        }
    }
});

