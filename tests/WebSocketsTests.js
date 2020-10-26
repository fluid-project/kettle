/**
 * Kettle Socket Support Tests
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.require("node-jqunit", require, "jqUnit");

kettle.loadTestingSupport();

fluid.defaults("kettle.tests.ws.testSocket.handler", {
    gradeNames: "kettle.request.ws",
    listeners: {
        onReceiveMessage: "kettle.tests.ws.testSocket.receiveMessage"
    }
});

kettle.tests.ws.successResponse = {
    success: true
};


kettle.tests.ws.messageCount = 0;

kettle.tests.ws.testSocket.receiveMessage = function (request, data) {
    jqUnit.assertDeepEq("Socket message data is correct", {
        index: kettle.tests.ws.messageCount++,
        test: true
    }, data);
    var promise = request.sendMessage(kettle.tests.ws.successResponse);
    // Interestingly we can do close EITHER synchronously OR asynchronously, but
    // we cannot do terminate EITHER synchronously OR asynchronously - so there's little
    // value currently to listening to the promise, but it's there as a courtesy
    if (data.index === 1) {
        request.ws.close(); // leave this here for early warning if synchronous close fails in future
        promise.then(function () {
            request.ws.close();
        });
    }
};

fluid.defaults("kettle.tests.ws.testGet.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.ws.testGet.handleRequest"
        }
    }
});

kettle.tests.ws.testGet.handleRequest = function (request) {
    jqUnit.assertTrue("The request was received.", true);
    request.events.onSuccess.fire(kettle.tests.ws.successResponse);
};

kettle.tests.ws.testSocketResponse = function (data) {
    jqUnit.assertDeepEq("Socket message delivered confirmed", {
        success: true
    }, data);
};

kettle.tests.ws.testSocketError = function (err, that) {
    kettle.test.assertErrorResponse({
        request: that,
        message: "Received WebSockets error event applying to plain HTTP endpoint",
        string: err,
        errorTexts: ["WebSockets", "HTTP"],
        statusCode: 400
    });
};

fluid.defaults("kettle.tests.ws.testClose.handler", {
    gradeNames: "kettle.request.ws",
    listeners: {
        onReceiveMessage: "kettle.tests.ws.testClose.receiveMessage"
    }
});

kettle.tests.ws.testClose.receiveMessage = function (request) {
    // close the WebSocket with the status code for normal closure
    request.ws.close(1000);
};

kettle.tests.ws.assertCloseResponse = function (response) {
    jqUnit.assertEquals("Socket close response code is 1000", 1000, response.code);
};

kettle.tests.ws.testDefs = {
    name: "WebSockets tests",
    expect: 17,
    config: {
        configName: "kettle.tests.webSockets.config",
        configPath: "%kettle/tests/configs"
    },
    components: {
        httpRequest: {
            type: "kettle.test.request.http"
        },
        badHttpRequest: { // A "bad" request that attempts to connect to a WS endpoint via plain HTTP
            type: "kettle.test.request.http",
            options: {
                path: "/socket_path"
            }
        },
        wsRequest: {
            type: "kettle.test.request.ws",
            options: {
                path: "/socket_path"
            }
        },
        badWsRequest: {
            type: "kettle.test.request.ws",
            options: {
                path: "/"
            }
        },
        closingWsRequest: {
            type: "kettle.test.request.ws",
            options: {
                path: "/close_path"
            }
        }
    },
    sequence: [{
        func: "{wsRequest}.connect"
    }, {
        event: "{wsRequest}.events.onConnect",
        listener: "jqUnit.assert",
        args: "Received WebSockets connection event"
    }, {
        func: "{wsRequest}.send",
        args: {
            index: 0,
            test: true
        }
    }, {
        event: "{wsRequest}.events.onReceiveMessage",
        listener: "kettle.tests.ws.testSocketResponse"
    }, {
        func: "{wsRequest}.send",
        args: {
            index: 1,
            test: true
        }
    }, {
        event: "{wsRequest}.events.onReceiveMessage",
        listener: "kettle.tests.ws.testSocketResponse"
    }, {
        func: "{httpRequest}.send"
    }, {
        event: "{httpRequest}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Received standard response to HTTP handler attached to ws-aware server",
            expected: kettle.tests.ws.successResponse,
            string: "{arguments}.0",
            request: "{httpRequest}"
        }
    }, {
        func: "{badHttpRequest}.send"
    }, {
        event: "{badHttpRequest}.events.onComplete",
        listener: "kettle.test.assertErrorResponse",
        args: {
            message: "Received 426 error for plain HTTP request to WebSockets endpoint",
            errorTexts: "WebSockets",
            statusCode: 426,
            string: "{arguments}.0",
            request: "{badHttpRequest}"
        }
    }, {
        func: "{badWsRequest}.connect"
    }, {
        event: "{badWsRequest}.events.onError",
        listener: "kettle.tests.ws.testSocketError"
    }, {
        func: "{closingWsRequest}.connect"
    }, {
        event: "{closingWsRequest}.events.onConnect",
        listener: "jqUnit.assert",
        args: "Received WebSockets connection event"
    }, {
        func: "{closingWsRequest}.send",
        args: {}
    }, {
        event: "{closingWsRequest}.events.onClose",
        listener: "kettle.tests.ws.assertCloseResponse",
        args: "{arguments}.1"
    }
]
};

kettle.test.bootstrapServer(kettle.tests.ws.testDefs);
