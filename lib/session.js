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
            cookieParser: {
                type: "kettle.middleware.cookieParser",
                createOnEvent: "onMiddleware"
            },
            session: {
                type: "kettle.middleware.session",
                createOnEvent: "onMiddleware"
            },
            sessionValidator: {
                type: "kettle.middleware.sessionValidator",
                createOnEvent: "onMiddleware"
            }
        },
        key: "kettle.sid",
        secret: "kettle session secret"
    });

})();
