/**
 * Kettle Sample app - form-encoded HTTP dataSource
 *
 * Copyright 2015 Raising the Floor - International
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
    
fluid.setLogging(true);

require("../../kettle.js");

fluid.defaults("examples.formDataSource", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://httpbin.org/post",
    writable: true,
    writeMethod: "POST",
    components: {
        encoding: {
            type: "kettle.dataSource.encoding.formenc"
        }
    },
    setResponseNamespaces: [] // Do not attempt to parse the "set" response as formenc - it is in fact JSON
});

var myDataSource = examples.formDataSource();
var promise = myDataSource.set(null, {myField1: "myValue1", myField2: "myValue2"});

promise.then(function (response) {
    console.log("Got dataSource response of ", JSON.parse(response));
}, function (error) {
    console.error("Got dataSource error response of ", error);
});