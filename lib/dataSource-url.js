/*!
Kettle URL DataSource

Copyright 2012-2013 OCAD University
Copyright 2016 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    followRedirects = require("follow-redirects");

fluid.registerNamespace("kettle.npm");
// Expose these for mocking and also following the general pattern, e.g. for middleware
kettle.npm.http = followRedirects.http;
kettle.npm.https = followRedirects.https;

fluid.registerNamespace("kettle.dataSource");

/**** URL DATASOURCE SUPPORT ****/

fluid.defaults("kettle.dataSource.URL", {
    gradeNames: ["fluid.dataSource.URL"],
    writableGrade: "kettle.dataSource.URL.writable",
    charEncoding: "utf-8",
    invokers: {
        handleHttp: "kettle.dataSource.URL.handleHttp"
    },
    permittedRequestOptions: "kettle.dataSource.URL.requestOptions",
    censorRequestOptionsLog: {
        username: true,
        password: true,
        "headers.Authorization": true
    }
});

fluid.defaults("kettle.dataSource.URL.writable", {
    gradeNames: ["fluid.dataSource.URL.writable"]
});

kettle.dataSource.URL.requestOptions = [
    // Options handled by the built-in node "http" and "https" modules
    "url", "protocol", "hostname", "family", "username", "password", "port", "localAddress",
    "socketPath", "method", "pathname", "headers", "agent", "termMap",
    // Options handled by the follow-redirects library
    "followRedirects", "maxRedirects", "maxBodyLength", "beforeRedirect", "agents", "trackRedirects"
];

// TODO: Deal with the anomalous status of "charEncoding" - in theory it could be set per-request but currently can't be. Currently all
// "requestOptions" have a common fate in that they end up as the arguments to http.request. We need to split these into two levels,
// httpRequestOptions and the outer level with everything else. We also need to do something similar for kettle.dataSource.file

/** Compute the callback to be supplied to `http.request` for this dataSource operation
 * @param {Object} requestOptions - The fully merged options which were sent to `http.request`
 * @param {Promise} promise - The outgoing promise to be returned to the user
 * @param {String} whileMsg - A readable summary of the current operation (including HTTP method and URL) to be suffixed to any rejection message
 * @return {Function} The callback to be supplied to `http.request`
 */
kettle.dataSource.URL.httpCallback = function (requestOptions, promise, whileMsg) {
    return function (res) {
        var received = "";
        res.setEncoding(requestOptions.charEncoding);
        res.on("data", function onData(chunk) {
            received += chunk;
        });
        res.on("end", kettle.wrapCallback(
            function () {
                if (fluid.dataSource.URL.isErrorStatus(res.statusCode)) {
                    var relayed = fluid.dataSource.URL.relayError(res.statusCode, received, whileMsg);
                    if (requestOptions.notFoundIsEmpty && relayed.statusCode === 404) {
                        promise.resolve(undefined);
                    } else {
                        promise.reject(relayed);
                    }
                } else {
                    promise.resolve(received);
                }
            })
        );
    };
};

/** Compute the listener to be attached to the `http.request` `error` event for this dataSource operation
 * @param {Promise} promise - The outgoing promise to be returned to the user
 * @param {String} whileMsg - A readable summary of the current operation (including HTTP method and URL) to be suffixed to any rejection message
 * @return {Function} A function accepting an error and triggering rejection of the supplied promise
 */
kettle.dataSource.URL.errorCallback = function (promise, whileMsg) {
    return function (error) {
        error.isError = true;
        promise.reject(kettle.upgradeError(error, whileMsg));
    };
};

/** Prepare a URL for logging by censoring sensitive parts of the URL (satisfy KETTLE-73, GPII-3309)
 * @param {Object} requestOptions - A hash of request options holding a set of parsed URL fields as returned from
 * https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost , as well as some others
 * including the overall `url`.
 * @param {Object} toCensor A hash of member paths within `requestOptions` to `true`, holding those which should be censored
 * @return {RequestOptions} A requestOptions object with the sensitive members removed where they appear at top level as well as where they might occur encoded
 * within the `url` member
 */
kettle.dataSource.URL.censorRequestOptions = function (requestOptions, toCensor) {
    var togo = fluid.copy(requestOptions);
    fluid.each(toCensor, function (troo, key) {
        var original = fluid.get(togo, key);
        if (original) {
            fluid.set(togo, key, "(SENSITIVE)");
        }
    });
    // Undo this prepareRequestOptions GPII-2147 fix just for logging
    if (togo.hostname === "127.0.0.1") {
        togo.hostname = "localhost";
    }
    togo.url = fluid.dataSource.URL.condenseUrl(togo).toString();
    return togo;
};

/** Central strategy point for all HTTP-backed DataSource operations (both read and write).
 * Accumulates options to be sent to the underlying node.js `http.request` primitives, collects and interprets the
 * results back into promise resolutions.
 * @param {Component} that The DataSource itself
 * @param {Object} baseOptions A partially merged form of the options sent to the top-level `dataSource.get` method together with relevant
 * static options configured on the component. Information in the `directModel` argument has already been encoded into the url member.
 * @param {String} data The `model` argument sent to top-level `dataSource.get/set` after it has been pushed through the transform chain
 * @return {Promise} A promise for the request resolution, yielding the response body as a string or an error object
 */
kettle.dataSource.URL.handleHttp = function (that, baseOptions, data) {
    var promise = fluid.promise();
    var defaultOptions = {
        port: 80,
        method: "GET"
    };

    var dataBuffer;

    if (baseOptions.operation === "set") {
        dataBuffer = Buffer.from(data);
        defaultOptions.headers = {
            "Content-Type": that.encoding.options.contentType,
            "Content-Length": dataBuffer.length
        };
        defaultOptions.method = baseOptions.writeMethod;
    }
    var requestOptions = fluid.extend(true, defaultOptions, baseOptions);
    var loggingOptions = kettle.dataSource.URL.censorRequestOptions(requestOptions, that.options.censorRequestOptionsLog);
    var whileMsg = " while executing HTTP " + requestOptions.method + " on url " + loggingOptions.url;
    fluid.log("DataSource Issuing " + (requestOptions.protocol.toUpperCase()).slice(0, -1) + " request with options ",
        loggingOptions);
    promise.accumulateRejectionReason = function (originError) {
        return kettle.upgradeError(originError, whileMsg);
    };
    var callback = kettle.wrapCallback(kettle.dataSource.URL.httpCallback(requestOptions, promise, whileMsg));
    // Note that the request API actually responds to the legacy URL options format, we need to render ourselves
    var url = fluid.dataSource.URL.condenseUrl(requestOptions).toString();
    var req;
    if (requestOptions.protocol === "http:") {
        req = kettle.npm.http.request(url, requestOptions, callback);
    } else if (requestOptions.protocol === "https:") {
        req = kettle.npm.https.request(url, requestOptions, callback);
    } else {
        fluid.fail("kettle.dataSource.URL cannot handle unknown protocol "  + requestOptions.protocol);
    }
    req.on("error", kettle.wrapCallback(kettle.dataSource.URL.errorCallback(promise, whileMsg)));
    req.end(dataBuffer ? dataBuffer : data);
    return promise;
};
