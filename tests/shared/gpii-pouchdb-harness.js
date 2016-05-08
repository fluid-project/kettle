// Test harness copied from gpii-pouchdb. Will be sourced from there once GPII-1783 is resolved
"use strict";
var fluid = require("infusion");

require("gpii-pouchdb");
require("gpii-express");

fluid.defaults("gpii.pouch.tests.environment", {
    gradeNames: ["fluid.test.testEnvironment"],

    testUrl:    "/sample/",
    events: {
        constructServer: null,
        onStarted: null
    },
    components: {
        harness: {
            type: "gpii.pouch.tests.harness",
            createOnEvent: "constructServer",
            options: {
                port:       "{testEnvironment}.options.port",
                baseUrl:    "{testEnvironment}.options.baseUrl",
                listeners: {
                    onReady: "{testEnvironment}.events.onStarted.fire"
                }
            }
        }
    }
});

fluid.defaults("gpii.pouch.tests.harness", {
    gradeNames: ["fluid.component"],
    port:       6789,
    baseUrl:    "http://localhost:6789/",
    events: {
        expressStarted: null,
        pouchStarted:   null,
        onReady: {
            events: {
                expressStarted: "expressStarted",
                pouchStarted:   "pouchStarted"
            }
        }
    },
    components: {
        pouch: {
            type: "gpii.express",
            options: {
                port: "{harness}.options.port",
                baseUrl: "{harness}.options.baseUrl",
                listeners: {
                    onStarted: "{harness}.events.expressStarted.fire"
                },
                components: {
                    pouch: {
                        type: "gpii.pouch",
                        options: {
                            path: "/",
                            databases: {
                                testFile: { data: "%kettle/tests/data/pouchDataSourceTestFile.json"}
                            },
                            listeners: {
                                onStarted: "{harness}.events.pouchStarted.fire"
                            }
                        }
                    }
                }
            }
        }
    }
});

