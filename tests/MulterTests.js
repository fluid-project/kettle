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

fluid.defaults("kettle.tests.multer.handler", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "multer": {
            middleware: "{server}.infusionMulter"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.multerHandler"
        }
    }
});

kettle.tests.multerHandler = function (request) {
    request.events.onSuccess.fire(request.req.file);
};


//------------- Test defs for GET, POST, PUT ---------------
kettle.tests["multer"].testDefs = [{
    name: "Multer POST test",
    expect: 1,
    config: {
        configName: "kettle.tests.multer.config",
        configPath: "%kettle/tests/configs"
    },
    components: {
        singleFileUpload: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer/1",
                method: "POST",
                formData: {
                    files: {
                        "file": "./LICENSE.txt"
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
    }]
}];

kettle.test.testMulterSingle = function (fileInfo, that) {
    var parsedFileInfo = JSON.parse(fileInfo);
    jqUnit.assertEquals("file name is expected", "LICENSE.txt", parsedFileInfo.originalname);
};

kettle.test.bootstrapServer(kettle.tests["multer"].testDefs);
