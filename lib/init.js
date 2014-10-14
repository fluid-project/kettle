/*
Kettle init.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

(function () {

    "use strict";

    var path = require("path"),
        kettle = require(path.resolve(__dirname, "../kettle.js"));

    kettle.config.makeConfigLoader({
        configName: kettle.config.getNodeEnv(),
        configPath: kettle.config.getConfigPath()
    });

})();
