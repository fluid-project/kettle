/*!
Kettle DataSource

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    fs = require("fs"),
    http = require("http"),
    urlModule = require("url"),
    jsonlint = require("jsonlint");
    
fluid.require("querystring", require, "node.querystring");
    
fluid.registerNamespace("kettle.dataSource");


/** Some common content encodings **/

fluid.defaults("kettle.dataSource.encoding.JSON", {
    gradeNames: "fluid.component",
    invokers: {
        parse: "kettle.dataSource.parseJSON",
        render: "kettle.dataSource.stringifyJSON"
    },
    contentType: "application/json"
});

fluid.defaults("kettle.dataSource.encoding.formenc", {
    gradeNames: "fluid.component",
    invokers: {
        parse:  "node.querystring.parse({arguments}.0)",
        render: "node.querystring.stringify({arguments}.0)"
    },
    contentType: "application/x-www-form-urlencoded"
});

fluid.defaults("kettle.dataSource.encoding.none", {
    gradeNames: "fluid.component",
    invokers: {
        parse: "fluid.identity",
        render: "fluid.identity"
    },
    contentType: "text/plain"
});


/** Definitions for parsing JSON using jsonlint to render errors **/

kettle.dataSource.JSONParseErrors = [];

kettle.dataSource.accumulateJSONError = function (str, hash) {
    var error = "JSON parse error at line "+ hash.loc.first_line + ", col " + hash.loc.last_column + ", found: \'"+ hash.token + "\' - expected: "+ hash.expected.join(", ");
    kettle.dataSource.JSONParseErrors.push(error);
};

// Adapt to shitty integration model of JISON-based parsers - beware that any other user of this module will find it permanently corrupted
// TODO: Unfortunately the parser has no error recovery states - this can only ever accumulate a single error
jsonlint.parser.parseError = jsonlint.parser.lexer.parseError = kettle.dataSource.accumulateJSONError;


kettle.dataSource.renderJSONDiagnostic = function (string, promise) {
    kettle.dataSource.JSONParseErrors = [];
    var errors = [];
    try {
        jsonlint.parse(string);
    } catch (e) {
        errors.push(e);
    } // Cannot override the core exception throwing code within the shitty parser - at jsonlint.js line 157
    errors = errors.concat(kettle.dataSource.JSONParseErrors);
    promise.reject({
        message: errors.join("\n")
    });
};

kettle.dataSource.parseJSON = function (string) {
    var togo = fluid.promise();
    if (!string) {
        togo.resolve(undefined);
    } else {
        try {
            togo.resolve(JSON.parse(string));
        } catch (err) {
            kettle.dataSource.renderJSONDiagnostic(string, togo);
        }
    }
    return togo;
};

kettle.dataSource.stringifyJSON = function (obj) {
    return obj === undefined ? "" : JSON.stringify(obj, null, 4);
};

/**
 * The head of the hierarchy of dataSource components. These abstract
 * over the process of read and write access to data, imagined to 
 * follow a JSON-based semantic and which may be asynchronous.
 *     get - to get the data from data resource
 *     set - to set the data (only if writable options is set as true)
 */
fluid.defaults("kettle.dataSource", {
    gradeNames: ["fluid.component", "{that}.getWritableGrade"],
    events: {
        // events "onRead" and "onWrite" are operated in a custom workflow by fluid.fireTransformEvent to 
        // process dataSource payloads during the get and set process. Each listener
        // receives the data returned by the last. 
        onRead: null,
        onWrite: null,
        onError: null
    },
    components: {
        encoding: {
            type: "kettle.dataSource.encoding.JSON"
        }
    },
    listeners: {
        onRead: {
            func: "{encoding}.parse",
            namespace: "encoding"
        },
        onWrite: {
            func: "{encoding}.render",
            namespace: "encoding"
        }
    },
    invokers: {
        get: {
            funcName: "kettle.dataSource.get",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // directModel, options/callback
        },
        // getImpl: must be implemented by a concrete subgrade
        getWritableGrade: {
            funcName: "kettle.dataSource.getWritableGrade",
            args: ["{that}.options.writable", "{that}.options.readOnlyGrade"]
        }
    },
    // In the case of parsing a response from a "set" request, only filters of these namespaces will be applied
    setResponseNamespaces: ["encoding"],
    writable: false
});

kettle.dataSource.getWritableGrade = function (writable, readOnlyGrade) {
    if (writable) {
        return fluid.model.composeSegments(readOnlyGrade, "writable");
    }
};

fluid.defaults("kettle.dataSource.writable", {
    gradeNames: ["fluid.component"],
    invokers: {
        set: {
            funcName: "kettle.dataSource.set",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // directModel, model, options/callback
        }
    // setImpl: must be implemented by a concrete subgrade
    }
});

// Registers the default promise handlers for a dataSource operation -
// i) If the user has supplied a function in place of method <code>options</code>, register this function as a success handler 
// ii) if the user has supplied an onError handler in method <code>options</code>, this is registered - otherwise
// we register the firer of the dataSource's own onError method.

kettle.dataSource.registerStandardPromiseHandlers = function (that, promise, options) {
    promise.then(typeof(options) === "function" ? options : null,
        options.onError ? options.onError: that.events.onError.fire);
};

kettle.dataSource.defaultiseOptions = function (componentOptions, options, directModel, isSet) {
    options = options || {};
    options.directModel = directModel;
    options.operation = isSet ? "set" : "get";
    options.reverse = isSet ? true : false;
    options.writeMethod = options.writeMethod || componentOptions.writeMethod || "PUT"; // TODO: parameterise this, only of interest to HTTP DataSource
    options.notFoundIsEmpty = componentOptions.notFoundIsEmpty;
    return options;
};

kettle.dataSource.get = function (that, directModel, options) {
    options = kettle.dataSource.defaultiseOptions(that.options, options, directModel);
    var initPayload = that.getImpl(options, directModel);
    var promise = fluid.promise.fireTransformEvent(that.events.onRead, initPayload, options);
    kettle.dataSource.registerStandardPromiseHandlers(that, promise, options);
    return promise;
};

kettle.dataSource.set = function (that, directModel, model, options) {
    options = kettle.dataSource.defaultiseOptions(that.options, options, directModel, true); // shared and writeable between all participants
    var transformPromise = fluid.promise.fireTransformEvent(that.events.onWrite, model, options);
    var togo = fluid.promise();
    transformPromise.then(function (transformed) {
        var innerPromise = that.setImpl(options, directModel, transformed);
        innerPromise.then(function (setResponse) { // Apply limited filtering to a SET response payload
            var options2 = kettle.dataSource.defaultiseOptions(that.options, fluid.copy(options), directModel);
            options2.filterNamespaces = that.options.setResponseNamespaces;
            var retransformed = fluid.promise.fireTransformEvent(that.events.onRead, setResponse, options2);
            fluid.promise.follow(retransformed, togo);
        }, function (error) {
            togo.reject(error);
        });
    });
    kettle.dataSource.registerStandardPromiseHandlers(that, togo, options);
    return togo;
};


/**
 * A type of a data source specific to communicating with a URL resource.
 */
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
kettle.dataSource.URL.resolveUrl = function (url, termMap, directModel) {
    var map = fluid.transform(termMap, function resolve(entry) {
        var encode = true;
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


kettle.dataSource.URL.prepareRequestOptions = function (componentOptions, cookieJar, userOptions, permittedOptions, directModel) {
    var staticOptions = fluid.filterKeys(componentOptions, permittedOptions);
    var requestOptions = fluid.extend(true, {headers: {}}, staticOptions, componentOptions.requestOptions, userOptions);
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
    var parsed = fluid.filterKeys(urlModule.parse(that.options.url, true), permittedOptions);
    var baseOptions = fluid.extend(parsed, userOptions);
    var requestOptions = kettle.dataSource.URL.prepareRequestOptions(that.options, that.cookieJar, baseOptions, permittedOptions, directModel);

    var func = parsed.protocol === "file:" ? kettle.dataSource.URL.handle.fs : kettle.dataSource.URL.handle.http;
    return func.apply(null, [that, requestOptions, model]);
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

kettle.dataSource.URL.httpCallback = function (promise) {
    return function (res) {
        var received = "";
        res.setEncoding("utf8");
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

    var req = http.request(requestOptions, kettle.wrapCallback(kettle.dataSource.URL.httpCallback(promise)));
    req.on("error", kettle.wrapCallback(kettle.dataSource.URL.errorCallback(promise)));
    req.end(data);
    return promise;
};

kettle.dataSource.URL.handle.fs = function (that, requestOptions, data) {
    var promise = fluid.promise(),
        fileName = requestOptions.path,
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
        args = [fileName, "utf8"];
    promise.accumulateRejectionReason = function (originError) {
        var error = fluid.extend({}, originError);
        error.message = originError.message + " while " + (operation === "set" ? "writing" : "reading") +
            " file " + fileName;
        return error;
    };
    if (operation === "set") {
        method = "writeFile";
        args.splice(1, 0, data);
    } else {
        if (!fs.existsSync(fileName)) {
            if (requestOptions.notFoundIsEmpty) {
                promise.resolve(undefined);
            } else {
                promise.reject({
                    message: "File " + fileName + " was not found"
                });
            }
            return promise;
        }
    }
    args.push(kettle.wrapCallback(fsCallback));
    fs[method].apply(null, args);
    return promise;
};


/**
 * A refinement of the URL data source suitable for communicating with the /{db}/{docid} URL space of CouchDB for simple CRUD-style reading and writing
 */
fluid.defaults("kettle.dataSource.CouchDB", {
    gradeNames: ["kettle.dataSource.URL"],
    readOnlyGrade: "kettle.dataSource.CouchDB",
    listeners: {
        onRead: {
            funcName: "kettle.dataSource.CouchDB.read",
            namespace: "CouchDB",
            priority: "after:encoding"
        }
    }
});

fluid.defaults("kettle.dataSource.CouchDB.writable", {
    gradeNames: ["kettle.dataSource.URL.writable"],
    listeners: {
        onWrite: {
            funcName: "kettle.dataSource.CouchDB.write",
            args: ["{that}", "{arguments}.0", "{arguments}.1"], // model, options
            namespace: "CouchDB",
            priority: "after:encoding"
        }
    }
});

/**
 * Convert a dataSource payload from CouchDB-encoded form - 
 * i) unpack our layer of "value" encoding for standard payloads
 * ii) decode a Couch error response into a promise failure
 * @param {resp} JSON-parsed response as received from CouchDB.
 */
kettle.dataSource.CouchDB.read = function (resp) {
    // if undefined, pass that through as per dataSource (just for consistency in FS-backed tests)
    var togo;
    if (resp === undefined) {
        togo = undefined;
    } else {
        if (resp.error) {
            var error = {
                isError: true,
                message: resp.error + ": " + resp.reason
            };
            togo = fluid.promise();
            togo.reject(error);
        } else {
            togo = resp.value;
        }
    }
    return togo;
};

kettle.dataSource.CouchDB.write = function (that, model, options) {
    var directModel = options.directModel;
    var doc = {value: model};
    var original = that.get(directModel, {filterNamespaces: ["encoding"]});
    var togo = fluid.promise();
    original.then(function (originalDoc) {
        if (originalDoc) {
            doc._id = originalDoc._id;
            doc._rev = originalDoc._rev;
        } else {
            options.writeMethod = "POST"; // returned out to URL dataSource handler
        }
        togo.resolve(doc);
    });
    return togo;
};
