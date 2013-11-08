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
        }, {
            source: "{that}.options.requestGradeNames",
            target: "{that > requests > request}.options.gradeNames"
        }],
        requestGradeNames: ["kettle.use.session.request"],
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

    /**
     * Grade used for requests that work with sessions.
     */
    fluid.defaults("kettle.use.session.request", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        events: {
            onRequstSession: null
        },
        dynamicComponents: {
            session: {
                createOnEvent: "onRequstSession",
                type: "kettle.sessionManager.requestSession",
                options: {
                    session: "{arguments}.0"
                }
            }
        }
    });

    kettle.use.session.checkHandlerSession = function (that, handler) {
        if (!handler.needSession && !handler.needValidSession) {
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
        },
        invokers: {
            validate: {
                funcName: "kettle.sessionManager.validate",
                args: "{arguments}.0"
            },
            invalidate: {
                funcName: "kettle.sessionManager.invalidate",
                args: ["{that}.options.key", "{arguments}.0"]
            },
            resolveSessionAttributes: {
                funcName: "kettle.sessionManager.resolveSessionAttributes",
                args: [
                    "{kettle.server}.options.handlers",
                    "{arguments}.0",
                    "{arguments}.1"
                ]
            },
            createSession: {
                funcName: "kettle.sessionManager.createSession",
                args: ["{arguments}.0", "{kettle.middleware.session}.session"]
            }
        }
    });

    /**
     * Create a request session object.
     * @param  {Object} request Current request.
     * @param  {Objcet} session Session middleware.
     */
    kettle.sessionManager.createSession = function (request, session) {
        // If session already exists or needs to be created proceed to session
        // middleware.
        var req = request.req;
        var next = request.next;
        if (request.needSession || request.needValidSession) {
            session(req, request.res, function () {
                request.events.onRequstSession.fire(req.session);
                next();
            });
        } else {
            next();
        }
    };

    /**
     * Verify whether the handler for the route requires session creation
     * and/or existance of the valid session.
     * @param {JSON} handlers handlers spec.
     * @param {Object} request a request object.
     * @param {String} route matched route.
     */
    kettle.sessionManager.resolveSessionAttributes = function (handlers, request, route) {
        fluid.find(handlers, function (handler) {
            if (handler.route === route) {
                request.needSession = handler.needSession;
                request.needValidSession = handler.needValidSession;
                return true;
            }
        });
    };

    /**
     * Default session validation procedure. Always validates to true.
     * @param  {Object} request fluidRequest object.
     * @return {Boolean} valid/invalid flag.
     */
    kettle.sessionManager.validate = function (request) {
        return true;
    };

    /**
     * Invalidate/clear a session and deny access.
     * @param  {String} key Session key. Defaults to kettle.sid
     * @param  {Object} request fluid request object.
     */
    kettle.sessionManager.invalidate = function (key, request) {
        var res = request.res;
        res.clearCookie(key);
        res.send(403, {
            isError: true,
            message: "Session is invalid"
        });
    };

    /**
     * Create a memory store for the session manager.
     */
    kettle.sessionManager.makeStore = function () {
        return new kettle.utils.MemoryStore();
    };

    fluid.defaults("kettle.sessionManager.requestSession", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        mergePolicy: {
            "session": "preserve, nomerge"
        },
        members: {
            session: "{that}.options.session"
        },
        events: {
            onDestroySession: null,
            afterDestroySession: null
        },
        listeners: {
            onDestroySession: "{that}.destroySession"
        },
        invokers: {
            destroySession: {
                funcName: "kettle.sessionManager.requestSession.destroySession",
                args: ["{that}.session", "{that}.events.afterDestroySession"]
            }
        }
    });

    /**
     * Destroy request session.
     * @param  {Object} session session object
     * @param  {Object} afterDestroySession event fired when session is
     * destroyed.
     */
    kettle.sessionManager.requestSession.destroySession = function (session, afterDestroySession) {
        session.destroy(afterDestroySession.fire);
    };

})();
