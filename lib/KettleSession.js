/**
 * Kettle Session support, using standard express session middleware
 *
 * Copyright 2013 OCAD University
 * Copyright 2015 Raising the Floor, International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/kettle/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");
    
fluid.require("express-session", require, "kettle.npm.expressSession");

kettle.npm.makeMemorySessionStore = function () {
    return new kettle.npm.expressSession.MemoryStore();
};


fluid.defaults("kettle.middleware.session", {
    gradeNames: ["kettle.plainMiddleware"],
    store: "@expand:kettle.npm.makeMemorySessionStore()",
    middlewareOptions: { // https://github.com/expressjs/session#sessionoptions
        name: "kettle.sid", // used to be "key" in express 3.x
        store: "{that}.options.store",
        cookie: {
            secure: false
        },
        secret: "kettle session secret",
        saveUninitialized: false,
        resave: false
    },
    middleware: "@expand:kettle.npm.expressSession({that}.options.middlewareOptions)"
});

/**
 * A grade contributing the session middleware to a server's collection
 */
fluid.defaults("kettle.server.sessionAware", {
    distributeOptions: {
        record: "kettle.middleware.session",
        target: "{that > kettle.middlewareHolder}.options.components.session.type"
    }
});

// Grade to be applied to a request in order to opt in to session processing
fluid.defaults("kettle.request.sessionAware", {
    requestMiddleware: {
        session: {
            middleware: "{middlewareHolder}.session"
        }
    },
    events: {
        onDestroySession: null
    },
    listeners: {
        "onDestroySession.destroy": {
            funcName: "kettle.request.sessionAware.destroy",
            args: "{that}"
        }
    }
});

kettle.request.sessionAware.destroy = function (request) {
    if (request.req.session) {
        // TODO: determine if res.clearCookie is useful here as applied in our tests
        request.req.session.destroy();
    }
};
