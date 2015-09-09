/**
 * Kettle Test Utilities
 * 
 * Contains facilities for
 *  - issuing plain HTTP and WebSockets requests encoded declaratively as Infusion components
 *  - parsing and capturing cookies returned by these responses
 *  - assembling sequences of asynchronous fixtures suitable for execution by the IoC testing framework
 *
 * Copyright 2013-2015 Raising the Floor (International)
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
    QUnit = fluid.registerNamespace("QUnit");

fluid.require("ws", require, "kettle.npm.ws");

fluid.registerNamespace("kettle.test");

// Register an uncaught exception handler that will cause any active test fixture to unconditionally fail

kettle.test.handleUncaughtException = function (err) {
    console.log("!!!!JQKK ", err);
    if (QUnit.config.current) {
        QUnit.ok(false, "Unexpected failure in test case (see following log for more details): " + err.message);
    } else {
        process.exit(1);
    }
};

fluid.onUncaughtException.addListener(kettle.test.handleUncaughtException, "fail",
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
        parser: "@expand:kettle.npm.cookieParser({that}.options.secret)"
    }
});

fluid.defaults("kettle.test.request", {
    gradeNames: ["fluid.component"],
    invokers: {
        send: "fluid.notImplemented"
    },
    hostname: "localhost",
    port: 8081,
    path: "/",
    storeCookies: false,
    termMap: {}
});

kettle.test.request.prepareRequestOptions = function (componentOptions, cookieJar, userOptions, permittedOptions) {
    var staticOptions = fluid.filterKeys(componentOptions, permittedOptions);
    var requestOptions = $.extend(true, {headers: {}}, staticOptions, componentOptions.requestOptions, userOptions);
    
    requestOptions.path = kettle.dataSource.urlResolver.resolve(null, requestOptions.path, componentOptions.termMap);
    if (cookieJar && cookieJar.cookie && componentOptions.storeCookies) {
        requestOptions.headers.Cookie = cookieJar.cookie;
    }
    return requestOptions;
};

fluid.defaults("kettle.test.request.ws", {
    gradeNames: ["kettle.test.request"],
    messageJSON: true, // deserialize all received data as JSON
    sendJSON: true, // serialize all sent data as JSON
    webSocketsProtocols: null, // forwarded to "protocols" argument of new ws.WebSocket()
    invokers: {
        connect: {
            funcName: "kettle.test.request.ws.connect",
            args: ["{that}", "{cookieJar}", "{arguments}.0"]
        },
        send: {
            funcName: "kettle.test.request.ws.send",
            args: [
                "{that}",
                "{arguments}.0", // model
                "{arguments}.1"  // send options: https://github.com/websockets/ws/blob/master/doc/ws.md#websocketsenddata-options-callback
            ]
        },
        disconnect: {
            funcName: "kettle.test.request.ws.disconnect",
            args: "{that}.ws"
        }
    },
    connectOnInit: false,
    events: {
        onConnect: null, // fired when we receive "open" for initial connection
        onMessage: null,
        onError: null
    },
    listeners: {
        "onCreate.connect": {
            funcName: "kettle.test.request.ws.connectIfRequired"
        },
        onDestroy: "{that}.disconnect"
    }
});

kettle.test.request.ws.connectIfRequired = function (that) {
    if (that.options.connectOnInit) {
        that.connect();
    }
};

// permitted options taken from https://github.com/websockets/ws/blob/master/doc/ws.md#new-wswebsocketaddress-protocols-options
kettle.test.request.ws.requestOptions = ["protocol", "agent", "headers", "protocolVersion", "hostname", "port", "path"];

kettle.test.request.ws.connect = function (that, cookieJar, directOptions) {
    var requestOptions = kettle.test.request.prepareRequestOptions(that.options, cookieJar, directOptions, kettle.test.request.ws.requestOptions);

    var url = "ws://" + requestOptions.hostname + ":" + requestOptions.port + requestOptions.path;
    fluid.log("connecting ws.WebSocket to: " + url);
    
    that.ws = new kettle.npm.ws(url, that.options.webSocketsProtocols, requestOptions);
    that.ws.on("open", that.events.onConnect.fire);
    that.ws.on("error", function (err) {
        console.log("CLIENT ERROR");
        that.events.onError.fire(that, err);
    });
    that.ws.on("message", function (data) {
        console.log("CLIENT MESSAGE ", data);
        that.events.onMessage.fire(that, that.options.messageJSON ? kettle.JSON.parse(data) : data);
    });
};

kettle.test.request.ws.disconnect = function (ws) {
    if (ws) {
        ws.terminate();
    }
};

kettle.test.request.ws.send = function (that, model, directOptions) {
    var togo = fluid.promise();
    var text = that.options.sendJSON ? JSON.stringify(model) : model;
    that.ws.send(text, directOptions, function (err) {
        if (err) {
            console.log("CLIENT ws.send received ERROR ", err);
            that.events.onError.fire(err); // TODO: somehow advertise to users that they should not double-handle
            togo.reject(err);
        } else {
            console.log("CLIENT WS REQUEST SENT");
            togo.resolve();
        }
    });
    return togo;
};


// A component which issues an HTTP request, collects its response body and parses
// any cookies returned into a cookieJar component if one is available
fluid.defaults("kettle.test.request.http", {
    gradeNames: ["kettle.test.request"],
    events: { // this will fire with the signature (data, that, {cookies, signedCookies})
        onComplete: null
    },
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

// A variety of WebSockets request that retrieve cookies from a "jar" higher in the component tree
fluid.defaults("kettle.test.request.wsCookie", {
    gradeNames: ["kettle.test.request.ws"],
    storeCookies: true
});

kettle.test.request.http.requestOptions = ["host", "hostname", "port", "localAddress", "socketPath", "method", "path", "headers", "auth", "agent"];

kettle.test.request.http.send = function (that, cookieJar, callback, model, directOptions) {
    if (that.nativeRequest) {
        fluid.fail("You cannot reuse a kettle.test.http.request object once it has been sent - please construct a fresh component for this request");
    }
    var requestOptions = kettle.test.request.prepareRequestOptions(that.options, cookieJar, directOptions, kettle.test.request.http.requestOptions);
    
    fluid.log("Sending a " + (requestOptions.method || "GET") + " request to: ", requestOptions.path, " on port " + requestOptions.port);
    if (model) {
        model = typeof model === "string" ? model : JSON.stringify(model);
        requestOptions.headers["Content-Type"] = requestOptions.headers["Content-Type"] || "application/json";
        requestOptions.headers["Content-Length"] = model.length;
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
                // pseudoReq will get its cookies and signedCookies fields
                // populated by the cookie parser.
                cookieJar.parser(pseudoReq, {}, fluid.identity);
            }
            callback(data, that, pseudoReq);
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

/** Accepts a structure containing:
 *  message {String} The assertion message
 *  expected {Object} The expected response body as JSON
 *  string {String} The received response body
 *  request {Component} The http request component which has fired
 *  statusCode {Number} The expected status code (defaults to 200 if missing)
 */
kettle.test.assertJSONResponse = function (options) {
    var statusCode = options.statusCode || 200;
    var data = kettle.JSON.parse(options.string);
    jqUnit.assertDeepEq(options.message, options.expected, data);
    jqUnit.assertEquals(options.message + " statusCode", statusCode, options.request.nativeResponse.statusCode);
};

fluid.defaults("kettle.test.server", {
    listeners: {
        "onCreate.upgradeErrors": {
            funcName: "kettle.test.server.upgradeError",
            priority: "before:listen"
        }
    }
});

// jshint ignore:start
// ignore for unused arguments which must be supplied since app.use ridiculously checks the callee signature
kettle.test.server.upgradeError = function (server) {
    server.expressApp.use(function (err, req, res, next) { // we MUST supply 4 arguments here
        console.log("RECEIVED UPGRADE ERROR CALL");
        if (err) {
            console.log("THROWING error ", err);
            fluid.onUncaughtException.fire(err);
        }
    });
};
// jshint ignore:end

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

kettle.test.testDefToCaseHolder = function (configurationName, testDefIn) {
    var testDef = fluid.copy(testDefIn);
    var sequence = testDef.sequence;
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
