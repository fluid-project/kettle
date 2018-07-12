/**
 * Kettle Test Utilities - HTTP
 *
 * Contains facilities for
 *  - issuing plain HTTP requests encoded declaratively as Infusion components
 *  - parsing and capturing cookies returned by these responses
 *  - assembling sequences of asynchronous fixtures suitable for execution by the IoC testing framework
 *
 * Copyright 2013-2015 Raising the Floor (International)
 * Copyright 2013-2018 OCAD University
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
    jqUnit = fluid.require("node-jqunit", require, "jqUnit");

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
        onComplete: null,
        // pass an options object structured as follows
        // when firing
        // var optsObject = {
        //     cookieJar: cookieJar,
        //     callback: callback,
        //     payload: payload,
        //     directOptions: directOptions
        // };
        // that.events.send.fire(optsObject);
        send: null
    },
    listeners: {
        "send.prepareRequest": {
            funcName: "kettle.test.request.http.prepareRequest",
            args: ["{that}", "{arguments}.0"],
            priority: "before:sendPayload"
        },
        "send.sendPayload": {
            funcName: "kettle.test.request.http.sendPayload",
            args: ["{that}", "{arguments}.0"]
        }
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

kettle.test.request.http.prepareRequest = function (that, optsObject) {

    var cookieJar = optsObject.cookieJar,
        callback = optsObject.callback,
        directOptions = optsObject.directOptions;

    if (that.nativeRequest) {
        fluid.fail("You cannot reuse a kettle.test.request.http object once it has been sent - please construct a fresh component for this request");
    }

    var requestOptions = kettle.dataSource.URL.prepareRequestOptions(that.options, cookieJar, directOptions, kettle.dataSource.URL.requestOptions, that.resolveUrl);

    fluid.log("Sending a " + (requestOptions.method || "GET") + " request to: ", requestOptions.path, " on port " + requestOptions.port);

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

        res.on("end", function () {
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
};

kettle.test.request.http.sendPayload = function (that, optsObject) {

    var req = that.nativeRequest,
        payload = optsObject.payload;
    if (payload) {
        payload = typeof payload === "string" ? payload : JSON.stringify(payload);
        req.setHeader("Content-Type", req.getHeader("Content-Type") || "application/json");
        req.setHeader("Content-Length", payload.length);
    }

    if (payload) {
        req.write(payload);
    }

    req.end();
};

// Backwards-compatible forwarder to new event-based
// workflow introduced in KETTLE-66
kettle.test.request.http.send = function (that, cookieJar, callback, payload, directOptions) {

    var optsObject = {
        cookieJar: cookieJar,
        callback: callback,
        payload: payload,
        directOptions: directOptions
    };

    that.events.send.fire(optsObject);
};

/** HTTP RESPONSE ASSERTION FUNCTIONS
 * These all accept an argument "options" which contains the following core fields - some of these functions may also
 * accept some extra members of options:
 *   message {String} The assertion message
 *   request {Component} The HTTP request component which has fired
 *   string {String} The received response body
 *   statusCode {Number} The expected status code (defaults to 200 if missing)
 */

/** Asserts that the status code held in options.request is equal to options.statusCode, or the supplied default
 * @param options {Options} containing the core fields listed above
 */

kettle.test.assertResponseStatusCode = function (options, defaultCode) {
    var statusCode = options.statusCode || defaultCode;
    jqUnit.assertEquals(options.message + " statusCode", statusCode, options.request.nativeResponse.statusCode);
};

/** Asserts that a successful response with a JSON payload body has been received
 *  @param {Object} options - The "core fields" for response assertion as described above
 *  In addition to the core fields, options contains:
 *  @param {Object} options.expected - The expected response body as JSON
 */
kettle.test.assertJSONResponse = function (options) {
    var data;
    try {
        data = kettle.JSON.parse(options.string);
    } catch (e) {
        throw kettle.upgradeError(e, "\nwhile parsing HTTP response as JSON");
    }
    jqUnit.assertDeepEq(options.message, options.expected, data);
    kettle.test.assertResponseStatusCode(options, 200);
};

/** Asserts that a successful response with a plain text body or JSON body has been received
 *  @param {Object} options - The "core fields" for response assertion as described above
 *  In addition to the core fields, options contains:
 *    @param {Object} options.expected - The expected response body as JSON or plainText
 *    @param {String} options.expectedSubstring - If set, as well as `plainText`, will for a substring within the response rather than its entirety
 *    @param {Boolean} options.plainText - If `false`, will be forwarded to `kettle.test.assertJSONResponse`, otherwise, the response body will be tested as plain text
 */
kettle.test.assertResponse = function (options) {
    if (options.plainText) {
        if (options.expectedSubstring) {
            jqUnit.assertTrue(options.message, options.string.indexOf(options.expectedSubstring) !== -1);
        } else {
            jqUnit.assertEquals(options.message, options.expected, options.string);
        }
        kettle.test.assertResponseStatusCode(options, 200);
    } else {
        kettle.test.assertJSONResponse(options);
    }
};

/** Asserts that an error response of a particular structure has been received.
 * @param {Object} options The structure to be checked
 * @param {String}               options.message - The assertion message
 * @param {String|Array<String>} options.errorTexts - Strings which are expected to appear within the text of the "message" field of the response
 * @param {String}               options.string - The received response body
 * @param {Component}            options.request - The http request component which has fired
 * @param {Number}               options.statusCode - The expected status code (defaults to 500 if missing)
 * @param {Boolean}              options.plainText - If a plain text (and not a JSON) response is expected
 */
kettle.test.assertErrorResponse = function (options) {
    var data = options.plainText ? {message: options.string} : kettle.JSON.parse(options.string);
    if (!options.plainText) {
        jqUnit.assertEquals(options.message + " isError field set", true, data.isError);
    }
    var errorTexts = fluid.makeArray(options.errorTexts);
    fluid.each(errorTexts, function (errorText) {
        jqUnit.assertTrue(options.message + " - message text \"" + data.message + "\" must contain " + errorText, data.message.indexOf(errorText) >= 0);
    });
    kettle.test.assertResponseStatusCode(options, 500);
};
