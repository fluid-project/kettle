---
title: Defining and Working With Middleware
layout: default
category: Kettle
---
# Defining and Working With Middleware

## Working with middleware

The most crucial structuring device in the expressjs (or wider pillarjs) community is known as ***[middleware](http://expressjs.com/guide/using-middleware.html)***.
In its most basic form, a piece of middleware is simply a function with the following signature:

    middleware(req, res, next)

The elements `req` and `res` have been described in the section on [request components](RequestHandlersAndApps.md#members-defined-by-the-kettle-framework-at-top-level-on-a-request-component). The element `next` is a callback provided
by the framework to be invoked when the middleware has completed its task. This could be seen as a form of [continuation passing style](https://en.wikipedia.org/wiki/Continuation-passing_style) with 0 arguments –
although only in terms of control flow since in general middleware has its effect as a result of side-effects on the request and response. In express, middleware are typically accumulated in arrays or groups of arrays
by directives such as `app.use`. If a piece of middleware completes without error, it will invoke the `next` callback with no argument, which will signal that control should pass to the next middleware in the
current sequence, or back to the framework if the sequence is at an end. Providing an argument to the callback `next` is intended to signal an error
and the framework will then abort the middleware chain and propagate the argument, conventionally named `err`, to an error handler. This creates an analogy with executing
[promise sequences](http://stackoverflow.com/questions/24586110/resolve-promises-one-after-another-i-e-in-sequence) which we will return to when we construct [middleware components](#defining-and-registering-middleware-components).

In Kettle, middleware can be scheduled more flexibly than by simply being accumulated in arrays – the priority of a piece of middleware can be freely adjusted by assigning it a [Priority](http://docs.fluidproject.org/infusion/development/Priorities.html)
as seen in many places in the Infusion framework, and so integrators can easily arrange for middleware to be inserted in arbitrary positions in already existing applications.

Middleware is accumulated at two levels in a Kettle application – firstly, overall middleware is accumulated at the top level of a `kettle.server` in an option named `rootMiddleware`. This is analogous to express
[app-level middleware](http://expressjs.com/guide/using-middleware.html#middleware.application) registered with `app.use`. Secondly, individual request middleware
can be attached to an individual `kettle.request` in its options at `requestMiddleware`. This is analogous to express [router-level middleware](http://expressjs.com/guide/using-middleware.html#middleware.router).
The structure of these two options areas is the same, which we name `middlewareSequence`. When the request begins to be handled, the framework
will execute the following in sequence:

* The root middleware attached to the `kettle.server`
* The request middleware attached to the resolved `kettle.request` component
* The actual request handler designated by the request component's invoker `handleRequest`

If any of the middleware in this sequence signals an error, the entire sequence will be aborted and an error returned to the client.

### Structure of entries in a `middlewareSequence`

A `middlewareSequence` is a free hash of keys, considered as **namespaces** for the purpose of resolving [Priorities](http://docs.fluidproject.org/infusion/development/Priorities.html) onto
records of type `middlewareEntry`:

```javascript
{
    <middlewareKey> : <middlewareEntry>,
    <middlewareKey> : <middlewareEntry>,
...
}
```

<table>
    <thead>
        <tr>
            <th colspan="3">Members of a <code>middlewareEntry</code> entry within the <code>middlewareSequence</code> block of a component (<code>rootMiddleware</code> for <code>kettle.server</code> or <code>requestMiddleware</code> for <code>kettle.request</code>)</th>
        </tr>
        <tr>
            <th>Member</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>middleware</code></td>
            <td><code>String</code> (<a href="http://docs.fluidproject.org/infusion/development/IoCReferences.html">IoC Reference</a>)</td>
            <td>An IoC reference to the middleware component which should be inserted into the handler sequence. Often this will be qualified by the context <code>{middlewareHolder}</code> – e.g. <code>{middlewareHolder}.session</code> – to reference the core
            middleware collection attached to the <code>kettle.server</code> but middleware could be resolved from anywhere visible in the component tree. This should be a reference to a component descended from the grade <code>kettle.middleware</code></td>
        </tr>
        <tr>
            <td><code>priority</code> (optional)</td>
            <td><code>String</code> (<a href="http://docs.fluidproject.org/infusion/development/Priorities.html">Priority</a>)</td>
            <td>An encoding of a priority relative to some other piece of middleware within the same group – will typically be <code>before:middlewareKey</code> or <code>after:middlewareKey</code> for the <code>middlewareKey</code> of some
            other entry in the group</td>
        </tr>
    </tbody>
</table>

### Defining and registering middleware components

A piece of Kettle middleware is derived from grade `kettle.middleware`. This is a very simple grade which defines a single invoker named `handle` which accepts one argument, a `kettle.request`, and returns a
promise representing the completion of the middleware. Conveniently a `fluid.promise` implementation is available in the framework, but you can return any variety of `thenable` that you please. Here is a skeleton,
manually implemented middleware component:

```javascript
fluid.defaults("examples.customMiddleware", {
    gradeNames: "kettle.middleware",
    invokers: {
        handle: "examples.customMiddleware.handle"
    }
});

examples.customMiddleware.handle = function (request) {
    var togo = fluid.promise();
    if (request.req.params.id === 42) {
        togo.resolve();
    } else {
        togo.reject({
            isError: true,
            statusCode: 401,
            message: "Only the id 42 is authorised"
        });
    }
    return togo;
};
```

The framework makes it very easy to adapt any standard express middleware into a middleware component by means of the adaptor grade `kettle.plainMiddleware`. This accepts any standard express
middleware as the option named `middleware` and from it fabricates a `handle` method with the semantic we just saw earlier. Any options that the middleware accepts can be forwarded to it from
the component's options. Here is an example from the framework's own `json` middleware grade:

```javascript
kettle.npm.bodyParser = require("body-parser");

fluid.defaults("kettle.middleware.json", {
    gradeNames: ["kettle.plainMiddleware"],
    middlewareOptions: {}, // see https://github.com/expressjs/body-parser#bodyparserjsonoptions
    middleware: "@expand:kettle.npm.bodyParser.json({that}.options.middlewareOptions)"
});
```

Consult the Infusion documentation on the [compact format for expanders](http://docs.fluidproject.org/infusion/development/ExpansionOfComponentOptions.html#compact-format-for-expanders) if you
are unfamiliar with this syntax for designating elements in component options which arise from function calls.

If your middleware may act asynchronously by performing some raw I/O, you must use the grade `kettle.plainAsyncMiddleware`
instead. This is to ensure that the Kettle [request component](RequestHandlersAndApps.md#request-components)
is unmarked during the period that the system is not acting on behalf of the currently incoming request. If the code
for the middleware is under your control, it is recommended that wherever possible you use [dataSources][DataSources.md]
for I/O since their callbacks automatically perform the necessary
[request marking](DataSources.md#callback-wrapping-in-datasources).

### Built-in standard middleware bundled with Kettle

Here we describe the built-in middleware supplied with Kettle, which is mostly sourced from standard middleware in the [express](http://expressjs.com/) and [pillarjs](https://github.com/pillarjs)
communities. You can consult the straightforward implementations in [KettleMiddleware.js](https://github.com/fluid-project/kettle/tree/master/lib/KettleMiddleware.js) for suggestions for how
to implement your own.

<div style="font-size: smaller">
<table>
<thead>
<tr><th>Grade name</th><th>Middleware name</th><th>Description</th><th>Accepted options</th><th>Standard IoC Path</th></tr>
</thead>
<tbody>
<tr>
    <td><code>kettle.middleware.json</code></td>
    <td><a href="https://github.com/expressjs/body-parser">expressjs/body-parser</a></td>
    <td>Parses JSON request bodies, possibly with compression.</td>
    <td><code>middlewareOptions</code>, forwarded to <a href="https://github.com/expressjs/body-parser#bodyparserjsonoptions"<code>bodyParser.json(options)</code></a></td>
    <td><code>{middlewareHolder}.json</code></td>
</tr>
<tr>
    <td><code>kettle.middleware.urlencoded</code></td>
    <td><a href="https://github.com/expressjs/body-parser">expressjs/body-parser</a></td>
    <td>Applies URL decoding to a submitted request body</td>
    <td><code>middlewareOptions</code>, forwarded to <a href="https://github.com/expressjs/body-parser#bodyparserurlencodedoptions"><code>bodyParser.urlencoded(options)</code></a></td>
    <td><code>{middlewareHolder}.urlencoded</code></td>
</tr>
<tr>
    <td><code>kettle.middleware.cookieParser</code></td>
    <td><a href="https://github.com/expressjs/cookie-parser">expressjs/cookie-parser</a></td>
    <td>Parses the <code>Cookie</code> header as well as signed cookies via <code>req.secret</code>.</td>
    <td><code>secret</code> and <code>middlewareOptions</code>, forwarded to the two arguments of <a href="https://github.com/expressjs/cookie-parser#cookieparsersecret-options"><code>cookieParser(secret, options)</code></a></td>
    <td>none</td>
</tr>
<tr>
    <td><code>kettle.middleware.multer</code></td>
    <td><a href="https://github.com/expressjs/multer">expressjs/multer</a></td>
    <td>Handles <code>multipart/form-data</code>, primarily for file uploading.</td>
    <td><code>middlewareOptions</code>, forwarded to <code>multer(options)</code>, and <code>formFieldOptions</code>, used to configure the field parameters for uploaded files as described in <a href="https://github.com/expressjs/multer#usage">multer's documentation</a>. <strong>Note</strong>: some <code>multer</code> options require functions as their values, and are implemented in Kettle using <code>invokers</code>; see the documentation below on using <code>kettle.middleware.multer</code> for more details.</td>
    <td>none – user must configure on each use</td>
</tr>
<tr>
    <td><code>kettle.middleware.session</code></td>
    <td><a href="https://github.com/expressjs/session">expressjs/session</a></td>
    <td>Stores and retrieves <code>req.session</code> from various backends</td>
    <td><code>middlewareOptions</code>, forwarded to <a href="https://github.com/expressjs/session#sessionoptions"><code>session(options)</code></a></td>
    <td><code>{middlewareHolder}.session</code> when using <code>kettle.server.sessionAware</code> server</td>
</tr>
<tr>
    <td><code>kettle.middleware.static</code></td>
    <td><a href="https://github.com/expressjs/serve-static">expressjs/serve-static</a></td>
    <td>Serves static content from the filesystem</td>
    <td><code>root</code> and <code>middlewareOptions</code>, forwarded to the two arguments of <a href="https://github.com/expressjs/serve-static#servestaticroot-options"><code>serveStatic(root, options)</code></a></td>
    <td>none – user must configure on each use</td>
</tr>
<tr>
    <td><code>kettle.middleware.CORS</code></td>
    <td><a href="https://github.com/fluid-project/kettle/tree/master/lib/KettleMiddleware.js">Kettle built-in</a></td>
    <td>Adds <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS">CORS</a> headers to outgoing HTTP request to enable cross-domain access</td>
    <td><code>allowMethods {String}</code> (default <code>"GET"</code>), </br><code>origin {String}</code> (default <code>*</code>), </br> <code>credentials {Boolean}</code> (default <code>true</code>) </br>-
        see <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS#The_HTTP_response_headers">CORS response headers</a></td>
    <td><code>{middlewareHolder}.CORS</code></td>
</tr>
<tr>
    <td><code>kettle.middleware.null</code></td>
    <td><a href="https://github.com/fluid-project/kettle/tree/master/lib/KettleMiddleware.js">Kettle built-in</a></td>
    <td>No-op middleware, useful for overriding and inactivating undesired middleware</td>
    <td>none</td>
    <td><code>{middlewareHolder}.null</code></td>
</tr>
</tbody>
</table>

</div>

Middleware which it makes sense to share configuration application-wide is stored in a standard holder of grade `kettle.standardMiddleware` which is descended from the grade `kettle.middlewareHolder` – the
context reference `{middlewareHolder}` is recommended for referring to this if required – e.g. `{middlewareHolder}.session`.

#### Using the static middleware

Here is an example of mounting a section of a module's filesystem path at a particular URL. In this case, we want to mount the `src` directory of our Infusion module at the global path `/infusion/`, a common
enough requirement. Note that this is done by registering a *handler* just as with any other Kettle request handler, even though in this case the useful request handling function is actually achieved
by the middleware. The only function of the request handler is to serve the 404 message in case the referenced file is not found in the mounted image – in this case, it can refer to the standard builtin handler
named `kettle.request.notFoundHandler`. Note that the request handler must declare explicitly that it will handle all URLs under its prefix path by declaring a route of `/*` – this is different to the express
model of routing and middleware handling. Kettle will not dispatch a request to a handler unless its route matches all of the incoming URL.

Note that our static middleware can refer symbolically to the path of any module loaded using Infusion's module system
[`fluid.module.register`](http://docs.fluidproject.org/infusion/development/NodeAPI.html#fluid-module-register-name-basedir-modulerequire-) by means of interpolated terms such as `%infusion`.

Our config:

```json
{
    "type": "examples.static.config",
    "options": {
        "gradeNames": ["fluid.component"],
        "components": {
            "server": {
                "type": "kettle.server",
                "options": {
                    "port": 8081,
                    "components": {
                        "infusionStatic": {
                            "type": "kettle.middleware.static",
                            "options": {
                                "root": "%infusion/src/"
                            }
                        },
                        "app": {
                            "type": "kettle.app",
                            "options": {
                                "requestHandlers": {
                                    "staticHandler": {
                                        "type": "examples.static.handler",
                                        "prefix": "/infusion",
                                        "route": "/*",
                                        "method": "get"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
```

Our handler:

```javascript
fluid.defaults("examples.static.handler", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "static": {
            middleware: "{server}.infusionStatic"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.request.notFoundHandler"
        }
    }
});
```

#### Using the multer middleware

This shows a basic single-file upload; for more examples of possible usage, refer to the `kettle.tests.multer.config.json5` configuration file in `tests/configs` and the Multer documentation.

Code for this example can be found in `/examples/multipartForm`.

```javascript
fluid.defaults("examples.uploadConfig", {
    "gradeNames": ["fluid.component"],
    "components": {
        "server": {
            "type": "kettle.server",
            "options": {
                "port": 8081,
                "components": {
                    "imageUpload": {
                        "type": "kettle.middleware.multer",
                        "options": {
                            "formFieldOptions": {
                                "method": "single",
                                "fieldName": "image"
                            },
                            "members": {
                                "storage": "{that}.diskStorage"
                            },
                            "invokers": {
                                "diskStorageDestination": {
                                    "funcName": "examples.uploadConfig.diskStorageDestination"
                                }
                            }
                        }
                    },
                    "app": {
                        "type": "kettle.app",
                        "options": {
                            "requestHandlers": {
                                "imageUploadHandler": {
                                    "type": "examples.uploadConfig.handler",
                                    "route": "/upload",
                                    "method": "post"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});
```

And our corresponding handlers and `diskStorageDestination` invoker (to set our own destination path):

```javascript
examples.uploadConfig.diskStorageDestination = function (req, file, cb) {
    cb(null, "./examples/multipartForm/uploads");
};

fluid.defaults("examples.uploadConfig.handler", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        imageUpload: {
            middleware: "{server}.imageUpload"
        }
    },
    invokers: {
        handleRequest: "examples.uploadConfig.handleRequest"
    }
});

examples.uploadConfig.handleRequest = function (request) {
    var uploadedFileDetails = request.req.file;
    request.events.onSuccess.fire({
        message: fluid.stringTemplate("POST request received on path /upload; file %originalName uploaded to %uploadedPath", {originalName: uploadedFileDetails.originalname, uploadedPath: uploadedFileDetails.path})
    });
};
```
