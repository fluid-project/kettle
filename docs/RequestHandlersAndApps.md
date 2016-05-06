---
title: Kettle Request Handlers and the kettle.app grade
layout: default
category: Kettle
---

A [`kettle.server'](Servers.md) comprises one or more `kettle.app` units, each of which comprises an independently mountable application unit. Within a [`kettle.app`](#kettle.app), each
type of request handled by the application is defined using a [`kettle.request`](#how-to-implement-a-request-handler) component. 

<a id="kettle.app"></a>

## Registering and implementing a request handler

Request handlers are registered in the `requestHandlers` section of the options of a `kettle.app` – see the [sample app](ConfigsAndApplications.md#a-simple-kettle-application) for positioning of this component in the
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
            <th colspan="3">Members defined by default at top-level on a (HTTP) request component of type <code>kettle.request.http</code></th>
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
            </td>
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
    </tbody>
</table>

Note that, in return, the Kettle request component will be marked onto the node.js request object so that it can easily be retrieved from standard middleware, etc. – it will be available as `req.fluidRequest` where `req` is the
request object described in the table above. More details follow on middleware in the section [working with middleware](Middleware.md#working-with-middleware).

<a id="kettle.request.ws"></a>

### Members defined by the Kettle framework at top-level on a WebSockets request component

WebSockets communications in a Kettle application are mediated by the [ws](https://github.com/websockets/ws) WebSockets library – you should get familiar with the documentation for
that library if you intend to use this functionality significantly. It is also worth spending some time familiarising yourself with at least some of the `ws` implementation code since there are several
aspects not properly covered by the documentation.

The request component for a WebSockets request, derived from the grade `kettle.request.ws` includes the members in the above table which are not marked as
`kettle.request.http` only, as well as several more members described in the following table:

<table>
    <thead>
        <tr>
            <th colspan="3">Members defined by default at top-level on a WebSockets request component of type <code>kettle.request.ws</code></th>
        </tr>
        <tr>
            <th>Member</th>
            <th>Type</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><code>events.onBindWs</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which is fired by the framework when the original HTTP connection has completed the 
            <a href="https://en.wikipedia.org/wiki/WebSocket#Protocol_handshake">handshake and upgrade sequence</a> and the <a href="https://github.com/websockets/ws/blob/master/doc/ws.md#class-wswebsocket"><code>ws.WebSocket</code></a>
            object has been allocated. Any listener registered to this event will receive two arguments - firstly, the <code>kettle.request.ws</code> component itself, and secondly 
            the <a href="https://github.com/websockets/ws/blob/master/doc/ws.md#class-wswebsocket"><code>ws.WebSocket</code></a> object.
            </td>
        </tr>
        <tr>
            <td><code>ws</code></td>
            <td><a href="https://github.com/websockets/ws/blob/master/doc/ws.md#class-wswebsocket"><code>ws.WebSocket</code></a></td>
            <td>The <code>ws.WebSocket</code> advertised by the <a href="https://github.com/websockets/ws"><code>ws</code></a> WebSockets library as allocated to handle one end of an established WebSockets connection. This will be of the variety
            referred to in the <code>ws</code> docs as "a WebSocket constructed by a Server". This member will only be present after the <code>onBindWs</code> event described in the previous row has fired.</td>
        </tr>
        <tr>
            <td><code>events.onReceiveMessage</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which is fired by the framework when a message is received from the client
            at the other end of the WebSockets connection. The arguments to the event are <code>(that, payload)</code> where <code>that</code> represents this request component itself, and <code>payload</code> represnts
            the payload sent by the client. If the <code>receiveMessageJSON</code> option is set to <code>true</code> for this component (the default), the payload will have been decoded as JSON.</td>
        </tr>
        <tr>
            <td><code>events.onSendMessage</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which can be fired by the implementor of the request handler when they want to send a message to the client.
            This event expects to receive just a single argument, the message payload. If the <code>sendMessageJSON</code> option is set to <code>true</code> for this component (the default), the payload will be encoded by the framework as JSON.</td>
        </tr>
        <tr>
            <td><code>events.onError</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>A standard <a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html">Infusion Event</a> which should be fired if the request is to send an error response.
            This event has the same name as the one fired by a <code>kettle.request.http</code> but the behaviour and semantic is different. Rather than sending an HTTP error response, the framework instead
            emits a WebSockets  event of type <code>error</code>. Because of this, the <code>statusCode</code> field of the event argument should not be used. However, it is recommended that the event payload
            still includes a field <code>message</code> of type <code>String</code> holding the error message to be returned to the client, as well as a boolean member <code>isError</code> with the value <code>true</code>.</td>
        </tr>
    </tbody>
</table>

### Ending a WebSockets conversation

The currently recommended scheme for terminating a WebSockets conversation managed by a `kettle.request.ws` component is to call the standard [`close`](https://github.com/websockets/ws/blob/master/doc/ws.md#websocketclosecode-data) method on the top-level
`ws` member. This accepts two optional arguments - a [WebSockets status code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent) and a description message. After processing the connection termination
sequence, the request component will be automatically destroyed by the framework.

### Example mini-application hosting a WebSockets endpoint

The following example shows a minimal Kettle application which hosts a single WebSockets request handler named `webSocketsHandler` at the path `/webSocketsPath`. This handler
simply logs any messages received to the console.

```javascript

fluid.defaults("examples.webSocketsConfig", {
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
                                webSocketsHandler: {
                                    "type": "examples.webSocketsConfig.handler",
                                    "route": "/webSocketsPath"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

fluid.defaults("examples.webSocketsConfig.handler", {
    gradeNames: "kettle.request.ws",
    listeners: {
        onReceiveMessage: "examples.webSocketsConfig.receiveMessage"
    }
});

examples.webSocketsConfig.receiveMessage = function (request, message) {
    console.log("Received WebSockets message " + JSON.stringify(message, null, 2));
};

// Construct the server using the above config
examples.webSocketsConfig();
```