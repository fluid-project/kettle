/**
 * Kettle Test Utilities - HTTP
 * 
 * Contains facilities for
 *  - issuing plain HTTP requests encoded declaratively as Infusion components
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
    http = require("http"),
    jqUnit = fluid.require("jqUnit");

fluid.require("ws", require, "kettle.npm.ws");

fluid.registerNamespace("kettle.test");

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


kettle.test.request.http.send = function (that, cookieJar, callback, model, directOptions) {
    if (that.nativeRequest) {
        fluid.fail("You cannot reuse a kettle.test.request.http object once it has been sent - please construct a fresh component for this request");
    }
    var requestOptions = kettle.dataSource.URL.prepareRequestOptions(that.options, cookieJar, directOptions, kettle.dataSource.URL.requestOptions);
    
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

        res.on("close", function (err) {
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

/** Accepts a structure containing:
 *  message {String} The assertion message
 *  errorTexts {String/Array of String} Strings which are expected to appear within the text of the "message" field of the response
 *  string {String} The received response body
 *  request {Component} The http request component which has fired
 *  statusCode {Number} The expected status code (defaults to 500 if missing)
 *  plainText {Boolean} If a plain text (and not a JSON) response is expected
 */
kettle.test.assertErrorResponse = function (options) {
    var statusCode = options.statusCode || 500;
    var data = options.plainText ? options.string : kettle.JSON.parse(options.string);
    if (!options.plainText) {
        jqUnit.assertEquals(options.message + " isError field set", true, data.isError);
    }
    var errorTexts = fluid.makeArray(options.errorTexts);
    fluid.each(errorTexts, function (errorText) {
        jqUnit.assertTrue(options.message + " - message text must contain " + errorText, data.message.indexOf(errorText) >= 0);
    });
    jqUnit.assertEquals(options.message + " statusCode", statusCode, options.request.nativeResponse.statusCode);
};

