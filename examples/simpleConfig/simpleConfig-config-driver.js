/**
 * Kettle Sample app - simpleConfig using declarative config
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

var kettle = require("../../kettle.js");

// Load the code implementing the config's request handler
require("./simpleConfig-config-handler.js");

// Load the server configuration from the file referencing the handler
kettle.config.makeConfigLoader({
    configName: "examples.simpleConfig",
    configPath: __dirname
});

// Load the client to make a test request
require("./simpleConfig-client.js");
