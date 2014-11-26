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

    var fluid = require("infusion");
        
    /** A Kettle "app" is an "independently mountable application unit". These are aggregated together
     * into units of Kettle "servers" of type <code>kettle.server</code>. Configuration supplied to the
     * options of all app at their options path "handlers" is aggregated together to their enclosing
     * server 
     */

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
