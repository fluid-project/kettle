/*!
Kettle Requests.

Copyright 2012-2013 OCAD University

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

    fluid.defaults("kettle.requests.http", {
        gradeNames: ["autoInit", "kettle.requests"]
    });

    fluid.defaults("kettle.requests.io", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        invokers: {
            onSuccessHandler: {
                funcName: "kettle.requests.io.eventHandler",
                args: ["{that}", "onSuccess", "{arguments}"]
            },
            onErrorHandler: {
                funcName: "kettle.requests.io.eventHandler",
                args: ["{that}", "onError", "{arguments}"]
            },
            createIO: {
                funcName: "kettle.requests.io.create",
                args: ["{that}", "{arguments}.0"]
            }
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
    kettle.requests.registerMiddleware = function (middleware, middlewareObject) {
        var eventName = middlewareObject.resolveEventName();
        middleware[eventName] = middlewareObject;
    };

    /**
     * Register middleware as listeners for the incoming requests.
     * @param  {Object} middleware a middleware object.
     */
    kettle.requests.registerListeners = function (middleware) {
        return fluid.transform(middleware, function getHandle(middlewareObject) {
            return middlewareObject.handle;
        });
    };

    /**
     * Register an event for each middleware object.
     * @param  {Object} middleware a middleware object.
     */
    kettle.requests.registerEvents = function (middleware) {
        return fluid.transform(middleware, function getEventType() {
            return null;
        });
    };

    /**
     * Fire an onSuccess or onError event for a particular request object.
     * @param  {String} eventName a name of the event. Can be onSuccess or
     * onError.
     * @param  {Array} args an arbitrary arguments for the event firer.
     * @return {Object} request object.
     */
    kettle.requests.eventHandler = function (eventName, args) {
        var request = fluid.expand("{request}", {
            fetcher: fluid.makeEnvironmentFetcher()
        });
        request.events[eventName].fire.apply(null, args);
        return request;
    };

    /**
     * Fire an onSuccess or onError event for a particular request object.
     * @param  {Object} that      request object
     * @param  {String} eventName a name of the event. Can be onSuccess or
     * onError.
     * @param  {Array} args an arbitrary arguments for the event firer.
     */
    kettle.requests.io.eventHandler = function (that, eventName, args) {
        var request = kettle.requests.eventHandler(eventName, args);
        request.events.onRequestEnd.fire();
        var instantiator = fluid.getInstantiator(that);
        instantiator.clearComponent(that, name);
    };

    /**
     * Create a lifecycle object that will serve as a context
     * for a current request/response sequence.
     *
     * @return {undefined}
     */
    kettle.requests.create = function (that, req, res, next) {
        var name = uuid.v4();
        that.options.components[name] = {
            type: "kettle.requests.request",
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

    kettle.requests.io.create = function (that, socket) {
        var name = uuid.v4();
        that.options.components[name] = {
            type: "kettle.requests.request",
            options: {
                socket: socket
            }
        };
        fluid.initDependent(that, name);
        var request = that[name];

        socket.on("disconnect", function () {
            if (that[name]) {
                request.events.onRequestEnd.fire();
                var instantiator = fluid.getInstantiator(that);
                instantiator.clearComponent(that, name);
            }
        });

        // Adding a request object to socket.io's socket.
        socket.fluidRequest = request;
    };

    fluid.defaults("kettle.requests.request", {
        gradeNames: ["autoInit", "fluid.eventedComponent", "{that}.getRequestGrade"],
        mergePolicy: {
            "socket": "noexpand, nomerge",
            "req": "noexpand, nomerge",
            "res": "noexpand, nomerge",
            "next": "noexpand, nomerge"
        },
        members: {
            socket: "{that}.options.socket",
            req: "{that}.options.req",
            res: "{that}.options.res",
            next: "{that}.options.next"
        },
        invokers: {
            onErrorHandler: "kettle.requests.request.onErrorHandler",
            onSuccessHandler: "kettle.requests.request.onSuccessHandler",
            getRequestGrade: {
                funcName: "kettle.requests.request.getRequestGrade",
                args: "{kettle.requests}.typeName"
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

    kettle.requests.request.getRequestGrade = function (typeName) {
        return fluid.model.composeSegments(typeName, "request");
    };

    fluid.defaults("kettle.requests.io.request", {
        gradeNames: ["autoInit", "kettle.requests.request"],
        invokers: {
            onErrorHandler: {
                funcName: "kettle.requests.io.request.onErrorHandler",
                args: ["{that}.send", "{arguments}.0"]
            },
            onSuccessHandler: {
                funcName: "kettle.requests.io.request.onSuccessHandler",
                args: ["{that}.send", "{arguments}.0"]
            }
        }
    });

    fluid.defaults("kettle.requests.http.request", {
        gradeNames: ["autoInit", "kettle.requests.request"],
        invokers: {
            onErrorHandler: {
                funcName: "kettle.requests.http.request.onErrorHandler",
                args: ["{that}.res", "{arguments}.0"]
            },
            onSuccessHandler: {
                funcName: "kettle.requests.http.request.onSuccessHandler",
                args: ["{that}.res", "{arguments}.0"]
            }
        }
    });

    /**
     * Send an error payload to the client if the error event is fired.
     * @param  {Object} res a response object.
     * @param  {Object}   error an error payload.
     */
    kettle.requests.http.request.onErrorHandler = function (res, error) {
        error = error || {
            isError: true,
            message: "Unknown error"
        };
        res.send(error, 500);
    };

    /**
     * Send an error message to the client if the error event is fired.
     * @param  {Function} send a response.send function.
     * @param  {Object}   response an error message.
     */
    kettle.requests.io.request.onErrorHandler = function (send, error) {
        error = error || {
            isError: true,
            message: "Unknown error"
        };
        send(error);
    };

    /**
     * Send a successful payload to the client if the success event is fired.
     * @param  {Object} res a response object.
     * @param  {Object}   response a success payload.
     */
    kettle.requests.http.request.onSuccessHandler = function (res, response) {
        res.send(response, 200);
    };

    /**
     * Send a successful message to the client if the success event is fired.
     * @param  {Function} send a response.send function.
     * @param  {Object}   response a success message.
     */
    kettle.requests.io.request.onSuccessHandler = function (send, response) {
        send(response);
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
        gradeNames: ["kettle.requests.request.deferred", "autoInit", "{request}.handlerContext"],
        invokers: {
            // NB - this is a nonexistent function - this entire block is expected to
            // be overridden by a relevant grade.
            handle: "kettle.requests.request.handler.handle",
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
