/*!
Kettle Data Source

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        kettle = fluid.registerNamespace("kettle"),
        fs = require("fs"),
        http = require("http"),
        url = require("url"),
        when = require("when"),
        eUC = "encodeURIComponent:";

    /**
     * A data source component, also used as a grade. That is used as an
     * abstraction for a data resouce. Its methods include:
     *     get - to get the data from data resource
     *     set - to set the data (only if writable options is set as true)
     */
    fluid.defaults("kettle.dataSource", {
        gradeNames: ["autoInit", "fluid.littleComponent", "{that}.getWritable"],
        components: {
            errback: {
                type: "kettle.dataSource.errback"
            },
            modelParser: {
                type: "kettle.dataSource.modelParser"
            }
        },
        invokers: {
            get: "kettle.dataSource.get",
            getWritable: {
                funcName: "kettle.dataSource.getWritable",
                args: "{that}.options.writable"
            }
        },
        distributeOptions: {
            source: "{that}.options.responseParser",
            target: "{that > modelParser}.options.responseParser"
        },
        writable: false
    });

    kettle.dataSource.getWritable = function (writable) {
        if (writable) {
            return "kettle.dataSource.writable";
        }
    };

    fluid.defaults("kettle.dataSource.writable", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        invokers: {
            set: "kettle.dataSource.set"
        }
    });

    /**
     * Model parser component that does both parsing and stringification of json
     * payloads for a dataSource.
     */
    fluid.defaults("kettle.dataSource.modelParser", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        invokers: {
            stringify: {
                funcName: "kettle.dataSource.modelParser.stringify",
                args: "{arguments}.0"
            },
            parse: {
                funcName: "kettle.dataSource.modelParser.parse",
                args: ["{that}.options.responseParser", "{arguments}.0"]
            }
        }
    });

    /**
     * Parses the payload from the source of data.
     * @param  {Object} responseParser a function or a name of a
     * global function that parses the raw response data.
     * @param  {Object|String} data raw data from the source.
     */
    kettle.dataSource.modelParser.parse = function (responseParser, data) {
        if (!data) {
            return {
                isError: true,
                message: "Empty response."
            };
        }
        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (err) {
                fluid.fail(err);
            }
        }
        if (data && data.isError) {
            return data;
        }
        if (responseParser) {
            data = typeof responseParser === "string" ?
                fluid.invokeGlobalFunction(responseParser, [data]) :
                responseParser(data);
        }
        return data;
    };

    /**
     * Stringifies the data to be sent to the source (in no data does nothing).
     * @param {Object|String} a raw data to be sent to the source.
     */
    kettle.dataSource.modelParser.stringify = function (model) {
        if (!model) {
            return;
        }
        return typeof model === "string" ? model : JSON.stringify(model);
    };

    /**
     * Errback component that handles errors when interacting with dataSource by
     * completing client request (through firing request's onError event).
     */
    fluid.defaults("kettle.dataSource.errback", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        events: {
            onError: null
        },
        listeners: {
            onError: "{that}.handleError"
        },
        invokers: {
            handleError: {
                funcName: "kettle.dataSource.errback.handleError",
                args: [
                    "{callbackWrapper}",
                    "{requestProxy}",
                    "{arguments}.0"
                ]
            }
        }
    });

    /**
     * Fires "onError" event of requestsProxy - a lightweight wrapper for
     * requests component.
     * @param  {Object} callbackWrapper component that wraps a function in
     * context of current http request.
     * @param  {Object} requestProxy a wrapper for requests component.
     * @param  {Object} data an error payload.
     */
    kettle.dataSource.errback.handleError = function (callbackWrapper, requestProxy, data) {
        var fireOnError = callbackWrapper.wrap(requestProxy.events.onError.fire);
        fireOnError(data);
    };

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
     * Resolves (expands) a url or path in the current context.
     * @param  {Function} expand a method of urlExpander that expands values
     * within the url template.
     * @param  {String} url an actual url or path to expand.
     * @param  {JSON} termMap a set of configuration for urlExpander's expand
     * method.
     * @param  {Object} directModel a set of data used to expand the url
     * template.
     * @return {String} resolved/expanded url.
     */
    kettle.dataSource.urlResolver.resolve = function (expand, url, termMap, directModel) {
        var map = fluid.copy(termMap);
        map = fluid.transform(map, function resolve(entry) {
            var encode = false;
            if (entry.indexOf(eUC) === 0) {
                encode = true;
                entry = entry.substring(eUC.length);
            }
            if (entry.charAt(0) === "%") {
                entry = fluid.get(directModel, entry.substring(1));
            }
            if (encode) {
                entry = encodeURIComponent(entry);
            }
            return entry;
        });
        var replaced = fluid.stringTemplate(url, map);
        replaced = expand(replaced);
        return replaced;
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
        termMap: {},
        writeMethod: "POST"
    });

    /**
     * A type of the URL data source specific to communicating with Couch DB.
     */
    fluid.defaults("kettle.dataSource.CouchDB", {
        gradeNames: ["kettle.dataSource.URL", "autoInit"],
        writeMethod: "PUT",
        finalInitFunction: "kettle.dataSource.CouchDB.finalInit"
    });

    /**
     * Cleans up couch specific fields from returned document.
     * @param  {Function} callback.
     */
    kettle.dataSource.CouchDB.wrapCallback = function (callback) {
        return function wrappedCallback(resp) {
            var value = resp.value;
            if (resp.error) {
                value = {
                    isError: true,
                    message: resp.error + ": " + resp.reason
                };
            }
            callback(value);
        };
    };

    kettle.dataSource.CouchDB.finalInit = function (that) {
        var originalGet = that.get, originalSet;

        that.get = function (directModel, callback) {
            var couchDBCallback = kettle.dataSource.CouchDB.wrapCallback(
                callback);
            originalGet.apply(null, [directModel, couchDBCallback]);
        };

        if (!that.options.writable) {
            return;
        }
        originalSet = that.set;
        that.set = function set(directModel, model, callback) {
            model = {value: model};
            var couchDBCallback = kettle.dataSource.CouchDB.wrapCallback(
                callback);
            originalGet(directModel, function onSuccess(resp) {
                if (!resp.error) {
                    model._id = resp._id;
                    model._rev = resp._rev;
                }
                originalSet.apply(null, [directModel, model, couchDBCallback]);
            });
        };
    };

    fluid.demands("kettle.dataSource.get", "kettle.dataSource.URL", {
        funcName: "kettle.dataSource.URL.handle",
        args: [{
            urlResolver: "{urlResolver}",
            errback: "{errback}",
            modelParser: "{modelParser}",
            callbackWrapper: "{callbackWrapper}"
        }, "{arguments}.0", "{arguments}.1"]
    });

    fluid.demands("kettle.dataSource.set", "kettle.dataSource.URL", {
        funcName: "kettle.dataSource.URL.handle",
        args: [{
            urlResolver: "{urlResolver}",
            errback: "{errback}",
            modelParser: "{modelParser}",
            callbackWrapper: "{callbackWrapper}",
            writeMethod: "{dataSource}.options.writeMethod"
        }, "{arguments}.0", "{arguments}.2", "{arguments}.1"]
    });

    /**
     * Handles calls to data source's (URL and CouchDB) get and set.
     * @param  {JSON} options an options block that contains urlResolver,
     * errback, modelParser and writeMethod ("POST" or "PUT").
     * @param  {Object} directModel a collection of variables used to expand a
     * url.
     * @param  {Function} callback that is called when data is sent/received
     * from the URL.
     * @param  {String|Object} model a payload returned from the set/get
     * operation.
     */
    kettle.dataSource.URL.handle = function (options, directModel, callback, model) {
            // Expand URL.
        var url = options.urlResolver.resolve(directModel),
            // Test whether the URL is to a local file.
            isFileProtocol = kettle.dataSource.isFileProtocol(url),
            func = kettle.dataSource.URL.handle.url,
            oldCallback = callback,
            parse = options.modelParser.parse;
        if (isFileProtocol) {
            url = url.substring(7);
            func = kettle.dataSource.URL.handle.fs;
        }
        options.fireOnError = options.errback.events.onError.fire;
        if (options.callbackWrapper) {
            options.fireOnError = options.callbackWrapper.wrap(
                options.fireOnError);
            parse = options.callbackWrapper.wrap(options.modelParser.parse);
        }
        callback = function callback(data) {
            data = parse(data);
            if (data && data.isError) {
                options.fireOnError(data);
                return;
            }
            oldCallback(data);
        };
        // If model exists and is an object - stringify it.
        model = options.modelParser.stringify(model);
        func.apply(null, [url, options, callback, model]);
    };

    kettle.dataSource.URL.handle.url = function (path, options, callback, model) {
        var urlObj = url.parse(path, true),
            opts = {
                host: urlObj.hostname,
                port: parseInt(urlObj.port, 10),
                path: urlObj.path,
                method: "GET"
            };
        if (model) {
            opts.headers = {
                "Content-Type": "application/json",
                "Content-Length": model.length
            };
            opts.method = options.writeMethod;
        }
        var req = http.request(opts, function onRes(res) {
            var data = "";
            res.setEncoding("utf8");
            res.on("data", function onData(chunk) {
                data += chunk;
            });
            res.on("end", function onEnd() {
                callback(data);
            });
        });
        req.on("error", function onError(error) {
            options.fireOnError({
                isError: true,
                message: error.message
            });
        });
        req.end(model);
        return req;
    };

    kettle.dataSource.URL.handle.fs = function (fileName, options, callback, model) {
        var method = "readFile",
            args = [fileName, "utf8", function onFsMethod(error, data) {
                if (error) {
                    options.fireOnError({
                        isError: true,
                        message: error.message
                    });
                    return;
                }
                callback(data || model);
            }];
        if (model) {
            method = "writeFile";
            args.splice(1, 0, model);
        }
        fs[method].apply(null, args);
    };

    /**
     * Determines whether the URL is for local file system.
     * @param  {String} uri a uri to be tested.
     * @return {Boolean} true of file, otherwise false, assuming an url.
     */
    kettle.dataSource.isFileProtocol = function (uri) {
        return /^file:\/\//.test(uri);
    };

    fluid.defaults("kettle.dataSource.promiseCallbackWrapper", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        components: {
            callbackWrapper: "{callbackWrapper}"
        }
    });

    kettle.dataSource.promiseCallbackWrapper.finalInit = function (that) {
        fluid.each(["get", "set"], function wrapMethod(method) {
            var originalMethod = that[method];
            if (!originalMethod) {
                return;
            }
            that[method] = function wrappedMethod() {
                var deferred = when.defer(),
                    promise = deferred.promise, promiseImpl = {},
                    args = fluid.makeArray(arguments),
                    wrap = that.callbackWrapper.wrap;

                // We can not directly modify when's then method. It is set to
                // be non-writable (Throws TypeError if we try to assignment
                // operator).
                promiseImpl.then = function then(callback) {
                    promise.then.apply(null, [wrap(callback)]);
                };

                args.push(wrap(function wrappedCallback() {
                    deferred.resolve.apply(null, fluid.makeArray(arguments));
                }));
                originalMethod.apply(null, args);

                return promiseImpl;
            };
        });
    };

    /**
     * An wrapper (adapter) data source that takes an original data source
     * context of current request.
     */
    fluid.defaults("kettle.dataSource.callbackWrapper", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        components: {
            callbackWrapper: "{callbackWrapper}"
        }
    });

    kettle.dataSource.callbackWrapper.finalInit = function (that) {
        fluid.each(["get", "set"], function wrapMethod(method) {
            var originalMethod = that[method];
            if (!originalMethod) {
                return;
            }
            that[method] = function wrappedMethod() {
                var args = fluid.makeArray(arguments),
                    callback = args[args.length - 1];
                args[args.length - 1] = that.callbackWrapper.wrap(callback);
                originalMethod.apply(null, args);
            };
        });
    };

})();
