/**
 * Kettle Requests.
 *
 * Copyright 2012-2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/kettle/LICENSE.txt
 */

(function () {

    "use strict";

    var fluid = require("infusion"),
        uuid = require("node-uuid"),
        when = require("when"),
        kettle = fluid.registerNamespace("kettle");

    fluid.defaults("kettle.requests", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
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
        gradeNames: ["autoInit", "fluid.eventedComponent"],
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
        var request = fluid.expand("{request}", {
            fetcher: fluid.makeEnvironmentFetcher()
        });
        request.events[eventName].fire.apply(null, args);
    };

    fluid.defaults("kettle.requests.request", {
        gradeNames: ["autoInit", "fluid.eventedComponent", "fluid.applyGradeLinkage"],
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
        mergePolicy: {
            "req": "nomerge",
            "res": "nomerge",
            "next": "nomerge"
        },
        members: {
            req: "{that}.options.req",
            res: "{that}.options.res",
            next: "{that}.options.next"
        },
        gradeNames: ["autoInit", "kettle.requests.request",
            "{requests}.eventedRequestGrade"],
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
        error = error || {
            isError: true,
            message: "Unknown error"
        };
        res.send(error, 500);
    };

    /**
     * Send a successful payload to the client if the success event is fired.
     * @param  {Object} res a response object.
     * @param  {Object} response a success payload.
     */
    kettle.requests.request.http.onSuccessHandler = function (res, response) {
        res.send(response, 200);
    };

    fluid.defaults("kettle.requests.request.deferred", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        invokers: {
            when: {
                funcName: "kettle.requests.request.deferred.when",
                args: ["{requestProxy}", "{arguments}.0", "{arguments}.1"]
            }
        }
    });

    /**
     * Wrap an asynchronous request handling into a promise.
     * @param  {Object} evented a request proxy.
     * @param  {value} promiseOrValue a value that is either already resolved
     * or is potentially resolved via an asynchronous operation.
     * @param  {Function} callback an optional callback that is fired if promise
     * is resolved successfully.
     */
    kettle.requests.request.deferred.when = function (evented, promiseOrValue, callback) {
        return when(promiseOrValue, function onSuccess(resolved) {
            evented.events.onSuccess.fire(callback ?
                callback(resolved) : resolved);
        }, function onError(error) {
            evented.events.onError.fire(error);
        });
    };

    fluid.defaults("kettle.requests.request.handler", {
        gradeNames: ["kettle.requests.request.deferred", "autoInit",
            "{request}.handlerContext", "fluid.applyGradeLinkage"],
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

    fluid.defaults("kettle.requestContextCallbackWrapper", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        invokers: {
            wrap: {
                funcName: "kettle.wrapCallback",
                args: ["{arguments}.0", "{arguments}.1"]
            }
        }
    });

    kettle.wrapCallback = function (callback) {
        var request = fluid.expand("{request}", {
            fetcher: fluid.makeEnvironmentFetcher()
        });
        return function wrappedCallback() {
            var args = arguments;
            return fluid.withEnvironment({
                request: request
            }, function applyCallback() {
                return callback.apply(null, args);
            });
        };
    };

})();
