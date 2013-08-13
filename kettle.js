/*
Kettle.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

var loader = fluid.getLoader(__dirname);

loader.require("./lib/dataSource.js");
loader.require("./lib/utils.js");
loader.require("./lib/middleware.js");
loader.require("./lib/request.js");
loader.require("./lib/server.js");
loader.require("./lib/app.js");
loader.require("./lib/configLoader.js");

module.exports = kettle;
