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
    url = require("url");
    
fluid.registerNamespace("kettle.dataSource");

/** URLRESOLVER DEFINITIONS **/

/**
 * UrlResolver component that is responsible for handling and expansion of
 * urls or paths that point to the source of data.
 */
fluid.defaults("kettle.dataSource.urlResolver", {
    gradeNames: ["autoInit", "fluid.littleComponent"],
    components: {
        urlExpander: {
            type: "kettle.urlExpander"
        }
    },
    invokers: {
        resolve: {
            funcName: "kettle.dataSource.urlResolver.resolve",
            args: [
                "{urlExpander}.expand",
                "{dataSource}.options.url",
                "{dataSource}.options.termMap",
                "{arguments}.0"
            ]
        }
    }
});

/**
 * Resolves (expands) a url or path with respect to the "directModel" supplied to a dataSource's API (get or set). There are three rounds of expansion - firstly, any
 * entries in "termMap" which themselves take the form %path will be looked up within the argument `directModel`. All such entries will then be URIEncoded. Secondly,
 * this resolved termMap will be used for a round of the standard fluid.stringTemplate algorithm applied to the supplied URL. Finally, any argument `expand` will be
 * used to expand the entire URL.
 * @param  {Function} expand an optional function which applies further expansion to the URL before returning (currently urlExpander's expand method - this will be removed)
 * @param  {String} url a url or path to expand.
 * @param  {JSON} termMap a set of configuration for urlExpander's expand method.
 * @param  {Object} directModel a set of data used to expand the url template.
 * @return {String} resolved/expanded url.
 */
kettle.dataSource.urlResolver.resolve = function (expand, url, termMap, directModel) {
    var map = fluid.transform(termMap, function resolve(entry) {
        entry = "" + entry;
        if (entry.charAt(0) === "%") {
            entry = fluid.get(directModel, entry.substring(1));
        }
        entry = encodeURIComponent(entry);
        return entry;
    });
    var replaced = fluid.stringTemplate(url, map);
    replaced = (expand || fluid.identity)(replaced);
    return replaced;
};


/** STANDARD DATASOURCE GRADE HIERARCHY **/


// This table of standard data converter priorities will be removed when we have
// FLUID-5506 completed
// These are the priorities applied on READ from the dataSource
kettle.dataSource.priorities = {
    JSON: 100, // high priority - do this conversion first
    CouchDB: 90
};

kettle.dataSource.parse = function (string) {
    var togo;
    if (!string) {
        return undefined;
    }
    try {
        togo = JSON.parse(string);
    } catch (err) { // TODO: no test for this branch
        togo = fluid.promise();
        togo.reject({
            isError: true,
            error: err
        });
    }
    return togo;
};

kettle.dataSource.stringify = function (obj) {
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
    gradeNames: ["autoInit", "fluid.eventedComponent", "{that}.getWritableGrade"],
    components: {
        errback: {
            type: "kettle.dataSource.errback"
        }
    },
    events: {
        // events "onRead" and "onWrite" are operated in a custom workflow by fluid.fireTransformEvent to 
        // process dataSource payloads during the get and set process. Each listener
        // receives the data returned by the last. 
        onRead: null,
        onWrite: null,
        // As well as being exposed as a standard event, there is a standard listener to
        // this held in the "errback" component which operates a standard workflow of aborting any
        // current Kettle request with an error
        onError: null
    },
    listeners: {
        onRead: {
            funcName: "kettle.dataSource.parse",
            namespace: "JSON",
            priority: kettle.dataSource.priorities.JSON
        },
        onWrite: {
            funcName: "kettle.dataSource.stringify",
            namespace: "JSON",
            priority: kettle.dataSource.priorities.JSON
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
            args: ["{that}.options.writable", "{that}.typeName"]
        }
    },
    // In the case of parsing a response from a "set" request, only filters of these namespaces will be applied
    setResponseNamespaces: ["JSON"],
    writable: false
});

kettle.dataSource.getWritableGrade = function (writable, typeName) {
    if (writable) {
        return fluid.model.composeSegments(typeName, "writable");
    }
};

fluid.defaults("kettle.dataSource.writable", {
    gradeNames: ["autoInit", "fluid.eventedComponent"],
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
 * Errback component that handles errors when interacting with dataSource by
 * completing client request (through firing request's onError event).
 */
// TODO: Incorrect design which couples kettle's request architecture to dataSource
// error architecture. This should be broadcast down by a Kettle server, as well as 
// simply using a namespaced listener rather than a whole invoker
fluid.defaults("kettle.dataSource.errback", {
    gradeNames: ["autoInit", "fluid.eventedComponent"],
    events: {
        onError: "{dataSource}.events.onError"
    },
    listeners: {
        onError: "{that}.handleError"
    },
    invokers: {
        handleError: {
            funcName: "kettle.dataSource.errback.handleError",
            args: [
                "{requestProxy}",
                "{arguments}.0"
            ]
        }
    }
});

kettle.dataSource.errback.handleError = function (requestProxy, data) {
    requestProxy.events.onError.fire(data);
};

/**
 * A type of a data source specific to communicating with a URL resource.
 */
fluid.defaults("kettle.dataSource.URL", {
    gradeNames: ["kettle.dataSource", "autoInit"],
    components: {
        urlResolver: {
            type: "kettle.dataSource.urlResolver"
        }
    },
    invokers: {
        getImpl: {
            funcName: "kettle.dataSource.URL.handle",
            args: ["{urlResolver}", "{arguments}.0", "{arguments}.1"] // options, directModel
        }
    },
    termMap: {}
});

fluid.defaults("kettle.dataSource.URL.writable", {
    gradeNames: ["kettle.dataSource.writable", "autoInit"],
    invokers: {
        setImpl: {
            funcName: "kettle.dataSource.URL.handle",
            args: ["{urlResolver}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // options, directModel, model
        }
    }
});

/**
 * Handles calls to data source's (URL and CouchDB) get and set.
 * @param  {kettle.dataSource.urlResolver} A URLResolver that will convert the contents of the
 * <code>directModel</code> supplied as the 3rd argument into a concrete URL used for this
 * HTTP request.
 * @param  {JSON} options an options block that encodes:
 *     operation {String}: "set"/"get"
 *     writeMethod {String}: "PUT"/ "POST" (option - if not provided will be defaulted by the concrete
 * dataSource implementation)
 * @param  {Object} directModel a model holding the coordinates of the data to be read or written
 * @param  {Object} model [Optional] - the payload to be written by this write operation
 * @return {Promise} a promise for the successful or failed datasource operation
 */
kettle.dataSource.URL.handle = function (urlResolver, options, directModel, model) {
        // Expand URL.
    var url = urlResolver.resolve(directModel),
        // Test whether the URL is to a local file.
        isFileProtocol = kettle.dataSource.isFileProtocol(url),
        func = kettle.dataSource.URL.handle.http;
    if (isFileProtocol) {
        url = url.substring(7);
        func = kettle.dataSource.URL.handle.fs;
    }
    return func.apply(null, [url, options, model]);
};

kettle.dataSource.URL.handle.http = function (path, options, data) {
    var promise = fluid.promise(),
        urlObj = url.parse(path, true),
        requestOptions = {
            host: urlObj.hostname,
            port: parseInt(urlObj.port, 10),
            path: urlObj.path,
            method: "GET"
        },
        httpCallback = function (res) {
            var received = "";
            res.setEncoding("utf8");
            res.on("data", function onData(chunk) {
                received += chunk;
            });
            res.on("end", kettle.wrapCallback(
                function onEnd() {
                    promise.resolve(received);
                })
            );
        },
        errorCallback = function (error) {
            // TODO: determine whether this fires on a 404 before the "empty body" standard handler can execute
            promise.reject({
                isError: true,
                message: error.message
            });
        };
    if (options.operation === "set") {
        requestOptions.headers = {
            "Content-Type": "application/json",
            "Content-Length": data.length
        };
        requestOptions.method = options.writeMethod;
    }
    var req = http.request(requestOptions, kettle.wrapCallback(httpCallback));
    req.on("error", kettle.wrapCallback(errorCallback));
    req.end(data);
    return promise;
};

kettle.dataSource.URL.handle.fs = function (fileName, options, data) {
    var promise = fluid.promise(),
        method = "readFile",
        fsCallback = function (error, data) {
            if (error) {
                promise.reject({
                    isError: true,
                    message: error.message
                });
            } else {
                promise.resolve(options.operation === "set" ? undefined : data);
            }
        },
        args = [fileName, "utf8"];
    if (options.operation === "set") {
        method = "writeFile";
        args.splice(1, 0, data);
    } else {
        if (!fs.existsSync(fileName)) {
            promise.resolve(undefined); // dataSource semantics - read from nonexistent file produces undefined
            return;
        }
    }
    args.push(kettle.wrapCallback(fsCallback));
    fs[method].apply(null, args);
    return promise;
};

/**
 * Determines whether the URL is for local file system.
 * @param  {String} uri a uri to be tested.
 * @return {Boolean} true of file, otherwise false, assuming an url.
 */
kettle.dataSource.isFileProtocol = function (uri) {
    return /^file:\/\//.test(uri);
};


/**
 * A type of the URL data source specific to communicating with Couch DB.
 */
fluid.defaults("kettle.dataSource.CouchDB", {
    gradeNames: ["kettle.dataSource.URL", "autoInit"],
    listeners: {
        onRead: {
            funcName: "kettle.dataSource.CouchDB.read",
            namespace: "CouchDB",
            priority: kettle.dataSource.priorities.CouchDB
        }
    }
});

fluid.defaults("kettle.dataSource.CouchDB.writable", {
    gradeNames: ["kettle.dataSource.URL.writable", "autoInit"],
    listeners: {
        onWrite: {
            funcName: "kettle.dataSource.CouchDB.write",
            args: ["{that}", "{arguments}.0", "{arguments}.1"], // model, options
            namespace: "CouchDB",
            priority: kettle.dataSource.priorities.CouchDB
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
    var original = that.get(directModel, {filterNamespaces: ["JSON"]});
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
