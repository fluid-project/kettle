/*!
Kettle Data Source Request Tests

Copyright 2014 Lucendo Development Ltd.

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/GPII/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
     kettle = require("../kettle.js"),
     jqUnit = fluid.require("jqUnit");
 
kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.dataSource");


// These tests set up two Kettle servers, with a dataSource to mediate between them. This is a very
// common use case, where a server provides a modified or proxied view onto another one. This suite
// tests the action of the kettle.dataSource.URL dataSource both reading and writing, as well as the
// "special pathway" which applies limited filtering to any returned payload from a "set" response
// (typically just JSON parsing). It also tests the action of some of the callback wrapping applied
// in the dataSource implementation in order to recontextualise the new stack frame with an existing
// Kettle request.

// These tests could be improved further to test the action of the various failure pathways through 
// the net of promises/dataSources - as well as verifying the proper treatment of the direct payloads
// themselves

// These tests are written in a simplified style avoiding the use of "configs" or any of the dedicated
// server-centred Kettle test boostrap functions - partially because we have two servers to fire up here
// rather than one, and partially to illustrate how this style of testing looks

kettle.tests.endpoint = function (type, requestProxy, request) {
    jqUnit.assertValue("Request proxy is resolvable", requestProxy.events.onSuccess);
    jqUnit.assertValue("Request is resolvable", request.events.onSuccess);
    var value = type === "get" ? 42 : {payload : "set return value"};
    // test operation of "request promise" as well as requirement for callback wrapper
    fluid.invokeLater(kettle.wrapCallback(function () {
        fluid.log("ENDPOINT Resolving with value ", value);
        request.requestPromise.resolve(JSON.stringify(value) + "\n");
    }));
};

fluid.defaults("kettle.requests.request.handler.getEndpoint", {
    gradeNames: ["autoInit", "fluid.littleComponent"],
    invokers: {
        handle: {
            funcName: "kettle.tests.endpoint",
            args: ["get", "{requestProxy}", "{request}"],
            dynamic: true
        }
    }
});

fluid.defaults("kettle.requests.request.handler.setEndpoint", {
    gradeNames: ["autoInit", "fluid.littleComponent"],
    invokers: {
        handle: {
            funcName: "kettle.tests.endpoint",
            args: ["set", "{requestProxy}", "{request}"],
            dynamic: true
        }
    }
});

kettle.tests.relay = function (type, dataSource, requestPromise) {
    var response = dataSource[type]();
    response.then(function (value) { // white-box testing for dataSource resolution
        var request = kettle.getCurrentRequest();
        jqUnit.assertValue("Callback to dataSource must be contextualised", request);
        if (type === "set") {
            jqUnit.assertEquals("dataSource set payload must have been parsed", "object", typeof(value));
        }
        requestPromise.resolve(value);
    }, function (error) {
        requestPromise.reject(error);
    });
};

fluid.defaults("kettle.requests.request.handler.getRelay", {
    gradeNames: ["autoInit", "fluid.littleComponent"],
    invokers: {
        handle: {
            funcName: "kettle.tests.relay",
            args: ["get", "{relayDataSource}", "{request}.requestPromise"],
            dynamic: true
        }
    }
});

fluid.defaults("kettle.requests.request.handler.setRelay", {
    gradeNames: ["autoInit", "fluid.littleComponent"],
    invokers: {
        handle: {
            funcName: "kettle.tests.relay",
            args: ["set", "{relayDataSource}", "{request}.requestPromise"],
            dynamic: true
        }
    }
});

fluid.defaults("kettle.tests.serverPair", {
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    components: {
        sourceServer: {
            type: "kettle.server",
            options: {
                port: 8085,
                components: {
                    sourceApp: {
                        type: "kettle.app",
                        options: {
                            handlers: {
                                getEndpoint: {
                                    route: "/endpoint",
                                    type: "get"
                                },
                                setEndpoint: {
                                    route: "/endpoint",
                                    type: "post"
                                }
                            }
                        }
                    }
                }
            }
        },
        relayServer: {
            type: "kettle.server",
            options: {
                port: 8086,
                components: {
                    relayDataSource: {
                        type: "kettle.dataSource.URL",
                        options: {
                            url: "http://localhost:8085/endpoint",
                            writable: true,
                            writeMethod: "POST"
                        }
                    },
                    relayApp: {
                        type: "kettle.app",
                        options: {
                            handlers: {
                                getRelay: {
                                    route: "/relay",
                                    type: "get"
                                },
                                setRelay: {
                                    route: "/relay",
                                    type: "post"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

kettle.tests.testServerPairResponse = function (expected, data) {
    var parsed = JSON.parse(data);
    jqUnit.assertDeepEq("Expected response from request", expected, parsed);
};

kettle.tests.getServerPairSequence = [
    {
        func: "{getRequest}.send"
    }, {
        event: "{getRequest}.events.onComplete",
        listener: "kettle.tests.testServerPairResponse",
        args: [42, "{arguments}.0"]
    }
];

kettle.tests.setServerPairSequence = [
    {
        func: "{setRequest}.send",
        args: [{setDirectModel: 10}, {setModel: 20}] // TODO: currently ignored
    }, {
        event: "{setRequest}.events.onComplete",
        listener: "kettle.tests.testServerPairResponse",
        args: [{payload: "set return value"}, "{arguments}.0"]
    }
];

fluid.defaults("kettle.tests.serverPairTester", {
    gradeNames: ["fluid.test.testEnvironment", "kettle.tests.serverPair", "autoInit"],
    components: {
        getRequest: {
            type: "kettle.test.request.http",
            options: {
                requestOptions: {
                    port: 8086,
                    path: "/relay",
                    method: "GET"
                }
            }
        },
        setRequest: {
            type: "kettle.test.request.http",
            options: {
                requestOptions: {
                    port: 8086,
                    path: "/relay",
                    method: "POST"
                }
            }
        },
        fixtures: {
            type: "fluid.test.testCaseHolder",
            options: {
                modules: [{
                    name: "Cross server datasource access",
                    tests: [{
                        name: "Access GET request",
                        expect: 4,
                        sequence: kettle.tests.getServerPairSequence
                    }, {
                        name: "Access SET request",
                        expect: 5, // one extra assertion tests the type of a set response payload
                        sequence: kettle.tests.setServerPairSequence
                    }]
                }]
            }
        }
    }
});

kettle.test.bootstrap("kettle.tests.serverPairTester");