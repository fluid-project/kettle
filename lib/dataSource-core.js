/*!
Kettle Core DataSource definitions - portable to browser and node.js

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
*/

"use strict";

var fluid = fluid || require("infusion"),
    jsonlint = jsonlint || (require && require("jsonlint")),
    kettle = fluid.registerNamespace("kettle"),
    JSON5 = JSON5 || require("json5");

fluid.require("querystring", require, "kettle.npm.querystring");

/** Some common content encodings - suitable to appear as the "encoding" subcomponent of a dataSource **/

fluid.defaults("kettle.dataSource.encoding.JSON", {
    gradeNames: "fluid.component",
    invokers: {
        parse: "kettle.dataSource.parseJSON",
        render: "kettle.dataSource.stringifyJSON"
    },
    contentType: "application/json"
});

fluid.defaults("kettle.dataSource.encoding.JSON5", {
    gradeNames: "fluid.component",
    invokers: {
        parse: "kettle.dataSource.parseJSON5",
        render: "kettle.dataSource.stringifyJSON5"
    },
    contentType: "application/json5"
});

fluid.defaults("kettle.dataSource.encoding.formenc", {
    gradeNames: "fluid.component",
    invokers: {
        parse:  "kettle.npm.querystring.parse({arguments}.0)",
        render: "kettle.npm.querystring.stringify({arguments}.0)"
    },
    contentType: "application/x-www-form-urlencoded"
});

// Patch the core JSON encoding from Infusion to use our JISON parser in Kettle for better diagnostics
fluid.makeGradeLinkage("kettle.dataSource.encoding.linkage.JSON", ["fluid.dataSource.encoding.JSON"], "kettle.dataSource.encoding.JSON");

/** Definitions for parsing JSON using jsonlint to render errors **/

kettle.dataSource.JSONParseErrors = [];

kettle.dataSource.accumulateJSONError = function (str, hash) {
    var error = "JSON parse error at line " + hash.loc.first_line + ", col " + hash.loc.last_column + ", found: \'" + hash.token + "\' - expected: " + hash.expected.join(", ");
    kettle.dataSource.JSONParseErrors.push(error);
};

// Adapt to shitty integration model of JISON-based parsers - beware that any other user of this module will find it permanently corrupted
// TODO: Unfortunately the parser has no error recovery states - this can only ever accumulate a single error
jsonlint.parser.parseError = jsonlint.parser.lexer.parseError = kettle.dataSource.accumulateJSONError;

/** Given a String to be parsed as JSON, which has already failed to parse by JSON.parse, reject the supplied promise with
 * a readable diagnostic. If jsonlint was not loaded, simply return the original diagnostic.
 * @param {String} string - The string to be parsed
 * @param {Error} err - The exception provided by JSON.parse on the string
 * @param {Promise} promise - The promise to be rejected with a readable diagnostic
 */
kettle.dataSource.renderJSONDiagnostic = function (string, err, promise) {
    if (!jsonlint) { // TODO: More principled context detection
        promise.reject(err.toString());
    }
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

/** Given a String encoding a JSON value, return a promise in which it has been parsed into JSON, or else rejected
 * with a readable diagnostic (more readable than node.js native JSON.parse output)
 * @param {String} string - A string holding a JSON value
 * @return {Promise} A promise yielding either the successfully parsed JSON value, or a rejection holding a readable diagnostic
 */
kettle.dataSource.parseJSON = function (string) {
    var togo = fluid.promise();
    if (!string) {
        togo.resolve(undefined);
    } else {
        try {
            togo.resolve(JSON.parse(string));
        } catch (err) {
            kettle.dataSource.renderJSONDiagnostic(string, err, togo);
        }
    }
    return togo;
};

/** Render a JSON or undefined value into a string. The default formatting indents with 4 spaces.
 * @param {Any} obj - The value to be encoded as JSON. In addition, the value `undefined` will be encoded to the empty string
 * @return {String} The encoded value
 */
kettle.dataSource.stringifyJSON = function (obj) {
    return obj === undefined ? "" : JSON.stringify(obj, null, 4);
};

/** Given a String encoding a JSON5 value, return a promise in which it has been parsed into JSON, or else rejected
 * with a readable diagnostic.
 * @param {String} string - A string holding a JSON5 value
 * @return {Promise} A promise yielding either the successfully parsed JSON5 value, or a rejection holding a readable diagnostic
 */
kettle.dataSource.parseJSON5 = function (string) {
    var togo = fluid.promise();
    if (!string) {
        togo.resolve(undefined);
    } else {
        try {
            togo.resolve(JSON5.parse(string));
        } catch (err) {
            togo.reject({
                message: err.message || err
            });
        }
    }
    return togo;
};

/** Render a JSON5 or undefined value into a string. The default formatting indents with 4 spaces.
 * @param {Any} obj - The value to be encoded as JSON5. In addition, the value `undefined` will be encoded to the empty string
 * @return {String} The encoded value
 */
kettle.dataSource.stringifyJSON5 = function (obj) {
    return obj === undefined ? "" : JSON5.stringify(obj, null, 4);
};

/** A mixin grade for a dataSource which automatically expands any %terms corresponding to module names registered in Infusion's module database */

fluid.defaults("kettle.dataSource.moduleTerms", {
    termMap: "@expand:fluid.module.terms()"
});

/**
 * A mixin grade for a data source suitable for communicating with the /{db}/{docid} URL space of CouchDB for simple CRUD-style reading and writing
 */

fluid.defaults("kettle.dataSource.CouchDB", {
    // Link on to the existing writable: true flag maintained by a core fluid.dataSource
    contextAwareness: {
        writableCouchDB: {
            checks: {
                writableCouchDB: {
                    contextValue: "{fluid.dataSource}.options.writable",
                    // Note that it would be preferable for gradeNames to form a hash as in FLUID-6439 so that we could
                    // override it selectively rather than to duplicate the entire contextAwareness definition as here
                    gradeNames: "kettle.dataSource.CouchDB.writable"
                }
            }
        }
    },
    mergePolicy: {
        "rules": "nomerge"
    },
    rules: {
        writePayload: {
            value: ""
        },
        readPayload: {
            "": "value"
        }
    },
    listeners: {
        onRead: {
            funcName: "kettle.dataSource.CouchDB.read",
            args: ["{that}", "{arguments}.0"], // response
            namespace: "CouchDB",
            priority: "after:encoding"
        }
    }
});

/**
 * A pure mixin grade operating write logic for a CouchDB-backed dataSource. This performs a "read before write" strategy
 * in order to minimise the possibility of a write conflict, at the risk of overwriting a previous update. This grade
 * is configured automatically when the "writable: true" option is supplied to a "kettle.dataSource.CouchDB" source and
 * should not be configured directly by the user.
 */

fluid.defaults("kettle.dataSource.CouchDB.writable", {
    listeners: {
        onWrite: {
            funcName: "kettle.dataSource.CouchDB.write",
            args: ["{that}", "{arguments}.0", "{arguments}.1"], // model, options
            namespace: "CouchDB",
            priority: "before:encoding"
        }
    }
});

/**
 * Convert a dataSource payload from CouchDB-encoded form -
 *
 * i)  Decode a Couch error response into a promise failure
 *
 * ii) Transform the output from CouchDB using `that.options.rules.readPayload`. The default rules reverse the default
 *     "value" encoding used by `kettle.dataSource.CouchDB.write` (see below).
 * @param {Component} that - The dataSource component, used to read the payload read transform option
 * @param {Object} response - JSON-parsed response as received from CouchDB
 * @return {Object} The transformed return payload
 */
kettle.dataSource.CouchDB.read = function (that, response) {
    // if undefined, pass that through as per dataSource (just for consistency in FS-backed tests)
    var togo;
    if (response === undefined) {
        togo = undefined;
    } else {
        if (response.error) {
            var error = {
                isError: true,
                statusCode: response.statusCode,
                message: response.error + ": " + response.reason
            };
            togo = fluid.promise();
            togo.reject(error);
        } else {
            togo = fluid.model.transformWithRules(response, that.options.rules.readPayload);
        }
    }
    return togo;
};

/**
 * Convert `model` data for storage in CouchDB using the model transformation rules outlined in
 * `that.options.rules.writePayload`. By default, the entirety of the model is wrapped in a `value` element to avoid
 * collisions with top-level CouchDB variables such as `_id` and `_rev`.
 *
 * @param {Component} that - The dataSource component, used to read the payload write transform option
 * @param {Object} model - The data to be stored
 * @param {Object} options - The dataSource's request options (see above)
 * @return {Promise} A promise which resolves to the transformed, written payload
 */
kettle.dataSource.CouchDB.write = function (that, model, options) {
    var directModel = options.directModel;
    var doc = fluid.model.transformWithRules(model, that.options.rules.writePayload);
    var original = that.get(directModel, {filterNamespaces: ["impl", "encoding"], notFoundIsEmpty: true});
    var togo = fluid.promise();
    original.then(function (originalDoc) {
        if (originalDoc) {
            doc._id = originalDoc._id;
            doc._rev = originalDoc._rev;
        }
        togo.resolve(doc);
    }, togo.reject);
    return togo;
};
