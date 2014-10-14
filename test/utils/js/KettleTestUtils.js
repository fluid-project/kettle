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

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    http = require("http"),
    fs = require("fs"),
    jqUnit = fluid.require("jqUnit"),
    QUnit = fluid.registerNamespace("QUnit"),
    ioClient = require("socket.io-client");

var kettle = fluid.registerNamespace("kettle");
fluid.registerNamespace("kettle.test");

// Register an uncaught exception handler that will cause any active test fixture to unconditionally fail

kettle.test.handleUncaughtException = function (err) {
    if (QUnit.config.current) {
        QUnit.ok(false, "Unexpected failure in test case (see following log for more details): " + err.message);
    }
};

fluid.onUncaughtException.addListener(kettle.test.handleUncaughtException, "fail", null,
        fluid.handlerPriorities.uncaughtException.fail);

/*
 * Some low-quality synchronous file utilities, suitable for use in test fixtures
 */
    
// Utility to recursively delete a directory and its contents from http://www.geedew.com/2012/10/24/remove-a-directory-that-is-not-empty-in-nodejs/
// Useful for cleaning up before and after test cases

kettle.test.deleteFolderRecursive = function (path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                kettle.test.deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

kettle.test.copyFileSync = function (sourceFile, targetFile) {
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
};

/*
 * Definitions for HTTP-based test fixtures - request classes and utilities
 */

fluid.defaults("kettle.test.cookieJar", {
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    members: {
        cookie: "",
        parser: {
            expander: {
                func: "kettle.test.makeCookieParser",
                args: "{that}.options.secret"
            }
        }
    }
});

kettle.test.diagnose = function (that) {
    var instantiator = fluid.getInstantiator(that);
    var path = instantiator.idToPath(that.id);
    
    fluid.log("Constructed component " + that.typeName + " with id " + that.id + " at path " + path);
    fluid.log(new Error().stack);
};

kettle.test.diagnoseDestroy = function (that) {
    fluid.log("DESTROYED component " + that.typeName + " with id " + that.id);
};

kettle.test.makeCookieParser = function (secret) {
    return kettle.connect.cookieParser(secret);
};

fluid.defaults("kettle.test.request", {
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    invokers: {
        send: "kettle.test.request.send" // This is a dummy entry to be overridden by subclasses
    },
    events: {
        onComplete: null
    },
    requestOptions: {
        port: 8081,
        storeCookies: false
    },
    termMap: {}
});

// Definition and defaults of socket.io request component
fluid.defaults("kettle.test.request.io", {
    gradeNames: ["autoInit", "kettle.test.request"],
    invokers: {
        send: {
            funcName: "kettle.test.request.io.send",
            args: [
                "{that}",
                "{arguments}.0",
                "{that}.events.onComplete.fire"
            ]
        },
        listen: {
            funcName: "kettle.test.request.io.listen",
            args: "{that}"
        },
        connect: {
            funcName: "kettle.test.request.io.connect",
            args: "{that}"
        },
        disconnect: {
            funcName: "kettle.test.request.io.disconnect",
            args: "{that}.socket"
        },
        setCookie: {
            funcName: "kettle.test.request.io.setCookie",
            args: ["{cookieJar}", "{arguments}.0"]
        },
        updateDependencies: {
            funcName: "kettle.test.request.io.updateDependencies",
            args: "{that}"
        }
    },
    events: {
        onMessage: null,
        onError: null
    },
    listeners: {
        onCreate: "{that}.updateDependencies",
        "{tests}.events.onServerReady": {
            listener: "{that}.listen",
            priority: "first"
        },
        onDestroy: "{that}.disconnect"
    },
    listenOnInit: false,
    requestOptions: {
        hostname: "ws://localhost"
    },
    ioOptions: {
        transports: ["websocket"],
        reconnect: false, // This option prevents corruption of test cases on Windows, where slow terminal scrolling may block I/O and
        // cause tests to consider that a retry is necessary on failed I/O
        "force new connection": true // TODO: This option is undocumented and is not supported with the current version of socket.io node client - 
        // we need to understand why it was added. It appears the current name will be "forceNew"
    }
});

kettle.test.request.io.disconnect = function (socket) {
    socket.disconnect();
};

kettle.test.request.io.connect = function (that) {
    var options = fluid.copy(that.options.requestOptions);
    options.path = fluid.stringTemplate(options.path, that.options.termMap);
    var url = options.hostname + ":" + options.port + options.path;
    fluid.log("connecting socket.io to: " + url);
    // Create a socket.
    that.socket = ioClient.connect(url, that.options.ioOptions);
    that.socket.on("error", that.events.onError.fire);
    that.socket.on("message", that.events.onMessage.fire);
};

var oldRequest = ioClient.util.request;

ioClient.util.request = function (xdomain) {
    // This stack trace is extremely helpful for any future work on resolving the very serious
    // problems with this testing strategy. Currently we may not run any more than one such
    // test concurrently. TODO: We need to either find a strategy avoiding this scope leakage,
    // or abandon the use of the socket.io-client library for testing (and possibly the
    // use of socket.io itself too)
    fluid.log("Invoked new XHR request: " + new Error().stack);
    return oldRequest(xdomain);
};

kettle.test.request.io.updateDependencies = function (that) {

    // Handle cookie
    // NOTE: version of xmlhttprequest that socket.io-client depends on does not
    // permit cookies to be set. The newer version has a setDisableHeaderCheck
    // method to permit restricted headers. This magic below is simply replacing
    // the socket.io-client's XMLHttpRequest object with the newer one.
    // See https://github.com/LearnBoost/socket.io-client/issues/344 for more
    // info.
    var newRequest = require("xmlhttprequest").XMLHttpRequest;
    require("socket.io-client/node_modules/xmlhttprequest").XMLHttpRequest =
        function () {
            newRequest.apply(this, arguments);
            this.setDisableHeaderCheck(true);
            var originalOpen = this.open;
            this.open = function() {
                originalOpen.apply(this, arguments);
                that.setCookie(this);
            };
        };
};

kettle.test.request.io.listen = function (that) {
    if (that.options.listenOnInit) {
        that.connect();
    }
};

kettle.test.request.io.setCookie = function (cookieJar, request) {
    if (fluid.isDestroyed(cookieJar)) {
        fluid.fail("Supplied destroyed cookieJar");
    }
    if (cookieJar.cookie) {
        request.setRequestHeader("cookie", cookieJar.cookie);
    }
};

kettle.test.request.io.send = function (that, model, callback) {
    if (!that.options.listenOnInit) {
        that.connect();
        that.socket.on("connect", function () {
            that.socket.emit("message", model, callback);
        });
    } else {
        that.socket.emit("message", model, callback);
    }
};

// Definition and defaults of http request component
fluid.defaults("kettle.test.request.http", {
    gradeNames: ["autoInit", "kettle.test.request"],
    invokers: {
        send: {
            funcName: "kettle.test.request.http.send",
            args: [
                "{that}",
                "{that}.options.requestOptions",
                "{that}.options.termMap",
                "{cookieJar}",
                "{that}.events.onComplete.fire",
                "{arguments}.0"
            ]
        }
    }
});

// A variety of HTTP request that stores received cookies in a "jar" higher in the component tree
fluid.defaults("kettle.test.request.httpCookie", {
    gradeNames: ["autoInit", "kettle.test.request.http"],
    requestOptions: {
        storeCookies: true
    }
});

// A variety of request that both uses socket.io as well as storing received cookies in a "jar" higher in the component tree
fluid.defaults("kettle.test.request.ioCookie", {
    gradeNames: ["autoInit", "kettle.test.request.io"],
    requestOptions: {
        storeCookies: true
    }
});

kettle.test.request.http.send = function (that, requestOptions, termMap, cookieJar, callback, model) {
    var options = fluid.copy(requestOptions);
    options.path = fluid.stringTemplate(options.path, termMap);
    fluid.log("Sending a " + (options.method || "GET") + " request to: ", (options.path || "/"), " on port " + options.port);
    options.headers = options.headers || {};
    if (model) {
        model = typeof model === "string" ? model : JSON.stringify(model);
        options.headers["Content-Type"] = "application/json";
        options.headers["Content-Length"] = model.length;
    }
    if (cookieJar && cookieJar.cookie && options.storeCookies) {
        options.headers.Cookie = cookieJar.cookie;
    }
    var req = http.request(options, function (res) {
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
            if (cookie && options.storeCookies) {
                if (fluid.isDestroyed(cookieJar)) {
                    fluid.fail("Stored cookie in destroyed jar");
                }
                cookieJar.cookie = cookie;
                // Use connect's cookie parser with set secret to parse the
                // cookies from the kettle.server.
                pseudoReq = {
                    headers: {
                        cookie: cookie[0]
                    }
                };
                // pseudoReq will get its cookies and signedCookie fields
                // populated by the cookie parser.
                cookieJar.parser(pseudoReq, {}, fluid.identity);
            }
            callback(data, res.headers, pseudoReq.cookies, pseudoReq.signedCookies);
        });
    });

    req.shouldKeepAlive = false;
    
    req.on("error", function (err) {
        jqUnit.fail("Error making request to " + options.path + ": " + err.message);
    });

    if (model) {
        req.write(model);
    }

    req.end();
};

// Component that contains the Kettle configuration (server) under test.
fluid.defaults("kettle.test.configuration", {
    gradeNames: ["autoInit", "fluid.eventedComponent", "{testCaseHolder}.options.configurationName"],
    components: {
        server: {
            createOnEvent: "{tests}.events.constructServer",
            options: {
                listeners: {
                    onListen: "{tests}.events.onServerReady"
                }
            }
        }
    }
});

// The two core grades (serverEnvironment and testCaseHolder) for kettle server-aware fixtures. 
// There are currently two reasons for separation and locating most material with the testCaseHolder 
// based on framework limitations:
// i) An environment can't be its own TestCaseHolder (IoC testing framework limitation)
// ii) The subcomponents of "tests" must be siblings of the fixtures themselves otherwise they
// couldn't be addressed by distributeOptions etc. (FLUID-5495)

fluid.defaults("kettle.test.testCaseHolder", {
    gradeNames: ["autoInit", "fluid.test.testCaseHolder"],
    events: {
        onServerReady: null,
        constructServer: null
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
        configuration: {
            type: "kettle.test.configuration" // The server and all its tree lie under here
        },
        cookieJar: {
            type: "kettle.test.cookieJar"
        }
    }
});

fluid.defaults("kettle.test.serverEnvironment", {
    gradeNames: ["fluid.test.testEnvironment", "autoInit"],
    components: {
        tests: {
            type: "kettle.test.testCaseHolder"
        }
    }
});

/** Builds a Fluid IoC testing framework fixture (in fact, the "options" to a TestCaseHolder) given a configuration
 * name and a "testDef". This fixture will automatically be supplied as a subcomponent of an environment of type 
 * <code>kettle.test.serverEnvironment</code>.
 * The testDef must include a <code>sequence</code> element which will be fleshed out with the following
 * additions - i) At the front, two elements - firstly a firing of the <code>constructServer</code> event of the TestEnvironment,
 * secondly, a listener for the <code>onServerReady</code> event of the TestEnvironment - ii) at the back, two elements - firstly,
 * an invocation of the <code>stop</code> method of the server. The resulting holder will be a <code>kettle.test.testCaseHolder</code> holding
 * a Kettle server as a subcomponent of its <code>configuration</code> component.
 * @param configurationName {String} A configuration name which will become the "name" (in QUnit terms, "module name") of the
 * resulting fixture
 * @param testDef {Object} A partial test fixture specification. This includes most of the elements expected in a Fluid IoC testing
 * framework "module" specification, with required elements <code>sequence</code>, <code>name</code> and optional element <code>expect</code>. It may
 * also include any configuration directed at the <code>TestCaseHolder</code> component, including some <code>gradeNames</code> to supply some reusable
 * component material.
 * @return {Object} a fully-fleshed out set of options for a TestCaseHolder, incuding extra sequence elements as described above.
 */

kettle.test.testDefToCaseHolder = function (configurationName, testDef) {
    var sequence = fluid.copy(testDef.sequence);
    delete testDef.sequence;
    sequence.unshift({ // This sequence point is required because of a QUnit bug - it defers the start of sequence by 13ms "to avoid any current callbacks" in its words
        func: "{tests}.events.constructServer.fire"
    }, {
        event: "{tests}.events.onServerReady",
        listener: "fluid.identity"
    });

    sequence.push({
        func: "{tests}.configuration.server.stop"
    }, {
        event: "{tests}.configuration.server.events.onStopped",
        listener: "fluid.identity"
    });

    testDef.configurationName = configurationName;
    testDef.modules = [{
        name: configurationName + " tests",
        tests: [{
            name: testDef.name,
            expect: testDef.expect,
            sequence: sequence
        }]
    }];
    return testDef;
};

kettle.test.testDefToServerEnvironment = function (testDef) {
    var configurationName = kettle.config.createDefaults(testDef.config);
    return {
        type: "kettle.test.serverEnvironment",
        options: {
            components: {
                tests: {
                    options: kettle.test.testDefToCaseHolder(configurationName, testDef)
                }
            }
        }
    };
};

/** These functions assist the use of individual files run as tests, as well as assisting a complete
 * module's test suites run in aggregate. They makes use of the global flag <code>kettle.test.allTests</code>
 * to distinguish these situations.
 *
 * The expected usage of these functions is as the last line of a node.js-aware file containing some test definitions.
 * This last line will read: <code>module.exports = kettle.test.bootstrap(testDefs, ...)</code>. 
 *
 * When run without the kettle.test.allTests flag, the module exporting the bootstrap return will run its
 * tests immediately. When run with the flag, it instead returns the configuration which should be
 * sent to fluid.test.runTests later.
 *
 * In time this should probably be fixed by improving the IoC testing framework - we can't just accumulate
 * standard async QUnit fixtures since we instead drive fixtures in lockstep with the creation and destruction 
 * of component trees. But we should try to find a means for the system to "autonomously" contribute
 * fixtures into a queue just as we could in plain QUnit/jQUnit. Note that we have serious bugs currently in 
 * mixing plain fixtures with IoC testing fixtures.
 * @param testDefs {Object} or {Array of Object} an array of objects, each representing a test fixture
 * @param transformer {Function} or {Array of Function} an array of transform functions, accepting an object representing a test fixture and returning a "more processed" one. The entire chain
 * of functions will be applied to each member of <code>testDefs</code>, with the result that it becomes a fully fleshed out TestCaseHolder as required by Fluid's 
 * <a href="http://wiki.fluidproject.org/display/docs/The+IoC+Testing+Framework">IoC Testing Framework</a>  
 */
 
kettle.test.bootstrap = function (testDefs, transformer) {
    var transformArgs = [fluid.makeArray(testDefs)].concat(fluid.makeArray(transformer));
    var tests = fluid.transform.apply(null, transformArgs);
    return kettle.test.allTests ? tests : fluid.test.runTests(tests);
};

/** As for kettle.test.bootstrap, only transform the supplied definitions by converting them into kettle
 * server tests, bracketed by special server start and stop sequence points. Any supplied transforms in the 2nd 
 * argument will be run before the standard transform to construct server-aware test cases */
 
kettle.test.bootstrapServer = function (testDefs, transformer) {
    return kettle.test.bootstrap(testDefs, fluid.makeArray(transformer).concat([kettle.test.testDefToServerEnvironment]));
};