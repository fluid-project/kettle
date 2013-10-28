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
            onCreate: [{
                listener: "{requests}.events.registerMiddleware.fire",
                args: "{that}"
            }, "{that}.apply"]
        },
        invokers: {
            resolveEventName: {
                funcName: "kettle.middleware.resolveEventName",
                args: "{middleware}.typeName"
            },
            handle: {
                funcName: "kettle.middleware.handle",
                args: "{arguments}.0"
            },
            apply: {
                funcName: "kettle.middleware.apply",
                args: ["{kettle.server}.server", "{that}.resolveEventName"]
            }
        },
    });

    /**
     * Register a middleware wrapper.
     * @param  {Object} server an express server.
     * @param  {Function} resolveEventName event name builder.
     */
    kettle.middleware.apply = function (server, resolveEventName) {
        server.use(function (req, res, next) {
            var eventName = resolveEventName();
            req.fluidRequest.events[eventName].fire(req.fluidRequest);
        });
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
                type: "kettle.middleware.bodyParser",
                createOnEvent: "onMiddleware"
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
                type: "kettle.middleware.CORS",
                createOnEvent: "onMiddleware"
            }
        }
    });

    fluid.defaults("kettle.middleware.cookieParser", {
        gradeNames: ["kettle.middleware", "autoInit"],
        members: {
            parser: {
                expander: {
                    func: "kettle.middleware.cookieParser.makeParser"
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
     * Create an express cookie parser middleware.
     * @return {Object} express cookie parser.
     */
    kettle.middleware.cookieParser.makeParser = function () {
        return express.cookieParser();
    };

    /**
     * A wrapper around express' cookie parser middleware.
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
                type: "kettle.middleware.cookieParser",
                createOnEvent: "onMiddleware"
            }
        }
    });

    fluid.defaults("kettle.middleware.session", {
        gradeNames: ["kettle.middleware", "autoInit"],
        members: {
            store: {
                expander: {
                    func: "kettle.middleware.session.makeStore"
                }
            },
            session: {
                expander: {
                    func: "kettle.middleware.session.makeSession",
                    args: [
                        "{that}.options.key",
                        "{that}.options.secret",
                        "{that}.store",
                        "{that}.options.cookie"
                    ]
                }
            }
        },
        key: "kettle.sid",
        secret: "kettle session secret",
        cookie: {
            secure: true
        },
        invokers: {
            handle: {
                funcName: "kettle.middleware.sessionHandle",
                args: ["{that}.session", "{arguments}.0"]
            }
        }
    });

    /**
     * Create a memory store for the session middleware wrapper.
     */
    kettle.middleware.session.makeStore = function () {
        return new kettle.utils.MemoryStore();
    };

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
     * A wrapper around express' session middleware.
     * @param {Object} request a request object.
     */
    kettle.middleware.sessionHandle = function (session, request) {
        session(request.req, request.res, request.next);
    };

    fluid.defaults("kettle.use.session", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        components: {
            session: {
                type: "kettle.middleware.session",
                createOnEvent: "onMiddleware"
            }
        }
    });

})();
