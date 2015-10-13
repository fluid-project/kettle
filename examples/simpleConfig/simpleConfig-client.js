/**
 * Kettle Sample app - simpleConfig client definition
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
    kettle = require("../../kettle.js"),
    examples = fluid.registerNamespace("examples");

/* Client definitions - issue a request against the Kettle config's server */

// Gain access to kettle.test.request definitions 
kettle.loadTestingSupportQuiet();

// Define a test component firing a request to the server
var request = kettle.test.request.http({
    path: "/handlerPath",
    listeners: {
        onComplete: "examples.simpleConfig.receiver"
    }
});

examples.simpleConfig.receiver = function (body) {
    console.log("Successfully received response ", body, " from Kettle server");
    process.exit(0);
};

// Send the GET request to the server
request.send();