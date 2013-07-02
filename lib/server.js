/*
Kettle Server.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        fs = require("fs"),
        path = require("path"),
        express = require("express"),
        $ = fluid.registerNamespace("jQuery"),
        kettle = fluid.registerNamespace("kettle");

    fluid.defaults("kettle.server", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        components: {
            requests: {
                type: "kettle.requests"
            },
            requestProxy: {
                type: "kettle.requestProxy"
            },
            callbackWrapper: {
                type: "kettle.requestContextCallbackWrapper"
            },
            configurations: {
                type: "kettle.server.configurations"
            },
            bodyParser: {
                type: "kettle.middleware",
                createOnEvent: "onMiddleware"
            }
        },
        invokers: {
            listen: {
                funcName: "kettle.server.listen",
                args: ["{that}.server", "{that}.options.port"]
            },
            setLogging: {
                funcName: "fluid.setLogging",
                args: "{that}.options.logging"
            },
            amalgamateHandlers: {
                funcName: "kettle.server.amalgamateHandlers",
                args: ["{that}.options.handlers", "{arguments}.0"]
            },
            registerHandlers: {
                funcName: "kettle.server.registerHandlers",
                args: ["{that}.server", "{that}.options.handlers"]
            }
        },
        members: {
            server: {
                expander: {
                    func: "kettle.server.express"
                }
            }
        },
        root: path.join(__dirname, "../../.."),
        events: {
            onMiddleware: null,
            onHandlers: null
        },
        listeners: {
            onCreate: [
                "{that}.setLogging",
                "{that}.events.onMiddleware.fire",
                "{that}.events.onHandlers.fire",
                "{that}.listen"
            ],
            onHandlers: "{that}.registerHandlers"
        },
        handlers: {},
        port: 8080,
        logging: true
    });

    kettle.server.amalgamateHandlers = function amalgamateHandlers(target, source) {
        $.extend(true, target, source);
    };

    kettle.server.registerHandlers = function registerHandlers(server, handlers) {
        fluid.each(handlers, function (handler, context) {
            server[handler.type](handler.route, function (req) {
                var request = req.fluidRequest;
                request.context = fluid.typeTag(context);
                request.events.handle.fire();
            });
        });
    };

    kettle.server.express = function express() {
        return express();
    };

    kettle.server.listen = function listen(server, port) {
        fluid.log("Kettle Server is running on port:", port);
        server.listen(port);
    };

    fluid.defaults("kettle.server.configurations", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        components: {
            createRequest: {
                type: "kettle.server.config.createRequest"
            }
        }
    });

    fluid.defaults("kettle.server.config", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        events: {
            configure: null
        },
        listeners: {
            configure: "{that}.configure",
            onCreate: "{that}.events.configure.fire"
        },
        invokers: {
            configure: "kettle.server.config.configure"
        }
    });

    fluid.defaults("kettle.server.config.createRequest", {
        gradeNames: ["autoInit", "kettle.server.config"]
    });

    kettle.server.config.configureCreateRequest = function configureCreateRequest(server, requests) {
        server.configure(function () {
            server.use(requests.create);
        });
    };

    fluid.demands("kettle.server.config.configure", "kettle.server.config.createRequest", {
        funcName: "kettle.server.config.configureCreateRequest",
        args: ["{kettle.server}.server", "{requests}"]
    });

})();