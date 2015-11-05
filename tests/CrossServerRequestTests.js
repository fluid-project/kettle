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
     jqUnit = fluid.require("node-jqunit", require, "jqUnit");
 
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

kettle.tests.endpointReturns = {
    "get": 42,
    "post": {payload : "post return value"},
    "put":  {payload: "put return value"}
};

kettle.tests.endpoint = function (type, request) {
    jqUnit.assertValue("Request is resolvable", request.events.onSuccess);
    var value = kettle.tests.endpointReturns[type];
    // test operation of "request promise" as well as requirement for callback wrapper
    fluid.invokeLater(kettle.wrapCallback(function () {
        fluid.log("ENDPOINT Resolving with value ", value);
        request.handlerPromise.resolve(JSON.stringify(value) + "\n");
    }));
};

fluid.defaults("kettle.tests.serverPair.getEndpoint", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.endpoint",
            args: ["get", "{request}"]
        }
    }
});

fluid.defaults("kettle.tests.serverPair.postEndpoint", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.endpoint",
            args: ["post", "{request}"]
        }
    }
});

fluid.defaults("kettle.tests.serverPair.putEndpoint", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.endpoint",
            args: ["put", "{request}"]
        }
    }
});

kettle.tests.dataSource.errorPayload = {
    isError: true,
    value: 123,
    message: "Error payload message"
};

kettle.tests.dataSource.errorEndpoint = function (request) {
    request.handlerPromise.reject(kettle.tests.dataSource.errorPayload);
};

fluid.defaults("kettle.tests.serverPair.errorEndpoint", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.dataSource.errorEndpoint"
        }
    }
});

kettle.tests.dataSource.relay = function (type, dataSource, handlerPromise, writeMethod) {
    var args = writeMethod ? [undefined, undefined, {writeMethod: writeMethod}] : [];
    var response = dataSource[type].apply(null, args);
    response.then(function (value) { // white-box testing for dataSource resolution
        var request = kettle.getCurrentRequest();
        jqUnit.assertValue("Callback to dataSource must be contextualised", request);
        if (type === "set") {
            jqUnit.assertEquals("dataSource set payload must have been parsed", "object", typeof(value));
        }
        handlerPromise.resolve(value);
    }, function (error) {
        handlerPromise.reject(error);
    });
};

kettle.tests.dataSource.errorRelay = function (dataSource, request) {
    var response = dataSource.get(null);
    response.then(function () {
        jqUnit.fail("Should not receive resolve from error endpoint");
    }, function (error) {
        request.handlerPromise.reject(error);
    });
};

fluid.defaults("kettle.tests.serverPair.getRelay", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.dataSource.relay",
            args: ["get", "{relayDataSource}", "{request}.handlerPromise"]
        }
    }
});

fluid.defaults("kettle.tests.serverPair.postRelay", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.dataSource.relay",
            args: ["set", "{relayDataSource}", "{request}.handlerPromise"]
        }
    }
});

fluid.defaults("kettle.tests.serverPair.putRelay", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.dataSource.relay",
            args: ["set", "{relayDataSource}", "{request}.handlerPromise", "PUT"]
        }
    }
});

fluid.defaults("kettle.tests.serverPair.errorRelay", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.dataSource.errorRelay",
            args: ["{errorDataSource}", "{request}"]
        }
    }
});

fluid.defaults("kettle.tests.serverPair", {
    gradeNames: ["fluid.component"],
    components: {
        sourceServer: {
            type: "kettle.server",
            options: {
                port: 8085,
                distributeOptions: {
                    source: "{that}.options.port", // ideally we will move this top level once we can support non-that here
                    target: "{serverPair relayServer dataSource}.options.termMap.sourcePort"
                },
                components: {
                    sourceApp: {
                        type: "kettle.app",
                        options: {
                            requestHandlers: {
                                getEndpoint: {
                                    type: "kettle.tests.serverPair.getEndpoint",
                                    route: "/endpoint",
                                    method: "get"
                                },
                                postEndpoint: {
                                    type: "kettle.tests.serverPair.postEndpoint",
                                    route: "/endpoint",
                                    method: "post"
                                },
                                putEndpoint: {
                                    type: "kettle.tests.serverPair.putEndpoint",
                                    route: "/endpoint",
                                    method: "put"
                                },
                                errorEndpoint: {
                                    type: "kettle.tests.serverPair.errorEndpoint",
                                    route: "/errorEndpoint",
                                    method: "get"
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
                            url: "http://localhost:%sourcePort/endpoint",
                            writable: true,
                            writeMethod: "POST"
                        }
                    },
                    errorDataSource: {
                        type: "kettle.dataSource.URL",
                        options: {
                            url: "http://localhost:%sourcePort/errorEndpoint"
                        }
                    },
                    relayApp: {
                        type: "kettle.app",
                        options: {
                            requestHandlers: {
                                getRelay: {
                                    type: "kettle.tests.serverPair.getRelay",
                                    route: "/relay",
                                    method: "get"
                                },
                                postRelay: {
                                    type: "kettle.tests.serverPair.postRelay",
                                    route: "/relay",
                                    method: "post"
                                },
                                putRelay: {
                                    type: "kettle.tests.serverPair.putRelay",
                                    route: "/relay",
                                    method: "put"
                                },
                                errorRelay: {
                                    type: "kettle.tests.serverPair.errorRelay",
                                    route: "/errorRelay",
                                    method: "get"
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
        func: "{getRequest}.send",
        args: [null, {
            path: "/relay"
        }]
    }, {
        event: "{getRequest}.events.onComplete",
        listener: "kettle.tests.testServerPairResponse",
        args: [42, "{arguments}.0"]
    }
];

kettle.tests.postServerPairSequence = [
    {
        func: "{postRequest}.send",
        args: [{setDirectModel: 10}, {setModel: 20}] // TODO: currently ignored
    }, {
        event: "{postRequest}.events.onComplete",
        listener: "kettle.tests.testServerPairResponse",
        args: [{payload: "post return value"}, "{arguments}.0"]
    }
];

kettle.tests.putServerPairSequence = [
    {
        func: "{putRequest}.send",
        args: [{setDirectModel: 10}, {setModel: 20}] // TODO: currently ignored
    }, {
        event: "{putRequest}.events.onComplete",
        listener: "kettle.tests.testServerPairResponse",
        args: [{payload: "put return value"}, "{arguments}.0"]
    }
];

kettle.tests.errorServerPairSequence = [
    {
        func: "{errorRequest}.send",
        args: [null, {
            path: "/errorRelay"
        }]
    }, {
        event: "{errorRequest}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Received relayed failure from original failed dataSource",
            statusCode: 500,
            string: "{arguments}.0",
            request: "{errorRequest}",
            expected: kettle.tests.dataSource.errorPayload
        }
    }
];

fluid.defaults("kettle.tests.serverPairTester", {
    gradeNames: ["fluid.test.testEnvironment", "kettle.tests.serverPair"],
    components: {
        getRequest: {
            type: "kettle.test.request.http",
            options: {
                port: 8086,
                // path: "/relay", // omit this to test KETTLE-28 by supplying dynamically
                method: "GET"
            }
        },
        postRequest: {
            type: "kettle.test.request.http",
            options: {
                port: 8086,
                path: "/relay",
                method: "POST"
            }
        },
        putRequest: {
            type: "kettle.test.request.http",
            options: {
                port: 8086,
                path: "/relay",
                method: "PUT"
            }
        },
        errorRequest: {
            type: "kettle.test.request.http",
            options: {
                port: 8086,
                path: "/errorRelay"
            }
        },
        fixtures: {
            type: "fluid.test.testCaseHolder",
            options: {
                modules: [{
                    name: "Cross server datasource access",
                    tests: [{
                        name: "Access GET request",
                        expect: 3,
                        sequence: kettle.tests.getServerPairSequence
                    }, {
                        name: "Access SET request via POST",
                        expect: 4, // one extra assertion tests the type of a set response payload
                        sequence: kettle.tests.postServerPairSequence
                    }, {
                        name: "Access SET request via PUT",
                        expect: 4, // one extra assertion tests the type of a set response payload
                        sequence: kettle.tests.putServerPairSequence
                    }, {
                        name: "Relay error state via GET",
                        expect: 2,
                        sequence: kettle.tests.errorServerPairSequence
                    }]
                }]
            }
        }
    }
});

kettle.test.bootstrap("kettle.tests.serverPairTester");