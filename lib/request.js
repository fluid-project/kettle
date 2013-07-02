/*!
Kettle Requests.

Copyright 2012 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
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
            registerMiddleware: null
        },
        listeners: {
            registerMiddleware: "{that}.registerMiddleware"
        },
        components: {},
        invokers: {
            registerMiddleware: {
                funcName: "kettle.requests.registerMiddleware",
                args: ["{that}.middleware", "{arguments}.0"]
            },
            registerListeners: {
                funcName: "kettle.requests.registerListeners",
                args: "{that}.middleware"
            },
            registerEvents: {
                funcName: "kettle.requests.registerEvents",
                args: "{that}.middleware"
            },
            onSuccessHandler: {
                funcName: "kettle.requests.eventHandler",
                args: ["onSuccess", "{arguments}"]
            },
            onErrorHandler: {
                funcName: "kettle.requests.eventHandler",
                args: ["onError", "{arguments}"]
            },
            create: {
                funcName: "kettle.requests.create",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
            }
        },
        members: {
            middleware: {}
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

    /**
     * Register a new middleware.
     * @param  {JSON} middleware a map of middleware objects.
     * @param  {Object} middlewareObject a new middleware to be
     * registered.
     */
    kettle.requests.registerMiddleware = function registerMiddleware(middleware, middlewareObject) {
        var eventName = middlewareObject.resolveEventName();
        middleware[eventName] = middlewareObject;
    };

    /**
     * Register middleware as listeners for the incoming requests.
     * @param  {Object} middleware a middleware object.
     */
    kettle.requests.registerListeners = function registerListeners(middleware) {
        return fluid.transform(middleware, function getHandle(middlewareObject) {
            return middlewareObject.handle;
        });
    };

    /**
     * Register an event for each middleware object.
     * @param  {Object} middleware a middleware object.
     */
    kettle.requests.registerEvents = function registerEvents(middleware) {
        return fluid.transform(middleware, function getEventType() {
            return null;
        });
    };

    /**
     * Fire an onSuccess or onError event for a particular request object.
     * @param  {String} eventName a name of the event. Can be onSuccess or
     * onError.
     * @param  {Array} args an arbitrary arguments for the event firer.
     */
    kettle.requests.eventHandler = function eventHandler(eventName, args) {
        var request = fluid.expand("{request}", {
            fetcher: fluid.makeEnvironmentFetcher()
        });
        request.events[eventName].fire.apply(null, args);
    };

    /**
     * Create a lifecycle object that will serve as a context
     * for a current request/response sequence.
     *
     * @return {undefined}
     */
    kettle.requests.create = function create(that, req, res, next) {
        var name = uuid.v4();
        that.options.components[name] = {
            type: "kettle.requests.request",
            options: {
                members: {
                    req: req,
                    res: res,
                    next: next
                },
                events: that.registerEvents(),
                listeners: that.registerListeners()
            }
        };
        fluid.initDependent(that, name);
        var request = that[name];
        // NOTE: This is here because any of these events can represent the
        // moment when the server is finished with the response.
        fluid.each(["close", "finish", "end", "error"], function addListener(
            event) {
            res.on(event, function eventListener() {
                if (that[name]) {
                    request.events.onRequestEnd.fire();
                    var instantiator = fluid.getInstantiator(that);
                    instantiator.clearComponent(that, name);
                }
            });
        });

        // Adding a request object to express's req.
        req.fluidRequest = request;
        next();
    };

    fluid.defaults("kettle.requests.request", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        mergePolicy: {
            "members.req": "noexpand, nomerge",
            "members.res": "noexpand, nomerge",
            "members.next": "noexpand, nomerge"
        },
        invokers: {
            onErrorHandler: {
                funcName: "kettle.requests.request.onErrorHandler",
                args: ["{that}.res", "{arguments}.0"]
            },
            onSuccessHandler: {
                funcName: "kettle.requests.request.onSuccessHandler",
                args: ["{that}.res", "{arguments}.0"]
            }
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
            onError: "{that}.onErrorHandler",
            onSuccess: "{that}.onSuccessHandler"
        }
    });

    /**
     * Send an error payload to the client if the error event is fired.
     * @param  {Object} res a response object.
     * @param  {Object} error an error payload.
     */
    kettle.requests.request.onErrorHandler = function onErrorHandler(res, error) {
        if (!error) {
            res.send({
                isError: true,
                message: "Unknown error"
            }, 500);
            return;
        }
        res.send(error, 500);
    };

    /**
     * Send a successful payload to the client if the success event is fired.
     * @param  {Object} res a response object.
     * @param  {Object} response a success payload.
     */
    kettle.requests.request.onSuccessHandler = function onSuccessHandler(res, response) {
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
        gradeNames: ["kettle.requests.request.deferred", "autoInit"],
        invokers: {
            handle: {
                // NB - this is a nonexistent function - this entire block is expected to
                // be overridden by a relevant demands block
                funcName: "kettle.requests.request.handler.handle"
            },
            handleRequest: {
                funcName: "fluid.withEnvironment",
                args: [{
                    request: "{request}"
                }, "{that}.handle"]
            }
        },
        listeners: {
            onAttach: "{that}.handleRequest"
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

    kettle.wrapCallback = function wrapCallback(callback) {
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
