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

fluid.defaults("kettle.tests.request", {
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    invokers: {
        send: "kettle.tests.request.send"
    },
    events: {
        onComplete: null
    },
    requestOptions: {
        port: 8080
    },
    termMap: {}
});

// Definition and defaults of socket.io request component
fluid.defaults("kettle.tests.request.io", {
    gradeNames: ["autoInit", "kettle.tests.request"],
    invokers: {
        send: {
            funcName: "kettle.tests.request.io.send",
            args: [
                "{that}.socket",
                "{that}.options.requestOptions",
                "{that}.options.termMap",
                "{that}.events.onComplete.fire",
                "{arguments}.0"
            ]
        },
        listen: {
            funcName: "kettle.tests.request.io.listen",
            args: [
                "{that}",
                "{that}.options.ioOptions",
                "{that}.options.requestOptions",
                "{that}.options.termMap",
                "{that}.events.onMessage.fire"
            ]
        },
        disconnect: {
            funcName: "kettle.tests.request.io.disconnect",
            args: "{that}.socket"
        }
    },
    events: {
        onMessage: null
    },
    listeners: {
        onCreate: "{that}.listen",
        onDestroy: "{that}.disconnect"
    },
    requestOptions: {
        hostname: "ws://localhost"
    },
    ioOptions: {
        transports: ["websocket"],
        "force new connection": true
    }
});

kettle.tests.request.io.disconnect = function (socket) {
    socket.disconnect();
};

kettle.tests.request.io.listen = function (that, ioOptions, requestOptions, termMap, callback) {
    var options = fluid.copy(requestOptions);
    options.path = fluid.stringTemplate(options.path, termMap);
    var url = options.hostname + ":" + options.port;
    that.socket = require("socket.io-client").connect(url, ioOptions);
    that.socket.on("connect", function () {
        that.socket.on(options.path, callback);
    });
};

kettle.tests.request.io.send = function (socket, requestOptions, termMap, callback, model) {
    var options = fluid.copy(requestOptions);
    options.path = fluid.stringTemplate(options.path, termMap);
    socket.emit(options.path, model, callback);
};

// Definition and defaults of http request component
fluid.defaults("kettle.tests.request.http", {
    gradeNames: ["autoInit", "kettle.tests.request"],
    invokers: {
        send: {
            funcName: "kettle.tests.request.http.send",
            args: [
                "{that}.options.requestOptions",
                "{that}.options.termMap",
                "{that}.events.onComplete.fire",
                "{arguments}.0"
            ]
        }
    }
});

kettle.tests.request.http.send = function (requestOptions, termMap, callback, model) {
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
    gradeNames: ["autoInit", "fluid.littleComponent", "{kettle.tests.testCaseHolder}.options.serverName"]
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
