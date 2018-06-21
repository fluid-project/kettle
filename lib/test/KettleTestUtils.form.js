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
    FormData = require("form-data"),
    fs = require("fs");

fluid.registerNamespace("kettle.test");

// A component that sends multipart/form-data via POST
// using the form-data module
// Can be used to send both files and fields
// Used currently for testing the multer-based middleware
//
fluid.defaults("kettle.test.request.formData", {
    gradeNames: ["kettle.test.request.http"],
    listeners: {
        "send.sendPayload": {
            funcName: "kettle.test.request.formData.sendPayload",
            args: ["{that}", "{arguments}.0"]
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

kettle.test.request.formData.sendPayload = function (that) {

    var requestOptions = that.options;
    var req = that.nativeRequest;
    var form = new FormData();

    // Append all files to form
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

    // Append all fields to form
    fluid.each(requestOptions.formData.fields, function (fieldValue, fieldKey) {
        form.append(fieldKey, fieldValue);
    });

    // Set the request headers from the form
    var formHeaders = form.getHeaders();

    fluid.each(formHeaders, function (value, name) {
        req.setHeader(name, value);
    });

    // Calculate the length and set the header,
    // then send the request; we need to do this
    // using the async method, as noted at
    // https://github.com/form-data/form-data#notes

    form.getLength(function (arg1, knownLength) {
        req.setHeader("Content-Length", knownLength);
        form.pipe(req);
    });
};
