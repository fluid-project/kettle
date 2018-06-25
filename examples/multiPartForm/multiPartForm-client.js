/**
 * Kettle Sample app - multiPartForm client
 *
 * Copyright 2018 OCAD University
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
 var request = kettle.test.request.formData({
     path: "/upload",
     method: "POST",
     formData: {
         files: {
             image: "@expand:fluid.module.resolvePath(%kettle/tests/data/multer/test.png)"
         }
     },
     listeners: {
         onComplete: "examples.uploadConfig.receiver"
     }
 });

examples.uploadConfig.receiver = function (body) {
    console.log("Successfully received response ", body, " from Kettle server");
    process.exit(0);
};

// Send the POST request to the server
request.send();
