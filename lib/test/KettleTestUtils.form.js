/*
Kettle Test Utilities - Forms

Contains facilities for submitting multipart forms

Copyright 2018 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    http = require("http"),
    jqUnit = fluid.require("node-jqunit", require, "jqUnit"),
    FormData = require("form-data"),
    fs = require("fs");

fluid.registerNamespace("kettle.test");

// A component that sends multipart/form-data via POST
// using the form-data module
// Can be used to send both files and fields
// Used currently for testing the multer-based middleware
//
// TODO: Should elements of this and kettle.test.request.http be merged?
// How to best do this while maintaing backwards compatibility?
fluid.defaults("kettle.test.request.formData", {
    gradeNames: ["kettle.test.request"],
    events: { // this will fire with the signature (data, that)
        onComplete: null
    },
    invokers: {
        send: {
            funcName: "kettle.test.request.formData.send",
            args: ["{that}", "{that}.events.onComplete.fire"]
        }
    },
    formData: {
        // key-value structure where key will be the appended field
        // name and the value is one of
        // 1. the path to a file to be attached
        // 2. an array of file paths
        files: {
            // "file": "./LICENSE.txt"
            // "files": "./LICENSE.txt, ./README.md"
        },
        fields: {
            // key-value structure where key will be the appended field
            // name and the value is the string value to be associated
        }
    }
});

kettle.test.request.formData.send = function (that, callback) {

    var requestOptions = that.options;

    var submitURL = "http://" + requestOptions.hostname + ":" + requestOptions.port + requestOptions.path;

    var form = new FormData();

    // Append all files
    fluid.each(requestOptions.formData.files, function (filePath, fieldKey) {
        // Single file path
        if (typeof filePath === "string") {
            form.append(fieldKey, fs.createReadStream(filePath));
        // Array of file paths
        } else if (Array.isArray(filePath)) {
            fluid.each(filePath, function (arrayFilePath) {
                form.append(fieldKey, fs.createReadStream(arrayFilePath));
            });
        }
    });

    // Append all fields
    fluid.each(requestOptions.formData.fields, function (fieldValue, fieldKey) {
        form.append(fieldKey, fieldValue);
    });

    fluid.log("Posting form to path ", requestOptions.path, " on port " + requestOptions.port);

    form.submit(submitURL, function (err, res) {
        var data = "";
        res.setEncoding("utf8");
        res.on("data", function (chunk) {
            data += chunk;
        });

        res.on("close", function (err) {
            if (err) {
                fluid.fail("Error posting form " + err.message);
            }
        });

        res.on("end", function () {
            callback(data, that);
        });
    });
};
