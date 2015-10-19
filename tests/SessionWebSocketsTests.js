/**
 * Kettle WebSockets Session tests
 *
 * Copyright 2015 Raising the Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/GPII/kettle/LICENSE.txt
 */
 
"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.require("jqUnit");
    
require("./shared/SessionTestDefs.js");

fluid.defaults("kettle.tests.session.ws.testSocket.handler", {
    gradeNames: ["kettle.request.ws", "kettle.request.sessionAware", "kettle.tests.session.handler.validating"],
    listeners: {
        onReceiveMessage: "kettle.tests.session.ws.testSocket.receiveMessage"
    }
});

kettle.tests.session.ws.testSocket.receiveMessage = function (request) {
    var session = request.req.session;
    jqUnit.assertValue("Received socket message from qualified session", session);
    console.log("testSocket.receiveMessage got session ", session);
    jqUnit.assertEquals("Session data retrieved from HTTP request", kettle.tests.session.token, session.token);
    var response = fluid.extend(true, {
        token: session.token
    }, kettle.tests.session.response.success);
    request.events.onSendMessage.fire(response);
};

kettle.tests.session.ws.proto = {
    name: "WebSockets Session tests",
    expect: 31,
    config: {
        configName: "kettle.tests.session.webSockets.config",
        configPath: "%kettle/tests/configs"
    },
    components: {
        wsRequest: {
            type: "kettle.test.request.wsCookie",
            options: {
                path: "/socket_path"
            }
        },
        badRequest: {
            type: "kettle.test.request.ws",
            options: {
                path: "/socket_path"
            }
        }
    }
};

kettle.tests.session.ws.testSocketResponse = function (that, data) {
    jqUnit.assertDeepEq("Received session-qualified socket response", kettle.tests.session.response.midSuccess, data);
};

kettle.tests.session.ws.midSequence = [
    {
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
        event: "{wsRequest}.events.onMessage",
        listener: "kettle.tests.session.ws.testSocketResponse"
    }, {
        func: "{badRequest}.connect"
    }, {
        event: "{badRequest}.events.onError",
        listener: "kettle.test.assertErrorResponse",
        args: {
            message: "Received 403 error for non-session qualified request to WebSockets endpoint",
            errorTexts: "HTTP",
            statusCode: 403,
            string: "{arguments}.1",
            request: "{badRequest}"
        }
    }
];

kettle.tests.session.ws.testDefs = fluid.extend(true, {}, kettle.tests.session.testDefs, kettle.tests.session.ws.proto);

kettle.tests.session.ws.spliceSequence = function () {
    // TODO: backport DISRUPTOR from GPII's CloudBasedOAuth2.js
    kettle.test.insertIntoArray(kettle.tests.session.ws.testDefs.sequence, 8, kettle.tests.session.ws.midSequence);
};

kettle.tests.session.ws.spliceSequence();

kettle.test.bootstrapServer(kettle.tests.session.ws.testDefs);