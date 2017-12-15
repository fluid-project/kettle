/**
 * Kettle HTTP Methods Tests
 *
 * Copyright 2014-2015 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.registerNamespace("jqUnit");

kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.multer");

fluid.defaults("kettle.tests.multer.handler.single", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "multerSingle": {
            middleware: "{server}.infusionMulterSingle"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.multerHandlerSingle"
        }
    }
});

// Sends the info about the uploaded file
kettle.tests.multerHandlerSingle = function (request) {
    request.events.onSuccess.fire(request.req.file);
};

fluid.defaults("kettle.tests.multer.handler.array", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "multerArray": {
            middleware: "{server}.infusionMulterArray"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.multerHandlerArray"
        }
    }
});

// Sends the info about the uploaded files
kettle.tests.multerHandlerArray = function (request) {
    request.events.onSuccess.fire(request.req.files);
};

kettle.tests["multer"].testDefs = [{
    name: "Multer tests",
    expect: 6,
    config: {
        configName: "kettle.tests.multer.config",
        configPath: "%kettle/tests/configs"
    },
    components: {
        singleFileUpload: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-single",
                method: "POST",
                formData: {
                    files: {
                        "file": "./LICENSE.txt"
                    }
                }
            }
        },
        arrayFileUpload: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-array",
                method: "POST",
                formData: {
                    files: {
                        "files": ["./README.md", "./LICENSE.txt"]
                    }
                }
            }
        },
        arrayFileUploadTooMany: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-array",
                method: "POST",
                formData: {
                    files: {
                        "files": ["./README.md", "./LICENSE.txt", "./History.md"]
                    }
                }
            }
        }
    },
    sequence: [{
        func: "{singleFileUpload}.send"
    }, {
        event: "{singleFileUpload}.events.onComplete",
        listener: "kettle.test.testMulterSingle"
    },{
        func: "{arrayFileUpload}.send"
    },{
        event: "{arrayFileUpload}.events.onComplete",
        listener: "kettle.test.testMulterArray"
    },{
        func: "{arrayFileUploadTooMany}.send"
    },{
        event: "{arrayFileUploadTooMany}.events.onComplete",
        listener: "kettle.test.testMulterArrayTooMany"
    }]
}];

kettle.test.testMulterSingle = function (fileInfo, that) {
    var parsedFileInfo = JSON.parse(fileInfo);
    jqUnit.assertEquals("file name is expected", "LICENSE.txt", parsedFileInfo.originalname);
};

kettle.test.testMulterArray = function (filesInfo, that) {
    var parsedFilesInfo = JSON.parse(filesInfo);
    var expectedFileNames = ["README.md", "LICENSE.txt"]; jqUnit.assertEquals("files length is expected", 2, parsedFilesInfo.length);
    fluid.each(parsedFilesInfo, function (fileInfo, idx) {
        jqUnit.assertEquals("file name is expected", expectedFileNames[idx], fileInfo.originalname);
    });

};

kettle.test.testMulterArrayTooMany = function (filesInfo) {
    var parsedFilesInfo = JSON.parse(filesInfo);
    jqUnit.assertTrue("Trying to upload more files than the maxcount throws an error", parsedFilesInfo.isError);
    jqUnit.assertEquals("Error code is expected multer LIMIT_UNEXPECTED_FILE code", "LIMIT_UNEXPECTED_FILE", parsedFilesInfo.code)
};

kettle.test.bootstrapServer(kettle.tests["multer"].testDefs);
