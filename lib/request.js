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

    fluid.defaults("gpii.requestProxy", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        events: {
            onError: null,
            onSuccess: null
        },
        listeners: {
            onError: "{gpii.requests}.onErrorHandler",
            onSuccess: "{gpii.requests}.onSuccessHandler"
        }
    });

    kettle.requests.registerMiddleware = function registerMiddleware (middleware, middlewareObject) {
        var eventName = middlewareObject.resolveEventName();
        middleware[eventName] = middlewareObject;
    };

    kettle.requests.registerListeners = function registerListeners (middleware) {
        return fluid.transform(middleware, function (middlewareObject) {
            return middlewareObject.handle;
        });
    };

    kettle.requests.registerEvents = function registerEvents (middleware) {
        return fluid.transform(middleware, function () {
            return null;
        });
    };

    kettle.requests.eventHandler = function eventHandler (eventName, args) {
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
    kettle.requests.create = function create (that, req, res, next) {
        var name = uuid.v4();
        that.options.components[name] = {
            type: "gpii.requests.request",
            options: {
                req: req,
                res: res,
                next: next,
                events: that.registerEvents(),
                listeners: that.registerListeners()
            }
        };
        fluid.initDependent(that, name);
        var request = that[name];
        // NOTE: This is here because any of these events can represent the moment
        // when the server is finished with the response.
        fluid.each(["close", "finish", "end", "error"], function (event) {
            res.on(event, function () {
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

    fluid.defaults("gpii.requests.request", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        mergePolicy: {
            req: "noexpand, nomerge",
            res: "noexpand, nomerge",
            next: "noexpand, nomerge"
        },
        components: {
            handler: {
                type: "gpii.requests.request.handler",
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
            onError: "{gpii.requests.request}.onErrorHandler",
            onSuccess: "{gpii.requests.request}.onSuccessHandler"
        },
        preInitFunction: "gpii.requests.request.preInit"
    });

    gpii.requests.request.preInit = function (that) {
        fluid.each(["req", "res", "next"], function (obj) {
            that[obj] = that.options[obj];
        });

        that.onErrorHandler = function (error) {
            var res = that.res;
            if (!error) {
                res.send({
                    isError: true,
                    message: "Unknown error"
                }, 500);
                return;
            }
            res.send(error, 500);
        };

        that.onSuccessHandler = function (response) {
            that.res.send(response, 200);
        };
    };

    fluid.defaults("gpii.requests.request.deferred", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        invokers: {
            when: "gpii.requests.request.deferred.when"
        }
    });

    fluid.demands("gpii.requests.request.deferred.when", "gpii.requests.request.handler", {
        args: ["{requestProxy}", "{arguments}.0", "{arguments}.1"]
    });

    gpii.requests.request.deferred.when = function (evented, promiseOrValue, callback) {
        return when(promiseOrValue, function (resolved) {
            evented.events.onSuccess.fire(callback ? callback(resolved) : resolved);
        }, function (error) {
            evented.events.onError.fire(error);
        });
    };

    fluid.defaults("gpii.requests.request.handler", {
        gradeNames: ["gpii.requests.request.deferred", "autoInit"],
        invokers: {
            handle: {
                // NB - this is a nonexistent function - this entire block is expected to
                // be overridden by a relevant demands block
                funcName: "gpii.requests.request.handler.handle"
            }
        },
        listeners: {
            onAttach: "{that}.handleRequest"
        },
        components: {
            request: "{request}"
        },
        preInitFunction: "gpii.requests.request.handler.preInit"
    });

    gpii.requests.request.handler.preInit = function (that) {
        that.handleRequest = function () {
            fluid.withEnvironment({
                request: that.request
            }, that.handle);
        };
    };

    fluid.defaults("gpii.requestContextCallbackWrapper", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        invokers: {
            wrap: "gpii.requestContextCallbackWrapper.wrap"
        }
    });

    fluid.demands("gpii.requestContextCallbackWrapper.wrap", "gpii.requestContextCallbackWrapper", {
        funcName: "gpii.wrapCallback",
        args: ["{arguments}.0", "{arguments}.1"]
    });

    gpii.wrapCallback = function (callback) {
        var request = fluid.expand("{request}", {
            fetcher: fluid.makeEnvironmentFetcher()
        });
        return function () {
            var args = arguments;
            return fluid.withEnvironment({
                request: request
            }, function () {
                return callback.apply(null, args);
            });
        };
    };

})();