/*!
Kettle wrapping for Express Middleware

Copyright 2012-2013 OCAD University
Copyright 2015 Raising the Floor (International)

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    express = require("express"),
    kettle = fluid.registerNamespace("kettle");
    
fluid.require("body-parser", require, "kettle.bodyParser");
fluid.require("cookie-parser", require, "kettle.cookieParser");

fluid.defaults("kettle.standardMiddleware", {
    gradeNames: "fluid.component",
    components: {
        urlencoded: {
            type: "kettle.middleware.urlencoded"
        },
        json: {
            type: "kettle.middleware.json"
        }
    }
});

fluid.registerNamespace("kettle.middleware");

kettle.middleware.resolveSequence = function (that, name, middlewareSpec) {
    var middlewares = fluid.hashToArray(middlewareSpec, "namespace", function (newEl, el) {
        newEl.component = fluid.expandOptions(el.component, that);
        if (!fluid.isComponent(newEl.component) || !fluid.componentHasGrade(newEl.component, "kettle.middleware")) {
            fluid.fail("Couldn't resolve reference " + el.component + " to a middleware component for a " + name + ": got ", newEl.component);
        }
        newEl.priority = fluid.parsePriority(el.priority, 0, false, name);
    });
    fluid.sortByPriority(middlewares);
    return middlewares;
};

fluid.defaults("kettle.middleware", {
    gradeNames: ["fluid.component"],
    invokers: {
        handle: {
            funcName: "fluid.notImplemented"
        }
    }
});

// A grade which expects a standard piece of express middleware mounted at option `middleware` 
fluid.defaults("kettle.plainMiddleware", {
    gradeNames: "kettle.middleware",
    invokers: {
        handle: {
            funcName: "kettle.plainMiddleware.resolve",
            args: ["{that}", "{arguments}.0"]
        }
    }
});

kettle.middleware.toPromise = function (middleware, request) {
    var togo = fluid.promise();
    middleware(request.req, request.res, function (err) {
        err ? togo.reject(err) : togo.resolve(); // jshint ignore:line
    });
    return togo;
};

kettle.plainMiddleware.resolve = function (that, request) {
    var middleware = that.options.middleware;
    if (typeof(middleware) !== "function") {
        fluid.fail("Middleware component ", that, " with type " + that.typeName + " is improperly configured - an option named \"middleware\" of function type is required - got ", middleware);
    }
    return kettle.middleware.toPromise(middleware, request);
};

fluid.defaults("kettle.middleware.json", {
    gradeNames: ["kettle.plainMiddleware"],
    middlewareOptions: {}, // see https://github.com/expressjs/body-parser#bodyparserjsonoptions
    middleware: "@expand:kettle.bodyParser.json({that}.options.middlewareOptions)"
});

fluid.defaults("kettle.middleware.urlencoded", {
    gradeNames: ["kettle.plainMiddleware"],
    middlewareOptions: {
        extended: true
    }, // see https://github.com/expressjs/body-parser#bodyparserurlencodedoptions
    middleware: "@expand:kettle.bodyParser.urlencoded({that}.options.middlewareOptions)"
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
    }
    return fluid.promise().resolve();
};

fluid.defaults("kettle.middleware.cookieParser", {
    gradeNames: ["kettle.plainMiddleware"],
    secret: null,
    middlewareOptions: {}, // https://github.com/expressjs/cookie-parser#cookieparsersecret-options
    middleware: "@expand:kettle.cookieParser.json({that}.options.secret, {that}.options.middlewareOptions)"
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
