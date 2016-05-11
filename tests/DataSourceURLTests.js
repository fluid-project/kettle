/**
 * Kettle DataSource URL Tests
 * 
 * Copyright 2016 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */
 
"use strict";

var fluid = require("infusion"),
    kettle = fluid.require("%kettle");

kettle.loadTestingSupport();

require("./shared/SingleRequestTestDefs.js");
require("./shared/DataSourceTestUtils.js");

fluid.registerNamespace("kettle.tests.dataSource.URL");

fluid.defaults("kettle.tests.dataSource.URL.hangup", {
    gradeNames: ["kettle.tests.singleRequest.config", "kettle.tests.simpleDataSourceTest"],
    mergePolicy: {
        expected: "nomerge"
    },
    name: "x. Testing URL dataSource with server hangup",
    shouldError: true,
    distributeOptions: {
        target: "{that kettle.app}.options.requestHandlers.testHandler.type",
        record: "kettle.tests.dataSource.URL.hangup.handler"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:8081/"
            }
        }
    },
    expected: {
        isError: true,
        code: "ECONNRESET",
        message: "socket hang up while executing HTTP GET on url http://localhost:8081/"
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.dataSource.testErrorResponse",
            args: ["{testEnvironment}.options.expected", "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.URL.hangup.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.dataSource.URL.hangup.handleRequest"
        }
    }
});

kettle.tests.dataSource.URL.hangup.handleRequest = function (request) {
    request.res.socket.destroy();
};

fluid.defaults("kettle.tests.dataSouce.CouchDB.hangup", {
    gradeNames: "kettle.tests.dataSource.URL.hangup",
    name: "y. Testing CouchDB dataSource with server hangup",
    distributeOptions: {
        target: "{that dataSource}.options.gradeNames",
        record: "kettle.dataSource.CouchDB"
    }
});

fluid.defaults("kettle.tests.dataSouce.URL.notFound", {
    gradeNames: "kettle.tests.dataSource.URL.hangup",
    name: "z. Testing CouchDB dataSource with server hangup",
    expected: {
        message: "Cannot GET /notFound\n while executing HTTP GET on url http://localhost:8081/notFound",
        isError: true,
        statusCode: 404
    },
    distributeOptions: {
        target: "{that dataSource}.options.url",
        record: "http://localhost:8081/notFound"
    }
});

fluid.test.runTests([
    "kettle.tests.dataSource.URL.hangup",
    "kettle.tests.dataSouce.CouchDB.hangup",
    "kettle.tests.dataSouce.URL.notFound"
]);