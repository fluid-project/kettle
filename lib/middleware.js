/*!
Kettle wrapping for Express Middleware

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    express = require("express"),
    kettle = fluid.registerNamespace("kettle"),
    connect = require("express/node_modules/connect");

fluid.registerNamespace("kettle.middleware");
fluid.registerNamespace("kettle.connect");

/**
 * Cookie parser.
 */
kettle.connect.cookieParser = connect.cookieParser;

/**
 * A memory store constructor used for sessions.
 */
kettle.connect.MemoryStore = connect.middleware.session.MemoryStore;

fluid.defaults("kettle.middleware", {
    gradeNames: ["fluid.component"],
    listeners: {
        onCreate: [
            "{that}.register",
            "{that}.apply"
        ]
    },
    eventName: { // An event to be fired when the middleware is activated by the engine - this should be removed/reconceived
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
            args: ["{kettle.server}.expressApp", "{that}.options.eventName"]
        },
        register: {
            funcName: "kettle.middleware.register",
            args: [
                "{requests}",
                "{that}.options.eventName",
                "{that}.handle"
            ]
        }
    }
});

/**
 * Register a middleware wrapper.
 * @param  {Object} server an express server.
 * @param  {String} eventName event name.
 */
kettle.middleware.apply = function (expressApp, eventName) {
    // TODO: This logic is backwards. We want not a set of middleware in an inaccessible array which
    // fire Fluid events in a fixed sequence, but rather a set of listeners to a Fluid event which can be used for
    // scheduling the action of middleware
    expressApp.use(function (req) {
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
    gradeNames: ["kettle.middleware"],
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
    // use the newer structure recommended by https://github.com/senchalabs/connect/wiki/Connect-3.0
    var _json = express.json();
    var _urlencoded = express.urlencoded();

    return function bodyParser(req, res, next) {
        _json(req, res, function(err) {
            if (err) {
                return next(err);
            }
            _urlencoded(req, res, next);
        });
    };
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
    gradeNames: ["fluid.component"],
    components: {
        bodyParser: {
            type: "kettle.middleware.bodyParser"
        }
    }
});

fluid.defaults("kettle.middleware.CORS", {
    gradeNames: ["kettle.middleware"],
    allowMethods: "GET",
    // origin can be a "*" (all domains are allowed) or an array of allowed
    // domains (including ports).
    // Link to the documentation: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS#Access-Control-Allow-Origin
    // TODO: serious security risk here
    origin: "*",
    // This is a flag that enables the response exposure to CORS requests with credentials.
    // Link to the documentation: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS#Access-Control-Allow-Credentials
    credentials: "true",
    invokers: {
        handle: {
            funcName: "kettle.middleware.CORSHandle",
            args: [
                "{arguments}.0",
                "{that}.options.allowMethods",
                "{that}.options.origin",
                "{that}.options.credentials"
            ]
        }
    }
});

/**
 * A middleware responsible for enabling CORS within the kettle server.
 * @param {Object} request a request object.
 * @param {String|Array} allowMethods methods that are enabled with CORS.
 * @param {String|Array} origin domains that are allowed.
 * @param {String} credentials response exposure flag.
 */
kettle.middleware.CORSHandle = function (request, allowMethods, origin, credentials) {
    var res = request.res,
        req = request.req,
        reqOrigin = req.headers.origin;
    // Handle a preflight OPTIONS request as well.
    allowMethods = fluid.makeArray(allowMethods).concat(["OPTIONS", "PUT", "POST"]);

    // Add CORS response headers.
    res.header("Access-Control-Allow-Origin",
        origin === "*" || origin.indexOf(reqOrigin) > -1 ? reqOrigin : "null");
    res.header("Access-Control-Allow-Credentials", credentials);
    res.header("Access-Control-Allow-Methods", allowMethods.join(","));
    res.header("Access-Control-Allow-Headers", "X-Requested-With,Content-Type");

    if (req.method === "OPTIONS") {
        res.send(204);
    } else {
        request.next();
    }
};

fluid.defaults("kettle.use.CORS", {
    gradeNames: ["fluid.component"],
    components: {
        CORS: {
            type: "kettle.middleware.CORS"
        }
    }
});

fluid.defaults("kettle.middleware.cookieParser", {
    gradeNames: ["kettle.middleware"],
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
    return kettle.connect.cookieParser(secret);
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
    gradeNames: ["fluid.component"],
    components: {
        cookieParser: {
            type: "kettle.middleware.cookieParser"
        }
    }
});

fluid.defaults("kettle.middleware.sessionValidator", {
    gradeNames: ["kettle.middleware"],
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
    if (request.useSession === "existing" &&
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
    gradeNames: ["fluid.component"],
    components: {
        sessionValidator: {
            type: "kettle.middleware.sessionValidator"
        }
    }
});

fluid.defaults("kettle.middleware.session", {
    gradeNames: ["kettle.middleware"],
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
    events: {
        ensureSession: null
    },
    listeners: {
        ensureSession: [
            "{sessionManager}.resolveSessionAttributes",
            "{sessionManager}.createSession"
        ]
    },
    invokers: {
        matchRoute: {
            funcName: "kettle.middleware.session.matchRoute",
            args: ["{kettle.server}.expressApp.routes", "{arguments}.0.req"]
        },
        handle: {
            funcName: "kettle.middleware.sessionHandle",
            args: [
                "{that}.matchRoute",
                "{that}.events.ensureSession",
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
            var regexp = new RegExp(route.regexp);
            if (regexp.exec(req.originalUrl)) {
                return route.path;
            }
        }
    );
};

/**
 * A wrapper around express' session middleware.
 * @param {Function} matchRoute matches the request path to a handler route.
 * @param {Object} ensureSession event that is fired to handle session.
 * @param {Object} request a request object.
 */
kettle.middleware.sessionHandle = function (matchRoute, ensureSession, request) {
    var route = matchRoute(request);
    // None of the handlers handle the path of the request.
    if (route) {
        ensureSession.fire(request, route);
    } else {
        request.res.send(404, {
            isError: true,
            message: "No handler is routed for the url: " + request.req.originalUrl
        });
    }
};
