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
    $ = fluid.registerNamespace("jQuery"),
    http = require("http"),
    fs = require("fs"),
    jqUnit = fluid.require("jqUnit"),
    QUnit = fluid.registerNamespace("QUnit"),
    ioClient = require("socket.io-client");

var kettle = fluid.registerNamespace("kettle");
fluid.registerNamespace("kettle.test");

// Register an uncaught exception handler that will cause any active test fixture to unconditionally fail

kettle.test.handleUncaughtException = function (err) {
    console.log("!!!!JQKK");
    if (QUnit.config.current) {
        QUnit.ok(false, "Unexpected failure in test case (see following log for more details): " + err.message);
    } else {
        process.exit(1);
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
    gradeNames: ["fluid.component"],
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
    gradeNames: ["fluid.component"],
    invokers: {
        send: "kettle.test.request.send" // This is a dummy entry to be overridden by subclasses
    },
    events: {
        onComplete: null
    },
    port: 8081,
    path: "/",
    storeCookies: false,
    termMap: {}
});

// Definition and defaults of socket.io request component
fluid.defaults("kettle.test.request.io", {
    gradeNames: ["kettle.test.request"],
    invokers: {
        send: {
            funcName: "kettle.test.request.io.send",
            args: [
                "{that}",
                "{arguments}.0",
                "{arguments}.1",
                "{that}.events.onComplete.fire"
            ]
        },
        listen: {
            funcName: "kettle.test.request.io.listen",
            args: "{that}"
        },
        connect: {
            funcName: "kettle.test.request.io.connect",
            args: ["{that}", "{arguments}.0"]
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
    hostname: "ws://localhost",
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

kettle.test.request.io.requestOptions = ["hostname", "port", "path"];

kettle.test.request.io.connect = function (that, directOptions) {
    var staticOptions = fluid.filterKeys(that.options, kettle.test.request.io.requestOptions);
    var requestOptions = $.extend(true, staticOptions, that.options.ioOptions, directOptions);
    requestOptions.path = kettle.dataSource.urlResolver.resolve(null, requestOptions.path, that.options.termMap);
    var url = requestOptions.hostname + ":" + requestOptions.port + requestOptions.path;
    fluid.log("connecting socket.io to: " + url);
    // Create a socket.
    that.socket = ioClient.connect(url, requestOptions);
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

kettle.test.request.io.send = function (that, model, directOptions, callback) {
    if (!that.options.listenOnInit) {
        that.connect(directOptions);
        that.socket.on("connect", function () {
            that.socket.emit("message", model, callback);
        });
    } else {
        that.socket.emit("message", model, callback);
    }
};

// Definition and defaults of http request component
fluid.defaults("kettle.test.request.http", {
    gradeNames: ["kettle.test.request"],
    invokers: {
        send: {
            funcName: "kettle.test.request.http.send",
            args: [
                "{that}",
                "{cookieJar}",
                "{that}.events.onComplete.fire",
                "{arguments}.0",
                "{arguments}.1"
            ]
        }
    }
});

// A variety of HTTP request that stores received cookies in a "jar" higher in the component tree
fluid.defaults("kettle.test.request.httpCookie", {
    gradeNames: ["kettle.test.request.http"],
    storeCookies: true
});

// A variety of request that both uses socket.io as well as storing received cookies in a "jar" higher in the component tree
fluid.defaults("kettle.test.request.ioCookie", {
    gradeNames: ["kettle.test.request.io"],
    storeCookies: true
});

kettle.test.request.http.requestOptions = ["host", "hostname", "port", "localAddress", "socketPath", "method", "path", "headers", "auth", "agent"];

kettle.test.request.http.send = function (that, cookieJar, callback, model, directOptions) {
    var staticOptions = fluid.filterKeys(that.options, kettle.test.request.http.requestOptions);
    var requestOptions = $.extend(true, {headers: {}}, staticOptions, that.options.requestOptions, directOptions);
    
    requestOptions.path = kettle.dataSource.urlResolver.resolve(null, requestOptions.path, that.options.termMap);
    fluid.log("Sending a " + (requestOptions.method || "GET") + " request to: ", requestOptions.path, " on port " + requestOptions.port);
    if (model) {
        model = typeof model === "string" ? model : JSON.stringify(model);
        requestOptions.headers["Content-Type"] = requestOptions.headers["Content-Type"] || "application/json";
        requestOptions.headers["Content-Length"] = model.length;
    }
    if (cookieJar && cookieJar.cookie && that.options.storeCookies) {
        requestOptions.headers.Cookie = cookieJar.cookie;
    }
    var req = that.nativeRequest = http.request(requestOptions, function (res) {
        that.nativeResponse = res;
        var data = "";
        res.setEncoding("utf8");

        res.on("data", function (chunk) {
            data += chunk;
        });

        res.on("close", function(err) {
            if (err) {
                fluid.fail("Error making request to " + requestOptions.path + ": " + err.message);
            }
        });

        res.on("end", function() {
            var cookie = res.headers["set-cookie"];
            var pseudoReq = {};
            if (cookie && that.options.storeCookies) {
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

    // See http://stackoverflow.com/questions/6658761/how-to-destroy-a-node-js-http-request-connection-nicely and 
    // https://github.com/joyent/node/blob/master/lib/_http_client.js#L136 - probably unnecessary in modern node
    req.shouldKeepAlive = false;
    
    req.on("error", function (err) {
        jqUnit.fail("Error making request to " + requestOptions.path + ": " + err.message);
    });

    if (model) {
        req.write(model);
    }

    req.end();
};

fluid.defaults("kettle.test.server", {
    listeners: {
        "onCreate.upgradeErrors": {
            funcName: "kettle.test.server.upgradeError",
            priority: "before:listen"
        }
    }
});

kettle.test.server.upgradeError = function (server) {
    console.log("Registering handler with app ", server.expressApp);
    server.expressApp.use(function (err, req, res, next) {
        console.log("RECEIVED UPGRADE ERROR CALL");
        if (err) {
            console.log("THROWING error ", err);
            throw (err);
        }
    });
};

// Component that contains the Kettle configuration (server) under test.
fluid.defaults("kettle.test.configuration", {
    gradeNames: ["fluid.component", "{testCaseHolder}.options.configurationName"],
    components: {
        server: {
            createOnEvent: "{tests}.events.constructServer",
            options: {
                gradeNames: "kettle.test.server",
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
    gradeNames: ["fluid.test.testCaseHolder"],
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
    gradeNames: ["fluid.test.testEnvironment"],
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
 * module's test suites run in aggregate. The test definitions will be transformed and then contributed
 * to the current queue of asynchronously resolving tests.
 *
 * @param testDefs {Object} or {Array of Object} an array of objects, each representing a test fixture
 * @param transformer {Function} or {Array of Function} an array of transform functions, accepting an object representing a test fixture and returning a "more processed" one. The entire chain
 * of functions will be applied to each member of <code>testDefs</code>, with the result that it becomes a fully fleshed out TestCaseHolder as required by Fluid's 
 * <a href="http://wiki.fluidproject.org/display/docs/The+IoC+Testing+Framework">IoC Testing Framework</a>  
 */
 
kettle.test.bootstrap = function (testDefs, transformer) {
    var transformArgs = [fluid.makeArray(testDefs)].concat(fluid.makeArray(transformer));
    var tests = fluid.transform.apply(null, transformArgs);
    return fluid.test.runTests(tests);
};

/** As for kettle.test.bootstrap, only transform the supplied definitions by converting them into kettle
 * server tests, bracketed by special server start and stop sequence points. Any supplied transforms in the 2nd 
 * argument will be run before the standard transform to construct server-aware test cases */
 
kettle.test.bootstrapServer = function (testDefs, transformer) {
    return kettle.test.bootstrap(testDefs, fluid.makeArray(transformer).concat([kettle.test.testDefToServerEnvironment]));
};
