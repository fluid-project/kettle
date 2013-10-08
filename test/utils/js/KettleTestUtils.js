/**
 *
 * Kettle Tets Utils
 *
 * Copyright 2013 Raising the Floor International
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/universal/LICENSE.txt
 */

/*global require, __dirname*/

"use strict";

var fluid = require("infusion"),
    http = require("http"),
    path = require("path"),
    kettle = fluid.require(path.resolve(__dirname, "../../../kettle.js")),
    jqUnit = fluid.require("jqUnit");

fluid.registerNamespace("kettle.tests");

// Definition and defaults of http request component
fluid.defaults("kettle.tests.request", {
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    invokers: {
        send: {
            funcName: "kettle.tests.request.send",
            args: [
                "{that}.options.requestOptions",
                "{that}.options.termMap",
                "{that}.events.onComplete.fire",
                "{arguments}.0"
            ]
        }
    },
    events: {
        onComplete: null
    },
    requestOptions: {
        port: 8080
    },
    termMap: {}
});

kettle.tests.request.send = function (requestOptions, termMap, callback, model) {
    var options = fluid.copy(requestOptions);
    options.path = fluid.stringTemplate(options.path, termMap);

    var req = http.request(options, function(res) {
        var data = "";
        res.setEncoding("utf8");

        res.on("data", function (chunk) {
            data += chunk;
        });

        res.on("close", function(err) {
            if (err) {
                jqUnit.assertFalse("Error making request to " + options.path +
                    ": " + err.message, true);
            }
        });

        res.on("end", function() {
            callback(data, res.headers);
        });
    });

    req.on("error", function(err) {
        jqUnit.assertFalse("Error making request to " + options.path + ": " +
            err.message, true);
    });

    if (model) {
        req.write(model);
    }

    req.end();
};

// Component that contains the Kettle server under test.
fluid.defaults("kettle.tests.server", {
    gradeNames: ["autoInit", "fluid.littleComponent", "{that}.buildServerGrade"],
    invokers: {
        buildServerGrade: {
            funcName: "fluid.identity",
            args: "{kettle.tests.testCaseHolder}.options.serverName"
        }
    }
});

fluid.defaults("kettle.tests.testCaseHolder", {
    gradeNames: ["autoInit", "fluid.test.testCaseHolder"],
    events: {
        createServer: null
    },
    components: {
        server: {
            type: "kettle.tests.server",
            createOnEvent: "createServer"
        }
    }
});

fluid.defaults("kettle.tests.testEnvironment", {
    gradeNames: ["fluid.test.testEnvironment", "autoInit"]
});

kettle.tests.startServer = function (tests) {
    tests.events.createServer.fire();
};

kettle.tests.buildTestCase = function (serverName, testDef) {
    var fixture = {
        name: testDef.name,
        expect: testDef.expect,
        sequence: fluid.copy(testDef.sequence)
    };

    fixture.sequence.unshift({
        func: "kettle.tests.startServer",
        args: "{tests}"
    });

    return {
        serverName: serverName,
        components: testDef.components,
        modules: [{
            name: serverName + " tests.",
            tests: [fixture]
        }]
    };
};


kettle.tests.runTests = function (testDefs) {
    var tests = fluid.transform(testDefs, function (testDef) {
        var serverName = kettle.config.createDefaults(testDef.config);
        return {
            type: "kettle.tests.testEnvironment",
            options: {
                components: {
                    tests: {
                        type: "kettle.tests.testCaseHolder",
                        options: kettle.tests.buildTestCase(serverName, testDef)
                    }
                }
            }
        };
    });

    fluid.test.runTests(tests);
};
