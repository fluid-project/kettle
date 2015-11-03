/**
 * Kettle Sample app - simple HTTP dataSource
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
    examples = fluid.registerNamespace("examples");

require("../../kettle.js");

fluid.defaults("examples.httpDataSource", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://jsonplaceholder.typicode.com/posts/%postId",
    termMap: {
        postId: "%directPostId"
    }
});

var myDataSource = examples.httpDataSource();
var promise = myDataSource.get({directPostId: 42});

promise.then(function (response) {
    console.log("Got dataSource response of ", response);
}, function (error) {
    console.error("Got dataSource error response of ", error);
});