/**
 * Kettle HTTP Methods Tests
 *
 * Copyright 2014 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/GPII/kettle/LICENSE.txt
 */
 
"use strict";

var fluid = require("infusion"),
    path = require("path"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.require("jqUnit"),
    configPath = path.resolve(__dirname, "./configs");
    
kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.testHTTPMethods");

// ----------------- GET HANDLING ------------------------
fluid.defaults("kettle.requests.request.handler.testMethodsGet", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testHTTPMethods.get",
            args: "{requestProxy}"
        }
    }
});

kettle.tests.testHTTPMethods.get = function (requestProxy) {
    jqUnit.assertTrue("GET request successfully received", true);
    requestProxy.events.onSuccess.fire("GET Call retrieved");
};

kettle.tests.testHTTPMethods.testGetResponse = function (data) {
    jqUnit.assertEquals("GET response successfully received", "GET Call retrieved", data);
};

// ----------------- POST HANDLING ------------------------
fluid.defaults("kettle.requests.request.handler.testMethodsPost", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testHTTPMethods.post",
            args: ["{requestProxy}", "{request}"]
        }
    }
});

kettle.tests.testHTTPMethods.post = function (requestProxy, request) {
    jqUnit.assertTrue("POST request successfully received", true);
    requestProxy.events.onSuccess.fire(request.req.body);
};

kettle.tests.testHTTPMethods.testPostResponse = function (data) {
    jqUnit.assertDeepEq("GET response successfully received", {
        "msg": "I am a POST request"
    }, JSON.parse(data));
};

// ----------------- PUT HANDLING ------------------------
fluid.defaults("kettle.requests.request.handler.testMethodsPut", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testHTTPMethods.put",
            args: ["{requestProxy}", "{request}"]
        }
    }
});

kettle.tests.testHTTPMethods.put = function (requestProxy, request) {
    jqUnit.assertTrue("PUT request successfully received", true);
    requestProxy.events.onSuccess.fire(request.req.body);
};

kettle.tests.testHTTPMethods.testPutResponse = function (data) {
    jqUnit.assertDeepEq("GET response successfully received", {
        "msg": "I am a PUT request"
    }, JSON.parse(data));
};

//------------- Test defs for GET, POST, PUT ---------------
var testDefs = [{
    name: "HTTPMethods GET test",
    expect: 2,
    config: {
        configName: "HTTPMethods",
        configPath: configPath
    },
    components: {
        getRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/",
                method: "GET",
            }
        }
    },
    sequence: [{
        func: "{getRequest}.send"
    }, {
        event: "{getRequest}.events.onComplete",
        listener: "kettle.tests.testHTTPMethods.testGetResponse"
    }]
}, { // POST test
    name: "HTTPMethods POST test",
    expect: 2,
    config: {
        configName: "HTTPMethods",
        configPath: configPath
    },
    components: {
        postRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/",
                method: "POST",
            }
        }
    },
    sequence: [{
        func: "{postRequest}.send",
        args: { "msg": "I am a POST request" }
    }, {
        event: "{postRequest}.events.onComplete",
        listener: "kettle.tests.testHTTPMethods.testPostResponse"
    }]
}, { // PUT test
    name: "HTTPMethods PUT test",
    expect: 2,
    config: {
        configName: "HTTPMethods",
        configPath: configPath
    },
    components: {
        putRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/",
                method: "PUT",
            }
        }
    },
    sequence: [{
        func: "{putRequest}.send",
        args: { "msg": "I am a PUT request" }
    }, {
        event: "{putRequest}.events.onComplete",
        listener: "kettle.tests.testHTTPMethods.testPutResponse"
    }]
}, { // PUT & POST combo test
    name: "HTTPMethods PUT & POST in sequence test",
    expect: 6,
    config: {
        configName: "HTTPMethods",
        configPath: configPath
    },
    components: {
        postRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/",
                method: "POST",
            }
        },
        putRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/",
                method: "PUT",
            }
        }
    },
    sequence: [{
        func: "{postRequest}.send",
        args: { "msg": "I am a POST request" }
    }, {
        event: "{postRequest}.events.onComplete",
        listener: "kettle.tests.testHTTPMethods.testPostResponse"
    }, {
        func: "{putRequest}.send",
        args: { "msg": "I am a PUT request" }
    }, {
        event: "{putRequest}.events.onComplete",
        listener: "kettle.tests.testHTTPMethods.testPutResponse"
    }, {
        func: "{postRequest}.send",
        args: { "msg": "I am a POST request" }
    }, {
        event: "{postRequest}.events.onComplete",
        listener: "kettle.tests.testHTTPMethods.testPostResponse"
    }]
}];

kettle.test.bootstrapServer(testDefs);