/*
Routing Primitives for Kettle Servers

Copyright 2015 Raising the Floor (International)

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

/* Contains code adapted from express 4.x "layer.js":
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

"use strict";

var fluid = require("infusion"),
    urlModule = require("url"),
    kettle = fluid.registerNamespace("kettle");

// Upstream dependency stolen from express 4.x
// Note that path-to-regexp 2.0.0 breaks compatibility with our use of /* to encode middleware matches - seems unlikely we will upgrade
kettle.pathToRegexp = require("path-to-regexp");

fluid.defaults("kettle.router.http", {
    gradeNames: "fluid.component",
    members: {
        handlers: []
    },
    invokers: {
        register: {
            funcName: "kettle.router.http.register",
            args: ["{that}", "{arguments}.0"]
        },
        match: {
            funcName: "kettle.router.http.match",
            args: ["{that}.handlers", "{arguments}.0"]
        }
    }
});

/** A structure specifying a route and the request grades which will handle it.
 * See docs in "%kettle/docs/RequestHandlersAndApps.md" for more information.
 * @typedef {Object} handlerRecord
 * @member {String} type - The name of a request handling grade, which must be descended from `kettle.request`. If the
 * `method` field is filled in, the grade must be descended from `kettle.request.http`.
 * @member {String} [route] - A routing specification in the traditional format for express routes, e.g. of the form
 * "/preferences/:gpiiKey". A special form "/*" is supported indicating that the router handles all routes
 * @member {String} [method] - An HTTP method specification, possibly including multiple comma-separated values
 * @member {String} prefix - A routing prefix to be prepended to this handler's `route`. The prefix plus the route
 *           expression must match the incoming request in order for this handler to be activated
 * @member {String[]} gradeNames - One or more grade names which will be mixed in to the constructed handler when it is constructed.
 */

/** A "partially cooked" version of a `handlerRecord` as stored in various routing structures
 * @typedef {handlerRecord} internalHandlerRecord
 * @member {String} [method] - A single HTTP method specification
 * @member {kettle.app} app - The Kettle app for which this handler record is registered
 */

/** A structure holding details of a matched route
 * @typedef routeMatch
 * @member {internalHandlerRecord} handler - The (elaborated version of the) original handler structure which led to the match
 * @member {Object} output - A free-form structure which will be merged into the resulting request. This will
 * contain at least:
 * @member {Object} output.params - A decoded hash of keys to values extracted from the incoming request by route variables
 * such as ":gpiiKey"
 */

/** Registers a new route handler with this router. Note that the router is not dynamic and routes can currently not be removed.
 * Note that this is an internal method which corrupts its 2nd argument which must have been copied beforehand.
 * @param {kettle.router.http} that - The router in which the handler should be registered
 * @param {interalHandlerRecord} handler - A route handler structure
 */
kettle.router.http.register = function (that, handler) {
    var prefix = handler.prefix || "";
    handler.regexp = kettle.pathToRegexp(prefix + handler.route, handler.keys = []);
    that.handlers.push(handler);
};

kettle.router.registerOneHandlerImpl = function (that, handler, extend) {
    var handlerCopy = fluid.extend({
        method: "get"
    }, handler, extend);
    kettle.router.http.register(that, handlerCopy);
};

/** Decodes a routing parameter which has been found to be a URL component matching the routing specification. If it is
 * a string, it will be URI decoded - if this decoding fails, an exception will be thrown.
 * @param {Any} val - The URL component to be decoded
 * @return {Any} Either the original argument if it was not a String or was an empty string, or the argument after
 * successful URI decoding.
 */
kettle.router.http.decodeParam = function (val) {
    if (typeof val !== "string" || val.length === 0) {
        return val;
    }
    try {
        return decodeURIComponent(val);
    } catch (err) {
        err.message = "Failed to decode request routing parameter \"" + val + "\"";
        err.status = err.statusCode = 400;
        throw err;
    }
};

/** Extract the matched routing variables into a hash of names to values
 * @param {routeHandler} handler - The routeHandler which has been determined to match this request
 * @param {String[]} match - The output of regexp.exec as applied to the incoming request URL
 * @return {Object} A map of strings to strings of matched and decoded parameters
 */
kettle.router.http.matchToParams = function (handler, match) {
    var params = {};
    for (var i = 1; i < match.length; i++) {
        var key = handler.keys[i - 1];
        var prop = key.name;
        var val = kettle.router.http.decodeParam(match[i]);

        if (val !== undefined) {
            params[prop] = val;
        }
    }
    return params;
};

// cf. Router.prototype.matchRequest
/** Evaluates the URL and method of an incoming HTTP for a match in the table of route handlers.
 * @param {handlerRecord[]} handlers - An array of handlers in which a matching route is to be looked up
 * @param {http.IncomingMessage} req - Node's native HTTP request object
 * @return {routeMatch|Undefined} A matched route structure, or undefined if no route matched the incoming request
 */
kettle.router.http.match = function (handlers, req) {
    var method = req.method.toLowerCase(),
        parsedUrl = urlModule.parse(req.url),
        path = parsedUrl.pathname;
    for (var i = 0; i < handlers.length; ++i) {
        var handler = handlers[i];
        if (method === handler.method) {
            var match = handler.regexp.exec(path);
            if (match) {
                return {
                    handler: handler,
                    output: {
                        params: kettle.router.http.matchToParams(handler, match)
                    }
                };
            }
        }
    }
};
