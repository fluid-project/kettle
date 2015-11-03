# Kettle

Kettle is an integration technology which promotes the expression of servers handling HTTP and WebSockets endpoints. 
With a few exceptions, Kettle implements no primary functionality of its own, but aggregates the facilities of
[express](http://expressjs.com/) and [ws](http://einaros.github.io/ws/), as well as middleware held in the wider [pillarjs](https://github.com/pillarjs)
"Bring your own HTTP Framework Framework" ecosystem. Kettle applications can easily incorporate any express-standard middleware, as well as coexisting with standard express apps targeted at the same
node.js <a href="https://nodejs.org/api/http.html#http_class_http_server"><code>http.Server</code></a>. Since Kettle applications are expressed declaratively, in the JSON format encoding [Infusion](https://github.com/fluid-project/infusion)'s component trees, it is possible to adapt existing
applications easily, as well as inserting middleware and new handlers anywhere in the pipeline without modifying the original application's code. This makes
Kettle suitable for uses where application functionality needs to be deployed flexibly in a variety of different configurations.

In fact, Kettle's dependency on express itself is minimal, since the entirety of the Kettle request handling pipeline is packaged
as a single piece of express-compatible middleware – Kettle could be deployed against any other consumer of middleware or even a raw node.js HTTP server.

# Contents of this repository

## Core Kettle implementation

This is packaged as Infusion [grades](http://docs.fluidproject.org/infusion/development/ComponentGrades.html) derived from [`kettle.server`](#kettle.server), [`kettle.request`](#kettle.request) and [`kettle.app`](#kettle.app). The first two of these exist in variants specialized both for plain
HTTP (with the `.http` suffix) and for WebSockets (with the `.ws` suffix) – `kettle.app` does not specialize.

## Contents - Testing

As well as the integration technology implementing Kettle itself, this repository also contains functionality helpful for testing HTTP and WebSockets
servers written in arbitrary technologies. This is accessed by running `kettle.loadTestingSupport()` after having called `require("kettle")`. Kettle testing 
support allows HTTP and WebSockets client requests to be packaged as [Infusion](https://github.com/fluid-project/infusion) components, suitable for use with Infusion's
[IoC Testing Framework](http://docs.fluidproject.org/infusion/development/IoCTestingFramework.html). Any user of Kettle's testing support needs to have [node-jqunit](https://github.com/fluid-project/node-jqunit)
registered as a member of their own project's `devDependencies` in their own package.json.

Kettle runs on [node.js](https://nodejs.org) version 4.x (see [package.json](package.json) for current dependency profile).

## Contents - DataSources

The Kettle repository also contains a few implementations of the simple `DataSource` contract for read/write access to data with a simple semantic (broadly the same as that
encoded in [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) although the current DataSource semantic does not provide explicitly for deletion). See the documentation section
on [DataSources](#datasources) for details of this contract, the available implementations and how to use them.

This repository contains DataSource implementations suitable for HTTP endpoints (with a particular variety specialised for accessing CouchDB databases with CRUDlike semantics) as well as the filesystem, with
an emphasis on JSON payloads.

# Getting Started and Community

## Installation instructions

Firstly, install node and npm by running a standard installer from [node.js](https://nodejs.org). Clone this repository and then run `npm install`.

## Issue Tracking

Issue tracking is at http://issues.fluidproject.org/browse/KETTLE .

## IRC

Visit `#fluid-work` on EFNet – community resources are linked at [Fluid's IRC Channels](https://wiki.fluidproject.org/display/fluid/IRC+Channel).

## Mailing list

Contact us on the [fluid-work](https://wiki.fluidproject.org/display/fluid/Mailing+Lists) mailing list with any problems or comments.

## Uses of Kettle and related projects

The primary user of Kettle is the [GPII](http://gpii.net/)'s autopersonalisation infrastructure, held at [GPII/universal](https://github.com/GPII/universal). Kettle is used
to provide a flexible means of deploying the GPII's "Flow Manager" and related components distributed across multiple local and remote installations.

A closely related project to Kettle is [gpii-express](https://github.com/GPII/gpii-express) which is used in other GPII projects such as the [terms registry](https://github.com/GPII/common-terms-registry) and
[unified listing](https://github.com/GPII/ul-api). This is similar in architecture to Kettle (wrapping express primitives such as servers and requests into dynamically constructed Infusion components) 
but slightly different in emphasis – 

* gpii-express allows independently mounted application units with nested routing, in the Express 4.x style – whereas Kettle is currently limited to flat Express 3.x-style routing
* Kettle incorporates support for WebSockets endpoints, whereas gpii-express does not
* Kettle incorporates support for DataSources (see [DataSources](#datasources) )

The request-handling architecture for gpii-express and Kettle is quite similar and the projects will probably converge over time. gpii-express currently already depends on Kettle to get access to its
HTTP [testing](#testing) support.

# Documentation

Documentation and sample code for working with Kettle now follow:

## Kettle applications

The top-level structure of a Kettle applications can be described by a "config" file in JSON format. A Kettle "config"
describes the configuration of a number of "Kettle apps" ([grade](http://docs.fluidproject.org/infusion/development/ComponentGrades.html) `kettle.app`) hosted in a number of "Kettle servers" (grade `kettle.server`). 
The config JSON file represents an Infusion [component tree](http://docs.fluidproject.org/infusion/development/HowToUseInfusionIoC.html). If you aren't familiar
with the syntax and meaning of component trees, it is a good idea to browse the documentation, tutorials and examples at the 
Infusion [documentation site](http://docs.fluidproject.org/infusion/development/). Kettle components are currently derived from
the base grade `fluid.component`, so you can ignore for these purposes the parts of the Infusion documentation relating to model and view components.

## A simple Kettle application

In this section, we will construct a simple Kettle application within JavaScript code, to produce a self-contained example. You can find and try out this
same application represented in two forms in the [examples/simpleConfig](examples/simpleConfig) directory. 

```javascript

fluid.defaults("examples.simpleConfig", {
    gradeNames: "fluid.component",
    components: {
        server: {
            type: "kettle.server",
            options: {
                port: 8081,
                components: {
                    app: {
                        type: "kettle.app",
                        options: {
                            requestHandlers: {
                                getHandler: {
                                    "type": "examples.simpleConfig.handler",
                                    "route": "/handlerPath",
                                    "method": "get"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

fluid.defaults("examples.simpleConfig.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: "examples.simpleConfig.handleRequest"
    }
});

examples.simpleConfig.handleRequest = function (request) {
    request.events.onSuccess.fire({
        message: "GET request received on path /handlerPath"
    });
};

// Construct the server using the above config
examples.simpleConfig();
```

The JSON "config" form of the application itself is held at [examples/simpleConfig/examples.simpleConfig.json](./examples/simpleConfig/examples.simpleConfig.json), 
which encodes the same information as in the first `fluid.defaults` call above. The definitions for request handlers such as `examples.simpleConfig.handler` and
`examples.simpleConfig.handleRequest`, which in our sample are held in [examples/simpleConfig/simpleConfig-config-handler.js](./examples/simpleConfig/simpleConfig-config-handler.js), 
always need to be supplied in standard `.js` files required by the application – although future versions of Kettle
may allow the defaults for the handler grade to be encoded in JSON. Consult the Infusion framework documentation on [grades](http://docs.fluidproject.org/infusion/development/ComponentGrades.html) if
you are not familiar with this kind of configuration.

You can try out these samples in [examples/simpleConfig](examples/simpleConfig) by, for example, from that directory, typing `node simpleConfig-config-driver.js`. The last line of the driver files
load a common module, `simpleConfig-client.js` which tests the server by firing an HTTP request to it and logging the payload – this uses one of the HTTP client drivers taken from Kettle's
[testing](#kettle-testing-framework) definitions. Later on, we will see how to issue formal test fixtures against this application by using the [Kettle testing framework](#kettle-testing-framework).

## Structure of a Kettle config

In the previous section, we saw a [simple example](./examples/simpleConfig/simpleConfig-config.json) of a JSON-formatted Kettle config, which declaratively encodes a Kettle application structure.
In this section we describe the top-level members of this structure, and in the next secion we'll look at the containment structure in terms of [grades](http://docs.fluidproject.org/infusion/development/ComponentGrades.html).
In the rest of this document we'll describe the options accepted by the various grades which make up a Kettle application (`kettle.server`, `kettle.app`, `kettle.middleware` and `kettle.request`). The structure of our
minimal application will serve as a general template – the full definition of a Kettle application consists of a config, ***plus*** definitions of request handler grades ***plus*** implementations of request handler functions.

<table>
    <thead>
        <tr>
            <th colspan="3">Top-level members of a Kettle "config" configuration file</th>
        </tr>
        <tr>
            <th>Member</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>type</code></td>
            <td><code>String</code> (grade name)</td>
            <td>The type name for this config. This should be a fully-qualified grade name – it is suggested that it agree with the file name of the config file without the <code>.json</code> extension.</td>
        </tr>
        <tr>
            <td><code>options</code></td>
            <td><code>Object</code> (component options)</td>
            <td>The options for the application structure. These should start with the application's <code>gradeNames</code> which will usually just be <code>fluid.component</code>, and then continue with <code>components</code> designating the
            next level of containment of the application, the <code>kettle.server</code> level – see the next section on <a href="#containent-structure-of-a-kettle-application">containment structure of a Kettle application</a> for the full structure</td>
        </tr>
        <tr>
            <td><code>includes</code> (optional)</td>
            <td><code>String/Array of String</code></td>
            <td>A filename (or array of these) of other config files which are to be included into this application. These names may begin with a <a href="http://docs.fluidproject.org/infusion/development/NodeAPI.html#node-js-module-apis">module-relative path</a>
            such as <code>%kettle</code> or else will be interpreted as 
            paths relative to this config's location in the filesystem. Each filename listed here will be loaded and resolved as a grade and then merged with the 
            structure of this config (via an algorithm similar to <a href="https://api.jquery.com/jquery.extend/">jQuery.extend</a> – note that because of a current Infusion framework bug <a href="https://issues.fluidproject.org/browse/FLUID-5614">FLUID-5614</a>, 
            all of the semantics of nested <a href="http://docs.fluidproject.org/infusion/development/OptionsMerging.html">options merging</a> will
            not be respected and the merging will occur in a simple-minded way below top level)</td>
        </tr>
        <tr>
            <td><code>require</code> (optional)</td>
            <td><code>String/Array of String</code></td>
            <td>A <a href="https://nodejs.org/api/modules.html">module identifier</a> (or array of these) that will be loaded when this config is loaded. These modules will be loaded as if by the standard node.js API
            <a href="https://nodejs.org/api/modules.html"><code>require</code></a> operating from the config's directory (the <a href="https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders>global folder rules</a> will be ignored). 
            These names may begin with a <a href="http://docs.fluidproject.org/infusion/development/NodeAPI.html#node-js-module-apis">module-relative path</a> such as <code>%kettle</code> to indicate a path relative to a module registered with Infusion.</td>
        </tr>
    </tbody>
</table>


## Containment structure of a Kettle application

The overall structure of a Kettle application (a "config") shows a 4-level pattern:

* At top level, the application container – this has the simple grade `fluid.component` and does not carry any functionality – it is simply used for grouping the definitions at the next level
    * At 2nd level, one or more Kettle servers – these have the grade `kettle.server` – in the case there is just one server it is conventionally named `server`
        * At 3rd level, one more Kettle apps – these have the grade `kettle.app` – this is the level at which independently mountable segments of applications are grouped (an app is a grouping of handlers)
            * At 4th level, one or more Kettle request handlers – these have the grade `kettle.request` – each of these handles one endpoint (HTTP or WebSockets) routed by URL and request method
            
This expression is much more verbose in simple cases than the traditional raw use of express apps, but in larger and more complex applications this verbosity is amortised, with the ability to easily
customise and reassort groups of handlers and servers from application to application.

Note that the containment relationships between the top 3 levels need not be direct – servers may be nested any number of levels below the config root, and apps may be nested any number of 
levels below a server. However, request handlers must be defined as direct children of their parent apps, in the options section named `requestHandlers`. 

<a id="kettle.server"></a>

### Configuration options for a `kettle.server`

The `kettle.server` grade accepts the following options which can usefully be configured by the user. Naturally by virtue of being a `fluid.component` there
are numerous other parts of its lifecycle which can be customised, but these are the options principally supported for user configuration:

<table>
    <thead>
        <tr>
            <th colspan="3">Supported configurable options for a </code>kettle.server</code></th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>members.expressApp</code></td>
            <td><a href="http://expressjs.com/4x/api.html#app"><code>express</code></a></td>
            <td>The express <a href="http://expressjs.com/4x/api.html#app">application</a> which this server is to be bound to. If this option is not overriden, the server will automatically construct one using the <code>express()</code> constructor.</td>
        </tr>
        <tr>
            <td><code>members.httpServer</code></td>
            <td><a href="https://nodejs.org/api/http.html#http_class_http_server"><code>http.Server</code></a></td>
            <td>The node.js <a href="https://nodejs.org/api/http.html#http_class_http_server"><code>HTTP server</code></a> which this server is to be bound to. If this option is not overriden, the server will use the one extracted from the <code>expressApp</code> member</td>
        </tr>
        <tr>
            <td><code>port</code></td>
            <td><code>Number</code></td>
            <td>The port number which this server is to listen on. Defaults to 8081.</td>
        </tr>
        <tr>
            <td><code>rootMiddleware</code></td>
            <td><a href="#middlewareSequence"><code>middlewareSequence</code></a></td>
            <td>The group of middleware which is to be executed for every request handled by this server</td>
        </tr>
        <tr>
            <td><code>components.middlewareHolder</code></td>
            <td><code>Component</code></a></td>
            <td>A plain component container for middleware that is intended to be resolvable throughout the server's component tree</td>
        </tr>
        <tr>
            <td><code>events.onListen</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>An event fired once this server has started listening on its port. Fired with one argument, the server component itself</code></td>
        </tr>
        <tr>
            <td><code>events.beforeStop</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>An event fired just before this server is about to be stopped. This is an opportunity to clean up any resource (e.g. close any open sockets). Fired with one argument, the server component itself</code></td>
        </tr>
        <tr>
            <td><code>events.onStopped</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>An event fired after the server is stopped and the HTTP server is no longer listening. Fired with one argument, the server component itself</code></td>
        </tr>
        <tr>
            <td><code>events.onContributeMiddleware</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>This event is useful for authors trying to integrate with 3rd-party express applications. This is a useful lifecycle point, before Kettle registers its own middleware to the express application,
            for an external integrator to register their own middleware first, e.g. using <code>app.use</code>. Fired with one argument, the server component itself – typically only <code>that.expressApp</code> will be of interest to the listener</code></td>
        </tr>
        <tr>
            <td><code>events.onContributeMiddleware</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>This event is useful for authors trying to integrate with 3rd-party express applications. This is a useful lifecycle point, before Kettle registers its own rout handlers to the express application,
            for an external integrator to register their own rout handlers first, e.g. using <code>app.get</code> etc.. Fired with one argument, the server component itself – typically only <code>that.expressApp</code> will be of interest to the listener</code></td>
        </tr>      
    </tbody>
</table>

### Configuration options for a `kettle.server.ws`

A WebSockets-capable server exposes all of the configurable options supported by a `kettle.server` in addition to the ones in the table below:

<table>
    <thead>
        <tr>
            <th colspan="3">Supported configurable options for a </code>kettle.server.ws</code></th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>wsServerOptions</code></td>
            <td><code>Object</code></td>
            <td>Any options to be forwarded to the constructor of the <a href="https://github.com/websockets/ws/blob/master/doc/ws.md#new-wsserveroptions-callback"><code>ws.Server</code></a>. Note that after construction, this server will
            be available as the top-level member named <code>wsServer</code> on the overall component.</td>
        </tr>
    </tbody>
</table>

<a id="kettle.app"></a>

## Registering and implementing a request handler

Request handlers are registered in the `requestHandlers` section of the options of a `kettle.app` – see the [sample app](#a-simple-kettle-application) for positioning of this component in the
containment structure. This consists of a free hash of `handlerName` strings to `handlerRecord` structures.

###Structure of the `requestHandlers` option of a `kettle.app`
```javascript
{
<handlerName> : <handlerRecord>,
<handlerName> : <handlerRecord>,
...
}
```

Note that the `handlerName`s are simply free strings and have no function other than to uniquely name the handler in the context of its app. These strings exist to allow easy alignment when 
multiple apps are merged together from different sources to produce combined apps.

### Structure of the `handlerRecord` structure

<table>
    <thead>
        <tr>
            <th colspan="3">Members of an <code>handlerRecord</code> entry within the <code>requestHandlers</code> block of a <code>kettle.app</code> component</th>
        </tr>
        <tr>
            <th>Member</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>type</code></td>
            <td><code>String</code></td>
            <td>The name of a request handling grade, which must be descended from <code>kettle.request</code>. If you supply the <code>method</code> field, your grade must be descended from <code>kettle.request.http</code></td>
        </tr>
        <tr>
            <td><code>route</code></td>
            <td><code>String</code></td>
            <td>An express-compatible <a href="http://expressjs.com/guide/routing.html">routing</a> string, expressing the range of HTTP paths to be handled by this handler, together with any named parameters and query parameters
            that should be captured. The exact syntax for route matching is documented more precisely at <a href="https://github.com/pillarjs/path-to-regexp">pillarjs</a></td>
        </tr>
        <tr>
            <td><code>prefix</code> (optional)</td>
            <td><code>String</code></td>
            <td>A routing prefix to be prepended to this handler's <code>route</code>. The prefix plus the route expression must match the incoming request in order for this handler to be activated – 
            but if it is, it will only see the portion of the URL matched by <code>route</code> in the member <code>request.req.url</code>. The entire incoming URL will remain visible in <code>request.req.originalUrl</code> – 
            this is the same behaviour as express.js <a href="http://expressjs.com/api.html#app.use">routing system</a>. It is primarily useful when using <a href="#thing">static middleware</a> which will compare the
            <code>req.url</code> value with the filesystem path relative to its mount point.
        </tr>
        
        <tr>
            <td><code>method</code> (optional)</td>
            <td><code>String</code> value – one of the valid <a href="https://github.com/nodejs/node/blob/master/deps/http_parser/http_parser.h#L88">HTTP methods</a> supported by node.js, expressed in lower case, or else a comma-separated 
            sequence of such values.
            </td>
            <td>The HTTP request type(s) which this handler will match. <code>method</code> is omitted in the 
            case that the request handling grade is not descended from <code>kettle.request.http</code> – the only currently supported requests of that type are WebSockets requests descended from <code>kettle.request.ws</code> 
        </tr>
    </tbody>
</table>

### How to implement a request handler

A handler for a particular request must have a [grade](http://docs.fluidproject.org/infusion/development/ComponentGrades.html) registered with Infusion whose name
matches the `type` field in the `handlerRecord` structure just described. The parent grades of this grade must be consistent with the the request you expect to handle – 
descended from `kettle.request.http` in the case of an HTTP request, or `kettle.request.ws` in the case of a WebSockets request. In addition, the grade must define
(at minimum) an [invoker](http://docs.fluidproject.org/infusion/development/Invokers.html) named `handleRequest`. This invoker will be called by Kettle when your route
is matched, and be supplied a single argument holding the ***request object***, an object whose grade is your request handler's grade, which the framework has
constructed to handle the request.
 
We duplicate the definitions from the [sample application](#a-simple-kettle-application) in order to show a minimal request handler grade and request handler function:

```javascript
fluid.defaults("examples.simpleConfig.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: "examples.simpleConfig.handleRequest"
    }
});

examples.simpleConfig.handleRequest = function (request) {
    request.events.onSuccess.fire({
        message: "GET request received on path /handlerPath"
    });
};
```

In the next section we will talk more about request (handler) objects, the members you can expect on them, and how to use them.

<a id="kettle.request"></a>

## Request components

A ***request component*** is constructed by Kettle when it has determined the correct [handler record](#registering-and-implementing-a-request-handler) which matches
the incoming request. This request component will be usefully populated with material drawn from the request and node.js initial process of handling it. It also contains
various elements supplied by Kettle in order to support you in handling the request. You can add any further material that you like to the request object by adding
entries to its grade definition, of any of the types supported by Infusion's [component configuration options](http://docs.fluidproject.org/infusion/development/ComponentConfigurationOptions.html).
Here we will document the standard members that are placed there by Kettle for the two standard request types which are supported, `kettle.request.http` and `kettle.request.ws`.

### Members defined by the Kettle framework at top-level on a request component

<table>
    <thead>
        <tr>
            <th colspan="3">Members defined by default at top-level on a (HTTP) request component</th>
        </tr>
        <tr>
            <th>Member</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>req</code></td>
            <td><a href="https://nodejs.org/api/http.html#http_http_incomingmessage"><code>http.IncomingMessage</code></a></td>
            <td>The request object produced by node.js – this is the value which is commonly referred to as <a href="http://expressjs.com/4x/api.html#req"><code>req</code></a> in the standard express <a href="http://expressjs.com/guide/using-middleware.html">middleware pattern</a></td>
        </tr>
        <tr>
            <td><code>res</code> (only for <code>kettle.request.http</code>)</td>
            <td><a href="https://nodejs.org/api/http.html#http_class_http_serverresponse"><code>http.ServerResponse</code></a></td>
            <td>The response object produced by node.js – this is the value which is commonly referred to as <a href="http://expressjs.com/4x/api.html#res"><code>res</code></a> in the standard express <a href="http://expressjs.com/4x/api.html#req">middleware pattern</a></td>
        </tr>
        <tr>
            <td><code>events.onSuccess</code> (only for <code>kettle.request.http</code>)</td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which should be fired if the request is to produce a response successfully. The event argument will produce the response body – if it is of type <code>Object</code>, it will be JSON-encoded.</td>
        </tr>
        <tr>
            <td><code>events.onError</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which should be fired if the request is to send an error response. 
            For a request of type <code>kettle.request.http</code>, the argument to the event must be an <code>Object</code> with at least
            a field <code>message</code> of type <code>String</code> holding the error message to be returned to the client. The argument can also include a member <code>statusCode</code> of type <code>Number</code> holding the HTTP status code to accompany the error – 
            if this is not supplied, it will default to 500.
        </tr>
        <tr>
            <td><code>handlerPromise</code> (only for <code>kettle.request.http</code>)</td>
            <td><code>Promise</code></td>
            <td>This promise is a proxy for the two events <code>onSuccess</code> and <code>onError</code>, packaged as a <a href="https://www.promisejs.org/">Promise</a>. This promise exposes methods <code>resolve</code> and <code>reject</code>
            which forward their arguments to <code>onSuccess</code> and <code>onError</code> respectively. In addition, the promise exposes a <code>then</code> method which accepts two callbacks which can be used to listen to these event firings
            respectively. Note that this promise is not compliant with any particular specification for promises, including ES6, A+, etc. – in the language of those specifications, it is simply a <code>thenable</code> which also includes 
            the standard resolution methods <code>resolve</code> and <code>reject</code>. Implementation at <a href="https://github.com/fluid-project/infusion/blob/master/src/framework/core/js/FluidPromises.js#L21">FluidPromises.js</a>.
            </td>
        </tr>
        <tr>
            <td><code>events.onSuccess</code> (only for <code>kettle.request.http</code>)</td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which should be fired if the request is to produce a response successfully. The event argument will produce the response body – if it is of type <code>Object</code>, it will be JSON-encoded.</td>
        </tr>
    </tbody>
</table>

Note that, in return, the Kettle request component will be marked onto the node.js request object so that it can easily be retrieved from standard middleware, etc. – it will be available as `req.fluidRequest` where `req` is the
request object described in the table above. More details follow on middleware in the section [working with middleware](working-with-middleware).

### Members defined by the Kettle framework at top-level on a WebSockets request component

WebSockets communications in a Kettle application are mediated by the [ws](https://github.com/websockets/ws) WebSockets library – you should get familiar with the documentation for
that library if you intend to use this functionality significantly. It is also worth spending some time familiarising yourself with at least some of the `ws` implementation code since there are several
aspects not properly covered by the documentation.

The request component for a WebSockets request, derived from the grade `kettle.request.ws` includes the members in the above table which are not marked as
`kettle.request.http` only, as well as several more members described in the following table:

<table>
    <thead>
        <tr>
            <th colspan="3">Members defined by default at top-level on a WebSockets request component</th>
        </tr>
        <tr>
            <th>Member</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>ws</code></td>
            <td><a href="https://github.com/websockets/ws/blob/master/doc/ws.md#class-wswebsocket"><code>ws.WebSocket</code></a></td>
            <td>The <code>ws.WebSocket</code> advertised by the <a href="https://github.com/websockets/ws"><code>ws</code></a> WebSockets library as allocated to handle one end of an established WebSockets connection. This will be of the variety
            referred to in the <code>ws</code> docs as "a WebSocket constructed by a Server".</td>
        </tr>
        <tr>
            <td><code>events.onReceiveMessage</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which is fired by the framework when a message is received from the client
            at the other end of the WebSockets connection. The arguments to the event are <code>(that, payload)</code> where <code>that</code> represents this request component itself, and <code>payload</code> represnts
            the payload sent by the client. If the <code>receiveMessageJSON</code> option is set to <code>true</code> for this component (the default), the payload will have been decoded as JSON.
        </tr>
        <tr>
            <td><code>events.onSendMessage</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which can be fired by the implementor of the request handler when they want to send a message to the client.
            This event expects to receive just a single argument, the message payload. If the <code>sendMessageJSON</code> option is set to <code>true</code> for this component (the default), the payload will be encoded by the framework as JSON.
        </tr>
        <tr>
            <td><code>events.onError</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which should be fired if the request is to end an error response.
            This event has the same name as the one fired by a <code>kettle.request.http</code> but the behaviour and semantic is different. Rather than sending an HTTP error response, the framework instead
            emits a WebSockets  event of type <code>error</code>. Because of this, the <code>statusCode</code> field of the event argument should not be used. However, it is recommended that the event payload
            still includes a field <code>message</code> of type <code>String</code> holding the error message to be returned to the client, as well as a boolean member <code>isError</code> with the value <code>true</code>.
        </tr>
    </tbody>
</table>

### Working with middleware

The most crucial structuring device in the expressjs (or wider pillarjs) community is known as ***[middleware](http://expressjs.com/guide/using-middleware.html)***. In its most basic form, a piece of middleware is simply a function with the following signature:

    middleware(req, res, next)
    
The elements `req` and `res` have been described in the section on [request components](#members-defined-by-the-kettle-framework-at-top-level-on-a-request-component). The element `next` is a callback provided
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
            <th colspan="3">Members of an <code>middlewareEntry</code> entry within the <code>middlewareSequence</code> block of a component (<code>rootMiddleware</code> for <code>kettle.server</code> or <code>requestMiddleware</code> for <code>kettle.request</code>)</th>
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

The framework makes it very easy to adapt any standard express middleware into a middleware component by means of the adaptor grade `kettle.plainMiddlware`. This accepts any standard express
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
    <td><code>kettle.middleware.session</code></td>
    <td><a href="https://github.com/expressjs/session">expessjs/session</a></td>
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
    <td><code>allowMethods {String}</code> (default <code>"GET"</code>), </br><code>origin {String}</code> (default <code>*`), </br> <code>credentials {Boolean}</code> (default <code>true</code>) </br>- 
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


## DataSources

A DataSource is an Infusion component which meets a simple contract for read/write access to indexed data. DataSource is a simple semantic, broadly the same as that
encoded in [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete), although the current DataSource semantic does not provide explicitly for deletion.

The concrete DataSources in Kettle provide support for HTTP endpoints (with a particular variety specialised for accessing CouchDB databases with CRUDlike semantics) as well as the filesystem, with
an emphasis on JSON payloads.

The DataSource API is drawn from the following two methods – a read-only DataSource will just implement `get`, and a writeable DataSource will implement both `get` and `set`:

    /* @param directModel {Object} A JSON structure holding the "coordinates" of the state to be read -  
     * this model is morally equivalent to (the substitutable parts of) a file path or URL
     * @param options {Object} [Optional] A JSON structure holding configuration options good for just 
     * this request. These will be specially interpreted by the particular concrete grade of DataSource 
     * – there are no options valid across all implementations of this grade.
     * @return {Promise} A promise representing successful or unsuccessful resolution of the read state
     */
    dataSource.get(directModel, options);
    /* @param directModel {Object} As for get
     * @param model {Object} The state to be written to the coordinates
     * @param options {Object} [Optional] A JSON structure holding configuration options good for just 
     * this request. These will be specially interpreted by the 
     * particular concrete grade of DataSource – there are no options valid across all implementations 
     * of this grade. For example, a URL DataSource will accept an option `writeMethod` which will 
     * allow the user to determine which HTTP method (PUT or POST) will be used to implement the write
     * operation.
     * @return {Promise} A promise representing resolution of the written state,
     * which may also optionally resolve to any returned payload from the write process
     */
    dataSource.set(directModel, model, options);
    
### Simple example of using an HTTP dataSource

In this example we define and instantiate a simple HTTP-backed dataSource accepting one argument to configure a URL segment:

```javascript
var fluid = require("infusion"),
    kettle = require("../../kettle.js"),
    examples = fluid.registerNamespace("examples");


fluid.defaults("examples.httpDataSource", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://jsonplaceholder.typicode.com/posts/%postId",
    termMap: {
        postId: "directPostId"
    }
});

var myDataSource = examples.httpDataSource();
var promise = myDataSource.get({directPostId: 42});

promise.then(function (response) {
    console.log("Got dataSource response of ", response);
}, function (error) {
    console.error("Got dataSource error response of ", error);
});
```

You can run this snippet from our code samples by running `node simpleDataSource.js` from [examples/simpleDataSource](examples/simpleDataSource) in our samples area.
This contacts the useful JSON placeholder API service at [`jsonplaceholder.typicode.com`](http://jsonplaceholder.typicode.com/) to retrieve a small JSON document holding some placeholder text. If you get
a 404 or an error, please contact us and we'll update this sample to contact a new service. 

An interesting element in this snippet is the `termMap` configured as options of our dataSource. This sets up an indirection between the `directModel` supplied as the 
argument to the `dataSource.get` call, and the URL issued in the HTTP request. The keys in the `termMap` are interpolation variables in the URL, which in the URL are
prefixed by `%`. The values in the `termMap` represent paths which are dereferenced from the `directModel` argument. We document these configuration options in the
next section:

### Configuration options accepted by `kettle.dataSource.URL`


<table>
    <thead>
        <tr>
            <th colspan="3">Supported configurable options for a <code>kettle.dataSource.URL</code></th>
        </tr>
        <tr>
            <th>Option Path</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>writable</code></td>
            <td><code>Boolean</code> (default: <code>false</code>)</td>
            <td>If this option is set to <code>true</code>, a <code>set</code> method will be fabricated for this dataSource – otherwise, it will implement only a <code>get</code> method.</td>
        </tr>
        <tr>
            <td><code>writeMethod</code></td>
            <td><code>String</code> (default: <code>PUT</code>)</td>
            <td>The HTTP method to be used when the <code>set</code> method is operated on this writable DataSource (with <code>writable: true</code>). This defaults to <code>PUT</code> but
            <code>POST</code> is another option. Note that this option can also be supplied within the <code>options</code> argument to the <code>set</code> method itself.</td>
        </tr>
        <tr>
            <td><code>url</code></td>
            <td><code>String</code></td>
            <td>A URL template, with interpolable elements expressed by terms beginning with the <code>%</code> character, for the URL which will be operated by the <code>get</code> and 
            <code>set</code> methods of this dataSource. This URL may begin with the <code>file://</code> prefix, in which case the dataSource will be backed by the filesystem rather than
            HTTP requests.</td>
        </tr>
        <tr>
            <td><code>termMap</code></td>
            <td><code>Object</code> (map of <code>String</code> to <code>String</code>)</td>
            <td>A map, of which the keys are some of the interpolation terms held in the <code>url</code> string, and the values of which are paths into the <code>directModel</code> argument
            accepted by the <code>get</code> and <code>set</code> methods of the DataSource. By default any such values looked up will be <a href="https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">
            URI Encoded</a> before being interpolated into the URL – unless their value in the termMap is prefixed by the string <code>noencode:</code>.</td>
        </tr>
        <tr>
            <td><code>notFoundIsEmpty</code></td>
            <td><code>Boolean</code></a> (default: <code>false</code>)</td>
            <td>If this option is set to <code>true</code>, a fetch of a nonexistent resource (that is, a nonexistent file, or an HTTP resource giving a 404) will result in a <code>resolve</code> with an empty
            payload rather than a <code>reject</code> response.</td>
        </tr>
        <tr>
            <td><code>components.encoding.type</code></td>
            <td><code>String</code> (grade name)</td>
            <td>A <code>kettle.dataSource.URL</code> has a subcomponent named <code>encoding</code> which the user can override in order to choose the encoding used to read and write the <code>model</code>
            object to and from the textual form in persistence. This defaults to <code>kettle.dataSource.encoding.JSON</code>. Other builtin encodings are <code>kettle.dataSource.encoding.formenc</code> operating
            HTML <a href="http://www.w3.org/TR/html401/interact/forms.html#didx-applicationx-www-form-urlencoded">form encoding</code> and <code>kettle.dataSource.encoding.none</code> which applies no encoding.
            More details in <a href="#using-encodings-with-a-datasource">Using Encodings with a DataSource</a>.</td>
        </tr>
        <tr>
            <td><code>setResponseNamespaces</code></td>
            <td><code>Array of String</code></a> (default: <code>["encoding"]</code>)</td>
            <td>Contains a list of the namespaces of the transform elements (see section <a href="#transforming-promise-chains">transforming promise chains</a> that are to be applied if there is a response payload
            from the <code>set</code> method, which is often the case with an HTTP backend. With a JSON encoding these encoding typically happens symmetrically - with a JSON request one will receive a JSON response - 
            however, with other encoding such as <a href="http://www.w3.org/TR/html401/interact/forms.html#didx-applicationx-www-form-urlencoded">form encoding</a> this is often not the case and one might like to
            defeat the effect of trying to decode the HTTP response as a form. In this case, for example, one can override <code>setResponseNamespaces</code> with the empty array <code>[]</code>. </td>
        </tr>
    </tbody>
</table>

In addition, if the url's protocol is an HTTP/HTTPS protocol, rather than `file://`, a `kettle.dataSource.URL` component will accept any options accepted by node's native 
[`http.request`](https://nodejs.org/api/http.html#http_http_request_options_callback) constructor – supported in addition to the above are 
`protocol`, `host`, `port`, `headers`, `hostname`, `family`, `localAddress`, `socketPath`, `auth` and `agent`. All of these options will be overriden by options of the same names supplied as the `options` object 
supplied as the last argument to the dataSource's `get` and `set` methods. This is a good way, for example, to send custom HTTP headers along with a URL dataSource request. 
Note that any of these component-level options (e.g. `port`, `protocol`, etc.) that can be derived from parsing the `url` option will override the value from the url. Compare this setup with
the very similar one operated in the testing framework for [`kettle.test.request.http`](#kettle.test.request.http).

### Using encodings with a DataSource

`kettle.dataSource.URL` has a subcomponent named `encoding` which the user can override in order to choose the encoding used to convert the model seen at the `get/set` API to the textual form in which it is
transmitted by the dataSource. The encoding subcomponent will also correctly set the [`Content-Type`](http://www.w3.org/Protocols/rfc1341/4_Content-Type.html) header of the outgoing HTTP request in the
case of a `set` request. The encoding defaults to a JSON encoding represented by a subcomponent of type `kettle.dataSource.encoding.JSON`. Here is an example of choosing a different encoding to submit 
[form encoded](http://www.w3.org/TR/html401/interact/forms.html#didx-applicationx-www-form-urlencoded) data to an HTTP endpoint:

```javascript
fluid.defaults("examples.formDataSource", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://httpbin.org/post",
    writable: true,
    writeMethod: "POST",
    components: {
        encoding: {
            type: "kettle.dataSource.encoding.formenc"
        }
    },
    setResponseNamespaces: [] // Do not parse the "set" response as formenc - it is in fact JSON
});

var myDataSource = examples.formDataSource();
var promise = myDataSource.set(null, {myField1: "myValue1", myField2: "myValue2"});

promise.then(function (response) {
    console.log("Got dataSource response of ", JSON.parse(response));
}, function (error) {
    console.error("Got dataSource error response of ", error);
});
```

In this example we set up a form-encoded, writable dataSource targetted at the popular HTTP testing site `httpbin.org` sending a simple payload encoding two form elements. We use Kettle's built-in form encoding
grade by configuring an `encoding` subcomponent name `kettle.dataSource.encoding.formenc`. You can try out this
sample live in its place in the [examples directory](examples/formDataSource/formDataSource.js). Note that since this particular endpoint sends a JSON response rather than a form-encoded response,
we need to defeat the dataSource's attempt to apply the inverse decoding in the response by writing `setResponseNamespaces: []`.

### Built-in encodings 

Kettle features three built-in encoding grades which can be configured as the subcomponent of a dataSource named `encoding` in order to determine what encoding it applies to models. They are described in this table:

|Grade name| Encoding type | Content-Type header |
|----------|---------------|----------------|
|`kettle.dataSource.encoding.JSON`|[JSON](http://json.org)|`application/json`|
|`kettle.dataSource.encoding.formenc`|[form encoding](http://www.w3.org/TR/html401/interact/forms.html#didx-applicationx-www-form-urlencoded)|`application/x-www-form-urlencoded`|
|`kettle.dataSource.encoding.none`|No encoding|`text/plain`|

### Elements of an encoding component

You can operate a custom encoding by implementing a grade with the following elements, and using it as the `encoding` subcomponent in place of one of the built-in implementations in the above table:

|Member name| Type | Description |
|-----------|------|-------------|
|`parse`|`Function (String) -> Any`| Parses the textual form of the data from its encoded form into the in-memory form|
|`render`|`Function (Any) -> String`| Renders the in-memory form of the data into its textual form|
|`contentType`|`String`| Holds the value that should be supplied in the [`Content-Type`](http://www.w3.org/Protocols/rfc1341/4_Content-Type.html) of an outgoing HTTP request whose body is encoded in this form|

### The `kettle.dataSource.CouchDB` grade

Kettle includes a further grade, `kettle.dataSource.CouchDB`, which is suitable for reading and writing to the [`doc`](http://docs.couchdb.org/en/1.6.1/api/document/common.html) URL space of a [CouchDB](http://couchdb.apache.org/) database.
This is a basic implementation which simply adapts the base documents in this API to a simple CRUD contract, taking care of:

* Packaging and unpackaging the special `_id` and `_rev` fields which appear at top level in a CouchDB document
    * The user's document is in fact escaped in a top-level path named `value` to avoid conflicts between its keys and any of those of the CouchDB machinery
* Applying a "read-before-write" of the `_rev` field to minimise (but not eliminate completely) the possibility for a Couch-level conflict

This grade is not properly tested and still carries some (though very small) risk of a conflict during update – it should be used with caution. Please contact the development team if
you are interested in improved Couch-specific functionality.

## Advanced implementation notes on DataSources

In this section are a few notes for advanced users of DataSources, who are interested in extending their functionality or else in issuing I/O in Kettle by other means.

### Transforming promise chains

The detailed implementation of the Kettle DataSource is structured around a particular device taken from the Infusion Promises library, the concept of a "transforming promise chain". The core
DataSource grade implements two events, `onRead` and and `onWrite`. These events are fired during the `get` and `set` operations of the DataSource, respectively. 
These events are better described as "pseudoevents" since they are not fired in the conventional way – rather than each event 
listener receiving the same signature, each instead receives the payload returned by the previous listener – it may then transform this payload and produce its own return in the form
of a promise. Any promise rejection terminates the listener notification chain and propagates the failure to the caller. The virtue of this implementation strategy is that extra stages of processing
for the DataSource can be inserted and removed from any part of the processing chain by means of supplying suitable event [priorities](http://docs.fluidproject.org/infusion/development/Priorities.html) to
the event's [listeners](http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html#registering-a-listener-to-an-event). Both the JSON encoding/decoding and CouchDB wrapping/unwrapping
facilities for the DataSources are implemented in terms of event listeners of this type, rather than in terms of conditional implementation code. This is a powerful and open
implementation strategy which we plan to extend in future.

### Callback wrapping in DataSources

It's important that Kettle's inbuilt DataSources are used whenever possible when performing I/O from a Kettle application, since it is crucial that any running implementation
code is always properly contextualised by its appropriate [request component](#request-components). Kettle guarantees that the [IoC context](http://docs.fluidproject.org/infusion/development/Contexts.html) `{request}` 
will always be resolvable onto the appropriate request component from any code executing within that request. If arbitrary callbacks are supplied to node I/O APIs, the code executing in them
will not be properly contextualised. If for some reason a DataSource is not appropriate, you can manually wrap any callbacks that you use by supplying them to the API `kettle.wrapCallback`.
[Get in touch](#getting-started-and-community) with the dev team if you find yourself in this situation.


## Kettle Testing Framework

The Kettle testing framework, which can be used for issuing test fixtures against arbitrary HTTP and WebSockets servers, does not depend on
the rest of Kettle, but is bundled along with it. To get access to the testing framework, after

    var kettle = require("kettle");
    
then issue

    kettle.loadTestingSupport();
    
Note that any users of the Kettle Testing Framework need to list the [node-jqunit](https://www.npmjs.com/package/node-jqunit) module in the `devDependencies` section of their own `package.json`.
    
The Kettle testing framework flattens out what would be complex callback or promise-laden code into a declarative array of JSON records, each encoding 
a successive stage in the HTTP or WebSockets conversation. The Kettle testing framework makes use of 
Infusion's [IoC Testing Framework](http://docs.fluidproject.org/infusion/development/IoCTestingFramework.html) to encode the test fixtures – you should be familiar with this framework
as well as with the use of Infusion IoC in general before using it.

The standard use of the Kettle testing framework involves assembling arrays with alternating active and passive elements using the methods of the
testing request fixture components `kettle.test.request.http` and `kettle.test.request.ws`. The active records will use the `send` method of `kettle.test.request.http` 
(or one of the event firing methods of `kettle.test.request.ws`) to send a request to the server under test, and the passive records will contain a `listener` element
in order to listen to the response from the server and verify that it has a particular form. Before documenting these in detail, we'll construct a simple example,
testing the simple example application which we developed in the section describing [kettle applications](#kettle-applications).

```javascript
kettle.loadTestingSupport();
 
fluid.registerNamespace("examples.tests.simpleConfig");

examples.tests.simpleConfig.testDefs = [{
    name: "SimpleConfig GET test",
    expect: 2,
    config: {
        configName: "examples.simpleConfig",
        configPath: "%kettle/examples/simpleConfig"
    },
    components: {
        getRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/handlerPath",
                method: "GET"
            }
        }
    },
    sequence: [{
        func: "{getRequest}.send"
    }, {
        event: "{getRequest}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Received GET request from simpleConfig server",
            string: "{arguments}.0",
            request: "{getRequest}",
            expected: {
                message: "GET request received on path /handlerPath"
            }
        }
    }]
}];

kettle.test.bootstrapServer(examples.tests.simpleConfig.testDefs);
```

You can run a live version of this sample by running

    node testSimpleConfig.js
    
from the [examples/testingSimpleConfig](./examples/testingSimpleConfig) directory of this project.

This sample sets up JSON configuration to load the `examples.simpleConfig` application from this module's `examples` directory, and then
defines a single request test component, named `getRequest`, of type `kettle.test.request.http` which targets its path. The `sequence` section
of the configuration then consists of two elements – the first sends the request, and the second listens for the `onComplete` event fired by
the request and verifies that the returned payload is exactly as expected.

Note the use of two particular pieces of Kettle's infrastructure – firstly the use of module-relative paths, where we use the contextualised
reference `%kettle` in order to resolve a file path relative to the base directory of this module, and secondly the Kettle testing assert function
[`kettle.test.assertJSONResponse`](#helper-methods-for-making-assertions-on-oncomplete), which is a helpful all-in-one utility for verifying an HTTP response status code as well as response payload.

<a id="#kettle.test.request.http"></a>

### Configuration options available on `kettle.test.request.http`

To get a sense of the capabilities of a `kettle.test.request.http`, you should browse node.js's documentation for its [`http.request`](https://nodejs.org/api/http.html#http_http_request_options_callback),
for which this component is a wrapper. A `kettle.test.request.http` component accepts a number of options configuring its function:


<table>
    <thead>
        <tr>
            <th colspan="3">Supported configurable options for a <code>kettle.test.request.http</code></th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>path</code></td>
            <td><code>String</code> (default: <code>/</code>)</td>
            <td>The HTTP path to which this request is to be made</td>
        </tr>
        <tr>
            <td><code>method</code></td>
            <td><code>String</code> (default: <code>GET</code>)</td>
            <td>The HTTP method to be used to send the request</td>
        </tr>
        <tr>
            <td><code>port</code></td>
            <td><code>Number</code> (default: 8081)</td>
            <td>The port number on the server for this request to connect to</td>
        </tr>
        <tr>
            <td><code>termMap</code></td>
            <td><code>Object</code> (map of <code>String</code> to <code>String</code>)</td>
            <td>The keys of this map are interpolated terms within the <code>path</code> option (considered as a template where these keys will be prefixed by <code>%</code>). The values will be interpolated directly
            into the path. This structure will be merged with the option of the same name held in the <code>directOptions</code> argument to the request component's <code>send</code> method.</td>
        </tr>
        <tr>
            <td><code>headers</code></td>
            <td><code>Object/code></td>
            <td>The HTTP headers to be sent with the request</td>
    </tbody>
</table>

In addition, the `kettle.test.request.http` component will accept any options accepted by node's native [`http.request`](https://nodejs.org/api/http.html#http_http_request_options_callback) constructor – 
supported in addition to the above are `host`, `hostname`, `family`, `localAddress`, `socketPath`, `auth` and `agent`. All of these options will be overriden by options of the same names supplied as the <code>directOptions</code>
argument to the component's `send` method, described in the following section:

### Using a `kettle.test.request.http` – the `send` method

The primarily useful method on `kettle.test.request.http` is `send`. It accepts two arguments, `(model, directOptions)` :

<table>
    <thead>
        <tr>
            <th colspan="3">Arguments accepted by <code>send</code> method of <code>kettle.test.request.http</code></th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>model</code></td>
            <td><code>Object/String</code> (optional)</td>
            <td>If the HTTP method selected is one accepting a payload (PUT/POST), the payload to be sent by this HTTP request. If this is an <code>Object</code> it will be stringified as JSON, and if it is
            a <code>String</code> it will be sent as the request body directly.</td>
        </tr>
        <tr>
            <td><code>directOptions</code></td>
            <td><code>Object</code> (optional)</td>
            <td>A set of extra options governing processing of this request. This will be merged with options taken from the component options supplied to the `kettle.test.request.http` component in order
            to arrive at a merged set of per-request options. All of the options described in the previous table are supported here. In particular, entries in <code>headers</code> will be filled in by the implementation – 
            the header <code>Content-Length</code> will be populated automatically based on the supplied <code>model</code> to the <code>send</code> method,
            and the header <code>Content-Type</code> will default to <code>application/json</code> if no value is supplied</td>
        </tr>
    </tbody>
</table>

### Listening for a response from `kettle.test.request.http` – the `onComplete` event

The response to a `send` request will be notified to listeners of the component's `onComplete` event. Note that since a given `kettle.test.request.http` request component
can be used to send at most ***one*** request, there can be no confusion about which response is associated which which request. The `onComplete` event fires with the signature `(data, that, parsedData)`, 
which are described in the following table:

<table>
    <thead>
        <tr>
            <th colspan="3">Arguments fired by the <code>onComplete</code> event of <code>kettle.test.request.http</code></th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>data</code></td>
            <td><code>String</code></td>
            <td>The request body received from the HTTP request</td>
        </tr>
        <tr>
            <td><code>that</code></td>
            <td><code>Component</code></td>
            <td>The <code>kettle.test.request.http</code> component itself. <it><strong>Note</strong></it>: By the time this event fires, this component will have a member <code>nativeResponse</code> assigned, of type 
            <a href="https://nodejs.org/api/http.html#http_http_incomingmessage">http.IncomingMessage</a> – this object can be used to read off various standard pieces of the response to node.js's <code>http.ClientRequest</code>,
            including the HTTP <code>statusCode</code>, headers, etc.</td>
        </tr>
        <tr>
            <td><code>parsedData</code></td>
            <td><code>Object</code></td>
            <td>This final argument includes various pieces of special information parsed out of the server's response. Currently it contains only two members, `cookies` and `signedCookies`. The former simply contains
            the value of any standard header returned as <code>set-cookie</code> The latter is populated if a <code>cookieJar</code> is configured in this component's tree which is capable of parsing cookies encrypted
            with a "shared secret". Consult ths section on use of <a href="#using-cookies-with-an-http-testing-request">cookies</code></a> for more information.</td>
        </tr>
    </tbody>
</table>

### Helper methods for making assertions on onComplete

The Kettle testing framework includes two helper functions to simplify the process of making assertions on receiving the `onComplete` event of a `kettle.test.request.http` component. These are
named `kettle.test.assertJSONResponse`, which asserts that a successful HTTP response has been received with a particular JSON payload, and `kettle.test.assertErrorResponse`, which asserts
that an HTTP response was received, whilst checking for various details in the message. Both of these helper functions accept a single complex `options` object encoding all of their requirements,
which are documented in the following tables:

<table>
    <thead>
        <tr>
            <th colspan="3">Options accepted by the <code>kettle.test.assertJSONResponse</code> helper function</th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>string</code></td>
            <td><code>String</code></td>
            <td>The returned request body from the HTTP request</td>
        </tr>
        <tr>
            <td><code>request</code></td>
            <td><code>Component</code></td>
            <td>The <code>kettle.test.request.http</code> component which fired the request whose response is being tested</td>
        </tr>
        <tr>
            <td><code>statusCode</code></td>
            <td><code>Number</code> (default: 200)</td>
            <td>The expected HTTP status code in ther response</td>
        </tr>
        <tr>
            <td><code>expected</code></td>
            <td><code>Object</code></td>
            <td>The expected response payload, encoded as an <code>Object</code> – comparison will be made using a deep equality algorithm (<code>jqUnit.assertDeepEq</code>)</td>
        </tr>
    </tbody>
</table>

<code>kettle.test.assertErrorResponse</code> will expect that the returned HTTP response body will parse as a JSON structure.
In addition to the checks described in this table, <code>kettle.test.assertErrorResponse</code> will also assert that the returned payload has an `isError` member set to `true`:

<table>
    <thead>
        <tr>
            <th colspan="3">Options accepted by the <code>kettle.test.assertErrorResponse</code> helper function</th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>string</code></td>
            <td><code>String</code></td>
            <td>The returned request body from the HTTP request</td>
        </tr>
        <tr>
            <td><code>request</code></td>
            <td><code>Component</code></td>
            <td>The <code>kettle.test.request.http</code> component which fired the request whose response is being tested</td>
        </tr>
        <tr>
            <td><code>statusCode</code></td>
            <td><code>Number</code> (default: 500)</td>
            <td>The expected HTTP status code in ther response</td>
        </tr>
        <tr>
            <td><code>errorTexts</code></td>
            <td><code>String/Array of String</code></td>
            <td>A single <code>String</code> or array of <code>String</code>s which must appear at some index within the <code>message</code> field of the returned JSON response payload</td>
        </tr>
    </tbody>
</table>

### Using cookies with an HTTP testing request

A framework grade, `kettle.test.request.httpCookie`, derived from `kettle.test.request.http`, will cooperate with a component of type `kettle.test.cookieJar` which must be
configured higher in the component tree in order to store and parse cookies. The `kettle.test.cookieJar` is automatically configured as a child of the overall `fluid.test.testCaseHolder`, but
unless the `kettle.test.request.httpCookie` grade is used for the testing request, any returned cookies will be ignored. The `fluid.test.testCaseHolder` accepts an option, <code>secret</code>, which is
broadcast both to the server and to the cookieJar (using Infusion's [distributeOptions](http://docs.fluidproject.org/infusion/development/IoCSS.html) directive) in order to enable them to cooperate on transmitting signed cookies.
Consult the framework tests at [tests/shared/SessionTestDefs.js](./tests/shared/SessionTestDefs) for examples of how to write a sequence of HTTP fixtures enrolled in a session by means of returned cookies, both signed and unsigned.

These tests are also a good example of configuring custom [middleware](#working-with-middleware) into the middle of a request's middleware chain. These tests include a middleware grade named `kettle.tests.middleware.validateSession` which
will reject requests without a particular piece of populated session data, before processing reaches the request's `requestHandler`.

### Issuing WebSockets testing fixtures with `kettle.test.request.ws`

A sibling grade of `kettle.test.request.http` is `kettle.test.request.ws` which will allow the testing of WebSockets endpoints in an analogous way. You should browse the `ws` project's documentation for 
[ws.WebSocket](https://github.com/websockets/ws/blob/master/doc/ws.md#new-wswebsocketaddress-protocols-options) for which `kettle.test.request.ws` is a wrapper. As with `kettle.test.request.http`, messages are sent
using an invoker named `send`, with the difference that method may be invoked any number of times. The options for `kettle.test.request.ws` are as follows:

<table>
    <thead>
        <tr>
            <th colspan="3">Supported configurable options for a <code>kettle.test.request.ws</code></th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>path</code></td>
            <td><code>String</code> (default: <code>/</code>)</td>
            <td>The HTTP path to which this request is to be made</td>
        </tr>
        <tr>
            <td><code>port</code></td>
            <td><code>Number</code> (default: 8081)</td>
            <td>The port number on the server for this request to connect to</td>
        </tr>
        <tr>
            <td><code>sendJSON</code></td>
            <td><code>Boolean</code> (default: <code>true</code>)</td>
            <td>If this is set to <code>true</code>, the argument fired to the component's <code>send</code> method will be encoded as JSON. Otherwise the argument will be sent to <code>websocket.send</code> as is.</td>
        </tr>
        <tr>
            <td><code>receiveJSON</code></td>
            <td><code>Boolean</code> (default: <code>true</code>)</td>
            <td>If this is set to <code>true</code>, the argument fired to the component's <code>onMessage</code> method will be encoded as JSON. Otherwise the value will be transmitted as from the WebSocket's <code>message</code> event unchanged.</td>
        </tr>
        <tr>
            <td><code>webSocketsProtocols</code></td>
            <td><code>String/Array</code></td>
            <td>Forwarded to the <code>protocols</code> constructor argument of <a href="https://github.com/websockets/ws/blob/master/doc/ws.md#new-wswebsocketaddress-protocols-options"><code>ws.WebSocket</code></a></td>
        </tr>
        <tr>
            <td><code>termMap</code></td>
            <td><code>Object</code> (map of <code>String</code> to <code>String</code>)</td>
            <td>The keys of this map are interpolated terms within the <code>path</code> option (considered as a template where these keys will be prefixed by <code>%</code>). The values will be interpolated directly
            into the path. This structure will be merged with the option of the same name held in the <code>directOptions</code> argument to the request component's <code>send</code> method.</td>
        </tr>
        <tr>
            <td><code>headers</code></td>
            <td><code>Object</code></td>
            <td>The HTTP headers to be sent with the request</td>
    </tbody>
</table>

In addition to the above options, any option may be supplied that is supported by the `options` argument of [ws.WebSocket](https://github.com/websockets/ws/blob/master/doc/ws.md#new-wswebsocketaddress-protocols-options). 
These include, in addition to the above, `protocol`, `agent`, `protocolVersion`, `hostname`.

### Events attached to a `kettle.test.request.ws`

The following events may be listened to on a `kettle.test.request.ws` component:

<table>
    <thead>
        <tr>
            <th colspan="3">Events attached to a <code>kettle.test.request.ws</code></th>
        </tr>
        <tr>
            <th>Event name</th>
            <th>Arguments</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>onConnect</code></td>
            <td>None</td>
            <td>Fired when the <code>open</code> event of the underlying <code>ws.WebSocket</code> is fired. This event must be listened to in the fixture sequence before any attempt is made to fire messages from the
            component with <code>send</code></td>
        </tr>
        <tr>
            <td><code>onError</code></td>
            <td><code>(that: Component, error: Object)</td>
            <td>Fired either if an error occurs during the HTTP upgrade process, or if an <code>error</code> event is fired from the <code>ws.WebSocket</code> object once the socket is established. For an error during
            handshake, the <code>error</code> argument will be an object with <code>isError: true</code> and a <code>statusCode</code> field taken from the HTTP statusCode. For an <code>error</code> event, the 
            error will be the original error payload.</td>
        </tr>
        <tr>
            <td><code>onMessage</code></td>
            <td><code>(that: Component, data: String/Object)</td>
            <td>Fired whenever the underlying <code>ws.WebSocket</code> receives an <code>message</code> event. If the <code>receiveJSON</code> option to the component is <code>true</code> this value will have been
            JSON decoded.
        </tr>
    </tbody>
</table>

### Sending a message using the `send` method of `kettle.test.request.ws`

The signature of `kettle.test.request.ws` `send` is the same as that for `kettle.test.request.http`, with a very similar meaning: 

The primarily useful method on `kettle.test.request.http` is `send`. It accepts two arguments, `(model, directOptions)` :

<table>
    <thead>
        <tr>
            <th colspan="3">Arguments accepted by <code>send</code> method of <code>kettle.test.request.ws</code></th>
        </tr>
        <tr>
            <th>Option</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>model</code></td>
            <td><code>Object/String</code></td>
            <td>The payload to be sent with the underlying <code>ws.WebSocket.send</code> call. If the component's <code>sendJSON</code> option is set to <code>true</code> (the default), an Object sent here will be
            automatically JSON-encoded.</td>
        </tr>
        <tr>
            <td><code>directOptions</code></td>
            <td><code>Object</code> (optional)</td>
            <td>These options will be sent as the 2nd argument of <a href="https://github.com/websockets/ws/blob/master/doc/ws.md#websocketsenddata-options-callback"><code>ws.WebSocket.send</code></a></td>
        </tr>
    </tbody>
</table>

### Issuing session-aware WebSockets requests

Analogous with `kettle.test.request.http.cookie`, there is a session-aware variant of the request grade `kettle.test.request.ws`, named `kettle.test.request.ws.cookie`. Its behaviour is identical
with that of `kettle.test.request.http.cookie`, in particular being able to share access to the same `kettle.test.cookieJar` component to enable a mixed series of HTTP and WebSockets requests
to be contextualised by the same session cookies.

## Framework tests

Please consult the [test cases](./tests) for the framework for more examples of Kettle primitives as well as the Kettle testing framework in action.
