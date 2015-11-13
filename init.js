/*
Kettle Init - Bootstrap for Kettle "configs"

Copyright 2012-2013 OCAD University
Copyright 2015 Raising the Floor - International
Licensed under the New BSD license. You may not use this file except in
compliance with this License.
You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var kettle = require("./kettle.js");

kettle.config.makeConfigLoader({
    configName: kettle.config.getNodeEnv(),
    configPath: kettle.config.getConfigPath()
});