/*!
Kettle wrapping for Express Middleware

Copyright 2012-2013 OCAD University
Copyright 2015 Raising the Floor (International)

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

// TODO: Provide a more declarative scheme for npm modules that also respects version information
fluid.require("body-parser", require, "kettle.npm.bodyParser");
fluid.require("cookie-parser", require, "kettle.npm.cookieParser");
fluid.require("serve-static", require, "kettle.npm.serveStatic");

fluid.defaults("kettle.middlewareHolder", {
    gradeNames: "fluid.component"
});

fluid.defaults("kettle.standardMiddleware", {
    gradeNames: "kettle.middlewareHolder",
    components: {
        urlencoded: {
            type: "kettle.middleware.urlencoded"
        },
        json: {
            type: "kettle.middleware.json"
        },
        CORS: {
            type: "kettle.middleware.CORS"
        },
        "null": {
            type: "kettle.middleware.null"
        },
        mismatch: {
            type: "kettle.middleware.mismatch"
        }
    }
});

fluid.registerNamespace("kettle.middleware");

/** Structure used to report a parsed collection of middleware components
 * @typedef {Object} middlewareHolder
 * @member {fluid.middleware} component - An actual middleware component instance
 * @member {fluid.priority} priority - A parsed Infusion priority specification
 * @member {String} namespace - The middleware's namespace
 */

/** Given a middleware-structured specification, decode it into a priority-sorted list of middleware components
 * described by the specification.
 * @param {fluid.component} that - A component holding a middleware specification (in practice, either a `kettle.server` or a
 * `kettle.request`)
 * @param {String} name - A human-readable name to be used when reporting a failure in parsing the specification
 * @param {Object} middlewareSpec - An options structure holding a middleware specification. In practice, this will either be the
 * `rootMiddleware` options of a `kettle.server` or the `requestMiddleware` options of a `kettle.request`
 * @return {middlewareHolder[]} A sorted array of holders of middleware components
*/
kettle.middleware.resolveSequence = function (that, name, middlewareSpec) {
    var middlewares = fluid.hashToArray(middlewareSpec, "namespace", function (newEl, el) {
        newEl.component = fluid.expandOptions(el.middleware, that);
        if (!fluid.isComponent(newEl.component) || !fluid.componentHasGrade(newEl.component, "kettle.middleware")) {
            fluid.fail("Couldn't resolve reference " + el.middleware + " from member \"middleware\" of record ", el, " to a middleware component for a " + name + ": got ", newEl.component);
        }
        newEl.priority = fluid.parsePriority(el.priority, 0, false, name);
    });
    fluid.sortByPriority(middlewares);
    return middlewares;
};

/** Given a component holding a middleware specification, and the path of that specification, return a sorted array of
 * handlers corresponding to the middleware
 * @param {fluid.component} that - A component holding a middleware specification (in practice, either a `kettle.server` or a
 * `kettle.request`)
 * @param {String} memberName - The options path of the specification (in practice this will be "rootMiddleware" or "requestMiddleware")
 * @return {requestTask[]} A priority sorted list of tasks to be executed
 */
kettle.middleware.getHandlerSequence = function (that, memberName) {
    var resolved = kettle.middleware.resolveSequence(that, that.typeName + " " + memberName + "  entry", that.options[memberName]);
    var sequence = fluid.getMembers(resolved, "component.handle");
    return sequence;
};

/** Given a piece of standard express middleware of the form `RequestListener`, convert it to the Kettle `requestTask` form
 * @param {kettle.middleware} that - The component holding the middleware (primarily for diagnostics)
 * @param {RequestListener} middleware - A piece of standard express middleware (function of signature (req, res, err))
 * @param {kettle.request} request - The Kettle request to which the middleware is to be attached
 * @param {Booleanish} async - Truthy if the middleware is expected to be invoked asynchronously (that is, whether it
 * invokes I/O in order to do its work). This information is necessary to ensure proper request marking (see comment
 * at head of KettleRequests.js)
 * @return {Promise} A promise for the resolution of the supplied middleware, which will have been invoked immediately.
 */
kettle.middleware.toPromise = function (that, middleware, request, async) {
    var togo = fluid.promise();
    if (async) {
        kettle.request.clear();
    }
    try {
        middleware(request.req, request.res, function (err) {
            if (async) {
                kettle.markActiveRequest(request);
            }
            err ? togo.reject(err) : togo.resolve();
        });
    } catch (e) {
        var err = kettle.upgradeError(e, " while invoking middleware " + fluid.dumpComponentAndPath(that));
        fluid.log(fluid.logLevel.FAIL, "Error invoking middleware ", err.stack);
        togo.reject(err);
    }
    return togo;
};

// The base middleware grade defines a function accepting the request object and returning a promise
fluid.defaults("kettle.middleware", {
    gradeNames: ["fluid.component"],
    invokers: {
        handle: {
            funcName: "fluid.notImplemented"
        }
    }
});

// A grade which accepts a standard piece of express middleware mounted at option `middleware`
fluid.defaults("kettle.plainMiddleware", {
    gradeNames: "kettle.middleware",
    asyncMiddleware: false,
    invokers: {
        handle: {
            funcName: "kettle.plainMiddleware.resolve",
            args: ["{that}", "{arguments}.0", "{plainMiddleware}.options.asyncMiddleware"]
        }
    }
});

/** Given a component derived from `kettle.plainMiddleware`, attempt to decode its `middleware` option into a `requestTask` which
 * will immediately be launched against the supplied request. This is suitable to form the implementation of the `handle`
 * method of a plainMiddleware component.
 * @param {kettle.plainMiddleware} that - A component derived from `kettle.plainMiddleware`
 * @param {kettle.request} request - The active request for which the middleware option is to be evaluated
 * @param {Booleanish} async - Whether the decoded middleware is expected to act asynchronously
 * @return {Promise} A promise for the resolution of the middleware against the current request.
 */
kettle.plainMiddleware.resolve = function (that, request, async) {
    var middleware = that.options.middleware;
    if (typeof(middleware) !== "function") {
        fluid.fail("Middleware component ", that, " with type " + that.typeName + " is improperly configured - an option named \"middleware\" of function type is required - got ", middleware);
    }
    return kettle.middleware.toPromise(that, middleware, request, async);
};

// A grade which accepts a standard piece of express middleware which may operate asynchronously.
// This is an awkward requirement found from KETTLE-57 and our "request marking". We would like the maximum
// amount of time owned by a request covered by its marker, but we can't arrange to cover, e.g. the serve-static
// middleware since it may do I/O unpredictably in an uninstrumentable way.
fluid.defaults("kettle.plainAsyncMiddleware", {
    gradeNames: "kettle.plainMiddleware",
    asyncMiddleware: true
});

/** Definition of the no-op middleware named "null", useful for overriding middleware cleanly
 * @return {Promise} A promise resolved with an undefined value
 */
kettle.middleware.nullHandler = function () {
    return fluid.promise().resolve();
};

fluid.defaults("kettle.middleware.null", {
    gradeNames: "kettle.plainMiddleware",
    invokers: {
        handle: {
            funcName: "kettle.middleware.nullHandler"
        }
    }
});

fluid.defaults("kettle.middleware.json", {
    gradeNames: ["kettle.plainMiddleware"],
    middlewareOptions: {}, // see https://github.com/expressjs/body-parser#bodyparserjsonoptions
    middleware: "@expand:kettle.npm.bodyParser.json({that}.options.middlewareOptions)"
});

fluid.defaults("kettle.middleware.urlencoded", {
    gradeNames: ["kettle.plainMiddleware"],
    middlewareOptions: {
        extended: true
    }, // see https://github.com/expressjs/body-parser#bodyparserurlencodedoptions
    middleware: "@expand:kettle.npm.bodyParser.urlencoded({that}.options.middlewareOptions)"
});

fluid.defaults("kettle.middleware.CORS", {
    gradeNames: ["kettle.middleware"],
    allowMethods: "GET",
    // origin can be a "*" (all domains are allowed) or an array of allowed
    // domains (including ports).
    // Docs: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS#Access-Control-Allow-Origin
    // TODO: serious security risk here
    origin: "*",
    // This is a flag that enables the response exposure to CORS requests with credentials.
    // Docs: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS#Access-Control-Allow-Credentials
    credentials: true,
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
 * @param {Component} request - A kettle.request component
 * @param {String|Array<String>} allowMethods - Methods that are enabled with CORS
 * @param {String|Array<String>} origin - Domains that are allowed
 * @param {String} credentials - Response exposure flag
 * @return {Promise} A resolved promise indicating that the action of the middleware has been serviced immediately (by setting request headers).
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
        res.sendStatus(204);
    }
    return fluid.promise().resolve();
};

// Middleware which checks for a request type mismatch error and reports it
fluid.defaults("kettle.middleware.mismatch", {
    gradeNames: "kettle.middleware",
    invokers: {
        handle: "kettle.middleware.mismatch.handle"
    }
});

/** A `requestTask` which signals a mismatched request type by rejecting the request.
 * @param {kettle.request} request - The request to be rejected as mismatching
 * @return {Promise} A promise rejected with the payload encoded in the requests `mismatchError` member
 */
kettle.middleware.mismatch.handle = function (request) {
    if (request.req.mismatchError) {
        return fluid.promise().reject(request.req.mismatchError);
    }
};

fluid.defaults("kettle.middleware.cookieParser", {
    gradeNames: ["kettle.plainMiddleware"],
    secret: null,
    middlewareOptions: {}, // https://github.com/expressjs/cookie-parser#cookieparsersecret-options
    middleware: "@expand:kettle.npm.cookieParser.json({that}.options.secret, {that}.options.middlewareOptions)"
});

fluid.defaults("kettle.middleware.static", {
    gradeNames: ["kettle.plainAsyncMiddleware"],
    terms: {
    },
    // root: this option must be configured by the implementor
    middlewareOptions: {}, // https://github.com/expressjs/serve-static#options
    // Remember that we write this kind of rubbish because of the crummy pre-FLUID-4982 ginger world
    middleware: "@expand:kettle.middleware.static.createMiddleware({that}.options.root, {that}.options.terms, {that}.options.middlewareOptions)"
});

kettle.middleware["static"].createMiddleware = function (root, terms, middlewareOptions) {
    if (!root) {
        fluid.fail("Static middleware must have a root path configured to serve options - got ", root);
    }
    var moduleTerms = fluid.getMembers(fluid.module.modules, "baseDir");
    var fullTerms = fluid.extend(true, moduleTerms, terms);
    var expandedRoot = fluid.stringTemplate(root, fullTerms);
    return kettle.npm.serveStatic(expandedRoot, middlewareOptions);
};
