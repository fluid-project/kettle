/*!
Kettle File DataSource

Copyright 2012-2013 OCAD University
Copyright 2016 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = fluid || require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    http = http || require("http"),
    https = https || require("https"),
    urlModule = urlModule || require("url");

fluid.registerNamespace("kettle.dataSource");

/**** URL DATASOURCE SUPPORT ****/

fluid.defaults("kettle.dataSource.URL", {
    gradeNames: ["kettle.dataSource"],
    readOnlyGrade: "kettle.dataSource.URL",
    invokers: {
        resolveUrl: "kettle.dataSource.URL.resolveUrl", // url, termMap, directModel, noencode
        getImpl: {
            funcName: "kettle.dataSource.URL.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // options, directModel
        }
    },
    components: {
        cookieJar: "{cookieJar}"
    },
    termMap: {}
});

fluid.defaults("kettle.dataSource.URL.writable", {
    gradeNames: ["kettle.dataSource.writable"],
    invokers: {
        setImpl: {
            funcName: "kettle.dataSource.URL.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // options, directModel, model
        }
    }
});

/**
 * Resolves (expands) a url or path with respect to the "directModel" supplied to a dataSource's API (get or set). There are three rounds of expansion - firstly, the string
 * entries as the values in "termMap" will be looked up as paths within `directModel`. The resulting values will then be URI Encoded, unless their value
 * the termMap is prefixed with `noencode:`. Secondly,
 * this resolved termMap will be used for a round of the standard fluid.stringTemplate algorithm applied to the supplied URL. Finally, any argument `expand` will be
 * used to expand the entire URL.
 * @param  {String} url a url or path to expand.
 * @param  {Object String -> String} termMap A map of terms to be used for string interpolation. Any values which begin with the prefix `noencode:` will have this prefix stripped off, and
 * URI encoding will not be applied to the substituted value. After the value is normalised in this way, the remaining value may be used for indirection in the directModel if it
 * begins with the prefix "%", or else directly for interpolation
 * @param  {Object} directModel a set of data used to expand the url template.
 * @return {String} resolved/expanded url.
 */
kettle.dataSource.URL.resolveUrl = function (url, termMap, directModel, noencode) {
    var map = fluid.transform(termMap, function resolve(entry) {
        entry = String(entry);
        var encode = !noencode;
        if (entry.indexOf("noencode:") === 0) {
            encode = false;
            entry = entry.substring("noencode:".length);
        }
        var value = entry.charAt(0) === "%" ? fluid.get(directModel, entry.substring(1)) : entry;
        if (encode) {
            value = encodeURIComponent(value);
        }
        return value;
    });
    var replaced = fluid.stringTemplate(url, map);
    return replaced;
};

kettle.dataSource.URL.requestOptions = ["url", "protocol", "host", "hostname", "family", "port", "localAddress", "socketPath", "method", "path", "headers", "auth", "agent", "termMap"];

// TODO: Deal with the anomalous status of "charEncoding" - in theory it could be set per-request but currently can't be. Currently all
// "requestOptions" have a common fate in that they end up as the arguments to http.request. We need to split these into two levels,
// httpRequestOptions and the outer level with everything else. We also need to do something similar for kettle.dataSource.file

/** Assemble the `requestOptions` structure that will be sent to `http.request` by `kettle.dataSource.URL` by fusing together values from the user, the component
 * with filtration by a list of permitted options, e.g. those listed in `kettle.dataSource.URL.requestOptions`. A poorly factored method that needs to be
 * reformed as a proper merge pipeline.
 */

kettle.dataSource.URL.prepareRequestOptions = function (componentOptions, cookieJar, userOptions, permittedOptions, directModel, userStaticOptions, resolveUrl) {
    var staticOptions = fluid.filterKeys(componentOptions, permittedOptions);
    var requestOptions = fluid.extend(true, {headers: {}}, userStaticOptions, staticOptions, userOptions);
    var termMap = fluid.transform(requestOptions.termMap, encodeURIComponent);

    requestOptions.path = (resolveUrl || kettle.dataSource.URL.resolveUrl)(requestOptions.path, requestOptions.termMap, directModel);

    fluid.stringTemplate(requestOptions.path, termMap);
    if (cookieJar && cookieJar.cookie && componentOptions.storeCookies) {
        requestOptions.headers.Cookie = cookieJar.cookie;
    }
    return requestOptions;
};

/** Given an HTTP status code as returned by node's `http.IncomingMessage` class (or otherwise), determine whether it corresponds to
 * an error status. This performs a simple-minded check to see if it a number outside the range [200, 300).
 * @param {Number} statusCode The HTTP status code to be tested
 * @return {Boolean} `true` if the status code represents an error status
 */

kettle.dataSource.URL.isErrorStatus = function (statusCode) {
    return statusCode < 200 || statusCode >= 300;
};

/**
 * Handles calls to a URL data source's get and set.
 * @param  {kettle.dataSource.urlResolver} A URLResolver that will convert the contents of the
 * <code>directModel</code> supplied as the 3rd argument into a concrete URL used for this
 * HTTP request.
 * @param  options {Object} an options block that encodes:
 *     operation {String}: "set"/"get"
 *     notFoundIsEmpty {Boolean}: <code>true</code> if a missing file on read should count as a successful empty payload rather than a rejection
 *     writeMethod {String}: "PUT"/ "POST" (option - if not provided will be defaulted by the concrete dataSource implementation)
 * @param  directModel {Object} a model holding the coordinates of the data to be read or written
 * @param  model {Object} [Optional] - the payload to be written by this write operation
 * @return {Promise} a promise for the successful or failed datasource operation
 */
kettle.dataSource.URL.handle = function (that, userOptions, directModel, model) {
    var permittedOptions = kettle.dataSource.URL.requestOptions;
    var url = that.resolveUrl(that.options.url, that.options.termMap, directModel);
    var parsed = fluid.filterKeys(urlModule.parse(url, true), permittedOptions);
    var requestOptions = kettle.dataSource.URL.prepareRequestOptions(that.options, that.cookieJar, userOptions, permittedOptions, directModel, parsed);

    return kettle.dataSource.URL.handle.http(that, requestOptions, model);
};

// Attempt to parse the error response as JSON, but if failed, just stick it into "message" quietly
kettle.dataSource.URL.relayError = function (response, received, whileMsg) {
    var rejectPayload;
    try {
        rejectPayload = JSON.parse(received);
    } catch (e) {
        rejectPayload = {message: received};
    }
    rejectPayload.message = rejectPayload.message || rejectPayload.error;
    delete rejectPayload.error;
    rejectPayload.isError = true;
    rejectPayload.statusCode = response.statusCode;
    return kettle.upgradeError(rejectPayload, whileMsg);
};

/** Compute the callback to be supplied to `http.request` for this dataSource operation
 * @param requestOptions {Object} The fully merged options which were sent to `http.request`
 * @param promise {Promise} The outgoing promise to be returned to the user
 * @param whileMsg {String} A readable summary of the current operation (including HTTP method and URL) to be suffixed to any rejection message
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
                if (kettle.dataSource.URL.isErrorStatus(res.statusCode)) {
                    var relayed = kettle.dataSource.URL.relayError(res, received, whileMsg);
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
 * @param promise {Promise} The outgoing promise to be returned to the user
 * @param whileMsg {String} A readable summary of the current operation (including HTTP method and URL) to be suffixed to any rejection message
 */

kettle.dataSource.URL.errorCallback = function (promise, whileMsg) {
    return function (error) {
        error.isError = true;
        promise.reject(kettle.upgradeError(error, whileMsg));
    };
};

/** Central strategy point for all HTTP-backed DataSource operations (both read and write).
 * Accumulates options to be sent to the underlying node.js `http.request` primitives, collects and interprets the
 * results back into promise resolutions.
 * @param that {Component} The DataSource itself
 * @param baseOptions {Object} A partially merged form of the options sent to the top-level `dataSource.get` method together with relevant
 * static options configured on the component. Information in the `directModel` argument has already been encoded into the url member.
 * @param data {String} The `model` argument sent to top-level `dataSource.get/set` after it has been pushed through the transform chain
 */

kettle.dataSource.URL.handle.http = function (that, baseOptions, data) {
    var promise = fluid.promise();
    var defaultOptions = {
        port: 80,
        method: "GET"
    };
    if (baseOptions.operation === "set") {
        data = new Buffer(data);

        defaultOptions.headers = {
            "Content-Type": that.encoding.options.contentType,
            "Content-Length": data.length
        };
        defaultOptions.method = baseOptions.writeMethod;
    }
    var requestOptions = fluid.extend(true, defaultOptions, baseOptions);
    var whileMsg = " while executing HTTP " + requestOptions.method + " on url " + requestOptions.url;
    fluid.log("DataSource Issuing " + (requestOptions.protocol.toUpperCase()).slice(0, -1) + " request with options ", requestOptions);
    promise.accumulateRejectionReason = function (originError) {
        return kettle.upgradeError(originError, whileMsg);
    };
    var callback = kettle.wrapCallback(kettle.dataSource.URL.httpCallback(requestOptions, promise, whileMsg));
    var req;
    if (requestOptions.protocol === "http:") {
        req = http.request(requestOptions, callback);
    } else if (requestOptions.protocol === "https:") {
        req = https.request(requestOptions, callback);
    } else {
        fluid.fail("kettle.dataSource.URL cannot handle unknown protocol "  + requestOptions.protocol);
    }
    req.on("error", kettle.wrapCallback(kettle.dataSource.URL.errorCallback(promise, whileMsg)));
    req.end(data);
    return promise;
};
