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

kettle.middleware.getHandlerSequence = function (that, memberName) {
    var resolved = kettle.middleware.resolveSequence(that, that.typeName + " " + memberName + "  entry", that.options[memberName]);
    var sequence = fluid.getMembers(resolved, "component.handle");
    return sequence;
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
    invokers: {
        handle: {
            funcName: "kettle.plainMiddleware.resolve",
            args: ["{that}", "{arguments}.0"]
        }
    }
});

// Definition of the no-op middleware named "null", useful for overriding middleware cleanly
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
    // Link to the documentation: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS#Access-Control-Allow-Origin
    // TODO: serious security risk here
    origin: "*",
    // This is a flag that enables the response exposure to CORS requests with credentials.
    // Link to the documentation: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS#Access-Control-Allow-Credentials
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
    gradeNames: ["kettle.plainMiddleware"],
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
