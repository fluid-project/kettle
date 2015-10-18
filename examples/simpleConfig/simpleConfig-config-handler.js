/**
 * Kettle Sample app - simpleConfig using declarative config request handler
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

// Define the request handler grade for our one handler
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