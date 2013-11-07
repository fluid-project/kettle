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

    fluid.defaults("kettle.sessionManager.io", {
        gradeNames:  ["fluid.littleComponent", "autoInit"]
    });

})();
