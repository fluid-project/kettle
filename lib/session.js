/**
 * Kettle Session.
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/kettle/LICENSE.txt
 */

/*global require*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        kettle = fluid.registerNamespace("kettle");

    /**
     * A grade that provides all necessary support for sessions within the
     * kettle.server: cookie parsing, session and session validation middleware.
     */
    fluid.defaults("kettle.use.session", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        components: {
            sessionManager: {
                type: "kettle.sessionManager"
            },
            cookieParser: {
                type: "kettle.middleware.cookieParser"
            },
            session: {
                type: "kettle.middleware.session"
            },
            sessionValidator: {
                type: "kettle.middleware.sessionValidator"
            }
        },
        distributeOptions: [{
            source: "{that}.options.key",
            target: "{that > sessionManager}.options.key"
        }, {
            source: "{that}.options.cookie",
            target: "{that > sessionManager}.options.cookie"
        }, {
            source: "{that}.options.secret",
            target: "{that > sessionManager}.options.secret"
        }],
        invokers: {
            checkHandlerSession: {
                funcName: "kettle.use.session.checkHandlerSession",
                args: ["{that}", "{arguments}.0"]
            }
        },
        listeners: {
            onRegisterHandler: [
                "{that}.checkHandlerSession"
            ]
        }
    });

    kettle.use.session.checkHandlerSession = function (that, handler) {
        if (!handler.needSession) {
            return;
        }
        if (!that.cookieParser) {
            fluid.log("FAIL", "Sessions requires cookieParser middleware.");
            return false;
        }
        if (!that.session) {
            fluid.log("FAIL", "Sessions requires session middleware.");
            return false;
        }
    };

    fluid.defaults("kettle.sessionManager", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        key: "kettle.sid",
        cookie: {
            secure: false
        },
        secret: "kettle session secret",
        members: {
            store: {
                expander: {
                    func: "kettle.sessionManager.makeStore"
                }
            }
        }
    });

    /**
     * Create a memory store for the session manager.
     */
    kettle.sessionManager.makeStore = function () {
        return new kettle.utils.MemoryStore();
    };

})();
