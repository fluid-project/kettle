/*!
Kettle Infusion/Express Middleware

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        express = require("express"),
        kettle = fluid.registerNamespace("kettle");

    fluid.defaults("kettle.middleware", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        listeners: {
            onCreate: [
                "{that}.register",
                "{that}.apply"
            ]
        },
        eventName: {
            expander: {
                func: "kettle.middleware.resolveEventName",
                args: "{that}.typeName"
            }
        },
        invokers: {
            handle: {
                funcName: "kettle.middleware.handle",
                args: "{arguments}.0"
            },
            apply: {
                funcName: "kettle.middleware.apply",
                args: ["{kettle.server}.server", "{that}.options.eventName"]
            },
            register: {
                funcName: "kettle.middleware.register",
                args: [
                    "{requests}",
                    "{that}.options.eventName",
                    "{that}.handle"
                ]
            }
        },
    });

    /**
     * Register a middleware wrapper.
     * @param  {Object} server an express server.
     * @param  {String} eventName event name.
     */
    kettle.middleware.apply = function (server, eventName) {
        server.use(function (req, res, next) {
            req.fluidRequest.events[eventName].fire(req.fluidRequest);
        });
    };

    /**
     * Register a new middleware.
     * @param  {JSON} middleware a map of middleware objects from requests
     * component.
     * @param  {String} eventName event name.
     * @param {Function} handle middleware's handle function.
     */
    kettle.middleware.register = function (requests, eventName, handle) {
        requests.middlewareListeners[eventName] = handle;
        requests.middlewareEvents[eventName] = null;
    };

    /**
     * Event name builder.
     * @param  {String} typeName middle ware type name.
     * @return {String} sensible event name based on the middleware type name.
     */
    kettle.middleware.resolveEventName = function (typeName) {
        var eventName = fluid.computeNickName(typeName);
        return "on" + eventName.charAt(0).toUpperCase() + eventName.slice(1);
    };

    fluid.defaults("kettle.middleware.bodyParser", {
        gradeNames: ["kettle.middleware", "autoInit"],
        members: {
            parser: {
                expander: {
                    func: "kettle.middleware.bodyParser.makeParser"
                }
            }
        },
        invokers: {
            handle: {
                funcName: "kettle.middleware.bodyParserHandle",
                args: ["{that}.parser", "{arguments}.0"]
            }
        }
    });

    /**
     * Create an express body parser middleware.
     * @return {Object} express body parser.
     */
    kettle.middleware.bodyParser.makeParser = function () {
        return express.bodyParser();
    };

    /**
     * A wrapper around express' body parser middleware.
     * @param {Object} parser a body parser.
     * @param {Object} request a request object.
     */
    kettle.middleware.bodyParserHandle = function (parser, request) {
        parser(request.req, request.res, request.next);
    };

    fluid.defaults("kettle.use.bodyParser", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        components: {
            bodyParser: {
                type: "kettle.middleware.bodyParser"
            }
        }
    });

    fluid.defaults("kettle.middleware.CORS", {
        gradeNames: ["kettle.middleware", "autoInit"],
        allowMethods: "GET",
        invokers: {
            handle: {
                funcName: "kettle.middleware.CORSHandle",
                args: ["{arguments}.0", "{that}.options.allowMethods"]
            }
        }
    });

    /**
     * A middleware responsible for enabling CORS within the kettle server.
     * @param {Object} request a request object.
     * @param {String|Array} allowMethods methods that are enabled with CORS.
     */
    kettle.middleware.CORSHandle = function (request, allowMethods) {
        var res = request.res;
        // Handle a preflight OPTIONS request as well.
        allowMethods = fluid.makeArray(allowMethods).concat(["OPTIONS"]);

        // Add CORS response headers.
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", allowMethods.join(","));
        res.header("Access-Control-Allow-Headers", "X-Requested-With,Content-Type");

        if (request.req.method === "OPTIONS") {
            // Handle OPTIONS request.
            res.send(204);
        } else {
            request.next();
        }
    };

    fluid.defaults("kettle.use.CORS", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        components: {
            CORS: {
                type: "kettle.middleware.CORS"
            }
        }
    });

    fluid.defaults("kettle.middleware.cookieParser", {
        gradeNames: ["kettle.middleware", "autoInit"],
        members: {
            parser: {
                expander: {
                    func: "kettle.middleware.cookieParser.makeParser",
                    args: "{sessionManager}.options.secret"
                }
            }
        },
        invokers: {
            handle: {
                funcName: "kettle.middleware.cookieParserHandle",
                args: ["{that}.parser", "{arguments}.0"]
            }
        }
    });

    /**
     * Create a connect cookie parser middleware.
     * @return {Object} express cookie parser.
     */
    kettle.middleware.cookieParser.makeParser = function (secret) {
        return kettle.utils.cookieParser(secret);
    };

    /**
     * A wrapper around connect's cookie parser middleware.
     * @param {Object} parser a cookie parser.
     * @param {Object} request a request object.
     */
    kettle.middleware.cookieParserHandle = function (parser, request) {
        parser(request.req, request.res, request.next);
    };

    fluid.defaults("kettle.use.cookieParser", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        components: {
            cookieParser: {
                type: "kettle.middleware.cookieParser"
            }
        }
    });

    fluid.defaults("kettle.middleware.sessionValidator", {
        gradeNames: ["kettle.middleware", "autoInit"],
        events: {
            onSessionValidate: "preventable",
            onSessionDestroy: null
        },
        listeners: {
            onSessionValidate: "{sessionManager}.validate",
            onSessionDestroy: "{sessionManager}.invalidate"
        },
        invokers: {
            handle: {
                funcName: "kettle.middleware.sessionValidatorHandle",
                args: [
                    "{that}.events.onSessionValidate",
                    "{that}.events.onSessionDestroy",
                    "{arguments}.0"
                ]
            }
        }
    });

    /**
     * Validate the request's session.
     * @param  {Object} onSessionValidate event fired to initiate validation.
     * @param  {Object} onSessionDestroy event fired when session needs to be
     * invalidated.
     * @param  {Object} request fluid request object.
     */
    kettle.middleware.sessionValidatorHandle = function (onSessionValidate, onSessionDestroy, request) {
        // If session needs to be valid and validate it.
        if (request.needValidSession &&
            onSessionValidate.fire(request) === false) {
            // If the session is invalid, destroy it and clear cookies.
            request.req.session.destroy(function () {
                onSessionDestroy.fire(request);
            });
        } else {
            request.next();
        }
    };

    fluid.defaults("kettle.use.sessionValidator", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        components: {
            sessionValidator: {
                type: "kettle.middleware.sessionValidator"
            }
        }
    });

    fluid.defaults("kettle.middleware.session", {
        gradeNames: ["kettle.middleware", "autoInit"],
        members: {
            session: {
                expander: {
                    func: "kettle.middleware.session.makeSession",
                    args: [
                        "{sessionManager}.options.key",
                        "{sessionManager}.options.secret",
                        "{sessionManager}.store",
                        "{sessionManager}.options.cookie"
                    ]
                }
            }
        },
        invokers: {
            matchRoute: {
                funcName: "kettle.middleware.session.matchRoute",
                args: ["{kettle.server}.server.routes", "{arguments}.0.req"]
            },
            resolveSessionAttributes: {
                funcName: "kettle.middleware.session.resolveSessionAttributes",
                args: [
                    "{kettle.server}.options.handlers",
                    "{arguments}.0",
                    "{arguments}.1"
                ]
            },
            handle: {
                funcName: "kettle.middleware.sessionHandle",
                args: [
                    "{that}",
                    "{arguments}.0"
                ]
            }
        }
    });

    /**
     * Create an instance of an express session middleware.
     * @param  {String} key cookie name.
     * @param  {String} secret session cookie is signed with this secret to
     *                         prevent tampering.
     * @param  {Object} store a session store.
     * @param  {JSON} cookie session cookie settings.
     * @return {Object} an express session middleware object.
     */
    kettle.middleware.session.makeSession = function (key, secret, store, cookie) {
        return express.session({
            key: key,
            secret: secret,
            store: store,
            cookie: cookie
        });
    };

    /**
     * Match the request url to one of the handler routes.
     * @param {JSON} routes a list of routes handled.
     * @param  {Object} req request object.
     * @return {String} matched route.
     */
    kettle.middleware.session.matchRoute = function (routes, req) {
        return fluid.find(routes[req.method.toLowerCase()],
            function (route) {
                var regexp = new RegExp(route.regexp)
                if (regexp.exec(req.originalUrl)) {
                    return route.path;
                }
            }
        );
    };

    /**
     * Verify whether the handler for the route requires session creation
     * and/or existance of the valid session.
     * @param {JSON} handlers handlers spec.
     * @param {Object} request a request object.
     * @param {String} route matched route.
     */
    kettle.middleware.session.resolveSessionAttributes = function (handlers, request, route) {
        fluid.find(handlers, function (handler) {
            if (handler.route === route) {
                request.needSession = handler.needSession;
                request.needValidSession = handler.needValidSession;
                return true;
            }
        });
    };

    /**
     * A wrapper around express' session middleware.
     * @param {Object} that session middleware.
     * @param {Object} request a request object.
     */
    kettle.middleware.sessionHandle = function (that, request) {
        var req = request.req;
        var res = request.res;
        var next = request.next;
        var route = that.matchRoute(request);

        // None of the handlers handle the path of the request.
        if (!route) {
            res.send(404, {
                isError: true,
                message: "No handler is routed for the url: " + req.originalUrl
            });
            return;
        }

        that.resolveSessionAttributes(request, route);

        // Either if session needs to already exist or be created proceed to the
        // session middleware.
        if (request.needSession || request.needValidSession) {
            that.session(req, res, next);
        } else {
            next();
        }
    };

})();
