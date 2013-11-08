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
     * A grade that provides all necessary support for Socket sessions within
     * the kettle.server: cookie parsing, session and session validation
     * middleware.
     */
    fluid.defaults("kettle.use.session.io", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        distributeOptions: {
            source: "{that}.options.sessionManagerGradeNames",
            target: "{that sessionManager}.options.gradeNames"
        },
        sessionManagerGradeNames: ["kettle.sessionManager.io"],
        listeners: {
            onRegisterIOHandler: [
                "{that}.checkHandlerSession"
            ]
        }
    });

    fluid.defaults("kettle.sessionManager.io", {
        gradeNames:  ["fluid.eventedComponent", "autoInit"],
        listeners: {
            "{kettle.use.session.io}.events.onRegisterIOHandler":
                "{that}.validateIO"
        },
        invokers: {
            validateIO: {
                funcName: "kettle.sessionManager.io.validate",
                args: [
                    "{that}",
                    "{kettle.server}",
                    "{arguments}.0",
                    "{arguments}.1"
                ]
            }
        }
    });

    /**
     * Validate a socket connection for a handler.
     * @param  {Object} that sessionManager.
     * @param  {Object} server kettle.server.
     * @param  {Object} handler Handler spec defind by the kettle.app.
     * @param  {String} context Context for the handler.
     */
    kettle.sessionManager.io.validate = function (that, server, handler, context) {
        var ioHandler = server.ioHandlers[context];
        if (!handler.needValidSession) {
            return;
        }
        ioHandler.authorization(function onAuth(handshakeData, callback) {
            if (!handshakeData.headers.cookie) {
                return callback("Session cookie is missing.", false);
            }

            server.cookieParser.parser(handshakeData, {}, fluid.identity);
            var sessionID = handshakeData.signedCookies[that.options.key];
            handshakeData.sessionID = sessionID;

            that.store.load(sessionID, function onLoad(err, session) {
                if (err || !session) {
                    return callback("Session is not found", false);
                }
                handshakeData.session = session;
                return callback(null, true);
            });
        });
    };

})();
