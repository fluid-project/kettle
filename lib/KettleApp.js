/*
Kettle App support

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion");

/** A Kettle "app" is an "independently mountable application unit". An app aggregates together
 * a set of "handlers" which are mounted within it to handle one or more request types
 * at certain URL paths. Kettle includes support for handlers of HTTP endpoints and
 * experimental support for WebSockets endpoints. One or more Kettle apps may be
 * aggregated together into a Kettle "servers" of type <code>kettle.server</code>. A Kettle
 * server corresponds directly to a node.js HTTP server (connect/express server) in terms
 * of being "a thing listening on a TCP port". Configuration supplied to the
 * options of all apps at their options path "handlers" is aggregated together to their enclosing
 * server.
 */

fluid.defaults("kettle.app", {
    gradeNames: ["fluid.component"],
    requestHandlers: {},
    listeners: {
        "onCreate.register": {
            listener: "kettle.server.registerApp",
            args: ["{kettle.server}", "{that}"]
        }
    },
    components: {
        requests: {
            type: "kettle.requests"
        }
    }
});
