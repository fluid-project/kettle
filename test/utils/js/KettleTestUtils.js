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

fluid.setLogging(true);

fluid.registerNamespace("kettle.tests");

fluid.defaults("kettle.tests.cookieJar", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    members: {
        cookie: "",
        parser: {
            expander: {
                func: "kettle.tests.makeCookieParser",
                args: "{that}.options.secret"
            }
        }
    }
});

kettle.tests.makeCookieParser = function (secret) {
    return kettle.utils.cookieParser(secret);
};

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
                "{arguments}.0",
                "{that}.events.onComplete.fire"
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
        "{tests}.events.onServerReady": {
            listener: "{that}.listen",
            priority: "first"
        },
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
    var url = options.hostname + ":" + options.port + options.path;
    fluid.log("connecting to: " + url);
    that.socket = require("socket.io-client").connect(url, ioOptions);
    that.socket.on("message", callback);
};

kettle.tests.request.io.send = function (socket, model, callback) {
    fluid.log("sending: " + JSON.stringify(model));
    socket.emit("message", model, callback);
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
                "{cookieJar}",
                "{that}.events.onComplete.fire",
                "{arguments}.0"
            ]
        }
    }
});

kettle.tests.request.http.send = function (requestOptions, termMap, cookieJar, callback, model) {
    var options = fluid.copy(requestOptions);
    options.path = fluid.stringTemplate(options.path, termMap);
    fluid.log("Sending a request to: " + options.path);
    options.headers = options.headers || {};
    if (cookieJar.cookie) {
        options.headers.Cookie = cookieJar.cookie;
    }
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
            var cookie = res.headers["set-cookie"];
            var pseudoReq = {};
            if (cookie) {
                cookieJar.cookie = cookie;
                // Use connect's cookie parser with set secret to parse the
                // cookies from the kettle.server.
                pseudoReq = {
                    headers: {
                        cookie: cookie[0]
                    }
                };
                // pseudoReq will get its cookies and signedCookis fields
                // populated by the cookie parser.
                cookieJar.parser(pseudoReq, {}, fluid.identity);
            }
            callback(data, res.headers, pseudoReq.cookies,
                pseudoReq.signedCookies);
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

// Component that contains the Kettle configuration under test.
fluid.defaults("kettle.tests.configuration", {
    gradeNames: ["autoInit", "fluid.eventedComponent", "{kettle.tests.testCaseHolder}.options.configurationName"],
    components: {
        server: {
            options: {
                listeners: {
                    onListen: "{kettle.tests.testCaseHolder}.events.onServerReady"
                }
            }
        }
    }
});

fluid.defaults("kettle.tests.testCaseHolder", {
    gradeNames: ["autoInit", "fluid.test.testCaseHolder"],
    events: {
        applyConfiguration: null,
        onServerReady: null
    },
    secret: "kettle tests secret",
    distributeOptions: [{
        source: "{that}.options.secret",
        target: "{that > cookieJar}.options.secret"
    }, {
        source: "{that}.options.secret",
        target: "{that server}.options.secret"
    }],
    components: {
        cookieJar: {
            type: "kettle.tests.cookieJar"
        },
        configuration: {
            type: "kettle.tests.configuration",
            createOnEvent: "applyConfiguration"
        }
    }
});

fluid.defaults("kettle.tests.testEnvironment", {
    gradeNames: ["fluid.test.testEnvironment", "autoInit"]
});

kettle.tests.buildTestCase = function (configurationName, testDef) {
    var fixture = {
        name: testDef.name,
        expect: testDef.expect,
        sequence: fluid.copy(testDef.sequence)
    };

    fixture.sequence.unshift({
        func: "{tests}.events.applyConfiguration.fire"
    }, {
        event: "{tests}.events.onServerReady",
        listener: "fluid.identity"
    });

    return {
        configurationName: configurationName,
        components: testDef.components,
        modules: [{
            name: configurationName + " tests.",
            tests: [fixture]
        }]
    };
};


kettle.tests.runTests = function (testDefs) {
    var tests = fluid.transform(testDefs, function (testDef) {
        var configurationName = kettle.config.createDefaults(testDef.config);
        return {
            type: "kettle.tests.testEnvironment",
            options: {
                components: {
                    tests: {
                        type: "kettle.tests.testCaseHolder",
                        options: kettle.tests.buildTestCase(configurationName,
                            testDef)
                    }
                }
            }
        };
    });

    fluid.test.runTests(tests);
};
