/**
 * Kettle Sample app - simpleConfig using code
 *
 * Copyright 2015 Raising the Floor (International)
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/universal/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    examples = fluid.registerNamespace("examples");

require("../../kettle.js");

/* Server definitions - define a Kettle "config" and request handler in an app */

// Define a simple "config" in code with a single GET request handler at path /handlerPath

fluid.defaults("examples.simpleConfig", {
    gradeNames: "fluid.component",
    components: {
        server: {
            type: "kettle.server",
            options: {
                port: 8081,
                components: {
                    app: {
                        type: "kettle.app",
                        options: {
                            requestHandlers: {
                                getHandler: {
                                    "type": "examples.simpleConfig.handler",
                                    "route": "/handlerPath",
                                    "method": "get"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

fluid.defaults("examples.simpleConfig.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: "examples.simpleConfig.handleRequest"
    }
});

examples.simpleConfig.handleRequest = function (request) {
    request.events.onSuccess.fire({
        message: "GET request received on path /handlerPath"
    });
};

// Construct the server using the above config
examples.simpleConfig();

// Load the client to make a test request
require("./simpleConfig-client.js");
