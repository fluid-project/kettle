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
    fs = require("fs"),
    kettle = fluid.require("%kettle");

kettle.loadTestingSupport();

require("./shared/SingleRequestTestDefs.js");
require("./shared/DataSourceTestUtils.js");
require("./shared/HTTPMethodsTestDefs.js");

fluid.registerNamespace("kettle.tests.dataSource.URL");

// HTTPS test

// See http://stackoverflow.com/questions/23601989/client-certificate-validation-on-server-side-depth-zero-self-signed-cert-error
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

fluid.defaults("kettle.tests.dataSource.https", {
    // NB, slight misuse of singleRequest.config since we are not using its accompanying testDefs
    gradeNames: ["kettle.tests.singleRequest.config", "kettle.tests.simpleDataSourceTest"],
    name: "HTTPS dataSource test",
    expect: 1, // for assertion inside HTTPMethods get handler
    httpsServerOptions: {
        key: fs.readFileSync(__dirname + "/data/testkey.pem"),
        cert: fs.readFileSync(__dirname + "/data/testkey-cert.pem")
    },
    distributeOptions: {
        serverType: {
            target: "{that kettle.server}.options.members.httpServer",
            record: "@expand:kettle.server.httpsServer({kettle.tests.dataSource.https}.options.httpsServerOptions, {kettle.server}.expressApp)"
        },
        handlerType: {
            target: "{that kettle.app}.options.requestHandlers.testHandler.type",
            record: "kettle.tests.HTTPMethods.get.handler"
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testResponse",
            args: ["{that}.options.expected", "{arguments}.0"]
        }
    },
    expected: {
        message: "GET response"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "https://localhost:8081/"
            }
        }
    }
});

// Plain HTTP hangup test

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

// CouchDB hangup test

fluid.defaults("kettle.tests.dataSouce.CouchDB.hangup", {
    gradeNames: "kettle.tests.dataSource.URL.hangup",
    name: "y. Testing CouchDB dataSource with server hangup",
    distributeOptions: {
        target: "{that dataSource}.options.gradeNames",
        record: "kettle.dataSource.CouchDB"
    }
});

// CouchDB on 404

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

fluid.defaults("kettle.tests.dataSource.URL.set.specialChars", {
    gradeNames: ["kettle.tests.singleRequest.config", "kettle.tests.simpleDataSourceTest"],
    name: "HTTPS dataSource set with special chars test",
    expect: 1, // for assertion inside HTTPMethods put handler
    distributeOptions: {
        handlerType: {
            target: "{that kettle.app}.options.requestHandlers.testHandler.type",
            record: "kettle.tests.HTTPMethods.put.handler"
        },
        handlerMethod: {
            target: "{that kettle.app}.options.requestHandlers.testHandler.method",
            record: "put"
        }
    },
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "Gerät"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:8081/",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "jqUnit.assertDeepEq",
            args: ["The data with special chars is successfully received", "{that}.options.dataSourceModel", "{arguments}.0"]
        }
    }
});

fluid.test.runTests([
// Attempt to test HTTPS datasource - server currently just hangs without passing on request
    "kettle.tests.dataSource.https",
    "kettle.tests.dataSource.URL.hangup",
    "kettle.tests.dataSouce.CouchDB.hangup",
    "kettle.tests.dataSouce.URL.notFound",
    "kettle.tests.dataSource.URL.set.specialChars"
]);
