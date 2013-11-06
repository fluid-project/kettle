/*
Kettle App.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        kettle = fluid.registerNamespace("kettle");

    fluid.defaults("kettle.app", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        handlers: {},
        listeners: {
            onAttach: {
                listener: "{kettle.server}.amalgamateHandlers",
                args: "{that}.options.handlers"
            }
        }
    });

})();
