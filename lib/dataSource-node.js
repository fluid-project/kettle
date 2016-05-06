/*!
Kettle DataSource

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    fs = require("fs"),
    http = require("http"),
    urlModule = require("url");
    
fluid.require("querystring", require, "node.querystring");
    
fluid.registerNamespace("kettle.dataSource");

/**** FILE DATASOURCE SUPPORT ****/

fluid.defaults("kettle.dataSource.file", {
    gradeNames: ["kettle.dataSource"],
    readOnlyGrade: "kettle.dataSource.file",
    invokers: {
        getImpl: {
            funcName: "kettle.dataSource.file.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // options, directModel
        }
    }
});

fluid.defaults("kettle.dataSource.file.writable", {
    gradeNames: ["kettle.dataSource.writable"],
    invokers: {
        setImpl: {
            funcName: "kettle.dataSource.file.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // options, directModel, model
        }
    }
});

kettle.dataSource.file.handle = function (that, requestOptions, directModel, model) {
    if (!that.options.path) {
        fluid.fail("Cannot operate file dataSource ", that, " without an option named \"path\"");
    }
    var fileName = kettle.dataSource.URL.resolveUrl(that.options.path, that.options.termMap, directModel, true);
    var promise = fluid.promise(),
        method = "readFile",
        operation = requestOptions.operation,
        
        fsCallback = function (error, readData) {
            if (error) {
                promise.reject({
                    message: error.message
                });
            } else {
                promise.resolve(requestOptions.operation === "set" ? undefined : readData);
            }
        },
        args = [fileName, that.options.charEncoding];
    promise.accumulateRejectionReason = function (originError) {
        var error = fluid.extend({}, originError);
        error.message = originError.message + " while " + (operation === "set" ? "writing" : "reading") +
            " file " + fileName;
        return error;
    };
    if (operation === "set") {
        method = "writeFile";
        args.splice(1, 0, model);
    } else {
        if (!fs.existsSync(fileName)) {
            if (requestOptions.notFoundIsEmpty) {
                promise.resolve(undefined);
            } else {
                promise.reject({
                    message: "File " + fileName + " was not found",
                    statusCode: 404
                });
            }
            return promise;
        }
    }
    args.push(kettle.wrapCallback(fsCallback));
    fs[method].apply(null, args);
    return promise;
};

fluid.defaults("kettle.dataSource.file.moduleTerms", {
    gradeNames: "kettle.dataSource.file",
    termMap: "@expand:fluid.module.terms()"
});


/**** URL DATASOURCE SUPPORT ****/

fluid.defaults("kettle.dataSource.URL", {
    gradeNames: ["kettle.dataSource"],
    readOnlyGrade: "kettle.dataSource.URL",
    invokers: {
        resolveUrl: "kettle.dataSource.URL.resolveUrl", // url, termMap, directModel
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


kettle.dataSource.URL.prepareRequestOptions = function (componentOptions, cookieJar, userOptions, permittedOptions, directModel, userStaticOptions) {
    var staticOptions = fluid.filterKeys(componentOptions, permittedOptions);
    var requestOptions = fluid.extend(true, {headers: {}}, userStaticOptions, staticOptions, userOptions);
    var termMap = fluid.transform(requestOptions.termMap, encodeURIComponent);
   
    requestOptions.path = kettle.dataSource.URL.resolveUrl(requestOptions.path, requestOptions.termMap, directModel);
    
    fluid.stringTemplate(requestOptions.path, termMap);
    if (cookieJar && cookieJar.cookie && componentOptions.storeCookies) {
        requestOptions.headers.Cookie = cookieJar.cookie;
    }
    return requestOptions;
};

kettle.dataSource.URL.isErrorStatus = function (statusCode) {
    return statusCode < 200 || statusCode >= 300;
};

/**
 * Handles calls to data source's (URL and CouchDB) get and set.
 * @param  {kettle.dataSource.urlResolver} A URLResolver that will convert the contents of the
 * <code>directModel</code> supplied as the 3rd argument into a concrete URL used for this
 * HTTP request.
 * @param  options {Object} an options block that encodes:
 *     operation {String}: "set"/"get"
 *     notFoundIsEmpty {Boolean}: <code>true</code> if a missing file on read should count as a successful empty payload rather than a rejection
 *     writeMethod {String}: "PUT"/ "POST" (option - if not provided will be defaulted by the concrete
 * dataSource implementation)
 * @param  directModel {Object} a model holding the coordinates of the data to be read or written
 * @param  model {Object} [Optional] - the payload to be written by this write operation
 * @return {Promise} a promise for the successful or failed datasource operation
 */
kettle.dataSource.URL.handle = function (that, userOptions, directModel, model) {
    var permittedOptions = kettle.dataSource.URL.requestOptions;
    var url = kettle.dataSource.URL.resolveUrl(that.options.url, that.options.termMap, directModel);
    var parsed = fluid.filterKeys(urlModule.parse(url, true), permittedOptions);
    var requestOptions = kettle.dataSource.URL.prepareRequestOptions(that.options, that.cookieJar, userOptions, permittedOptions, directModel, parsed);
    
    return kettle.dataSource.URL.handle.http(that, requestOptions, model);
};

// Attempt to parse the error response as JSON, but if failed, just stick it into "message" quietly
kettle.dataSource.URL.relayError = function (response, received) {
    var rejectPayload;
    try {
        rejectPayload = JSON.parse(received);
    } catch (e) {
        rejectPayload = {message: received};
    }
    rejectPayload.statusCode = response.statusCode;
    return rejectPayload;
};

kettle.dataSource.URL.httpCallback = function (that, promise) {
    return function (res) {
        var received = "";
        res.setEncoding(that.options.charEncoding);
        res.on("data", function onData(chunk) {
            received += chunk;
        });
        res.on("end", kettle.wrapCallback(
            function () {
                if (kettle.dataSource.URL.isErrorStatus(res.statusCode)) {
                    promise.reject(kettle.dataSource.URL.relayError(res, received));
                } else {
                    promise.resolve(received);
                }
            })
        );
    };
};

kettle.dataSource.URL.errorCallback = function (promise) {
    return function (error) {
        // TODO: determine whether this fires on a 404 before the "empty body" standard handler can execute
        // TODO: honour "notFoundIsEmpty" option
        promise.reject(error);
    };
};

kettle.dataSource.URL.handle.http = function (that, baseOptions, data) {
    var promise = fluid.promise();
    var defaultOptions = {
        port: 80,
        method: "GET"
    };
    if (baseOptions.operation === "set") {
        defaultOptions.headers = {
            "Content-Type": that.encoding.options.contentType,
            "Content-Length": data.length
        };
        defaultOptions.method = baseOptions.writeMethod;
    }
    var requestOptions = fluid.extend(true, defaultOptions, baseOptions);
    fluid.log("DataSource Issuing HTTP request with options ", requestOptions);

    var req = http.request(requestOptions, kettle.wrapCallback(kettle.dataSource.URL.httpCallback(that, promise)));
    req.on("error", kettle.wrapCallback(kettle.dataSource.URL.errorCallback(promise)));
    req.end(data);
    return promise;
};
