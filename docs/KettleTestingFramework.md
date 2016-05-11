---
title: The Kettle Testing Framework
layout: default
category: Kettle
---

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
in order to listen to the response from the server and verify that it has a particular form. 

## A simple Kettle testing framework example

Before documenting the Kettle testing framework request grades `kettle.test.request.http` and `kettle.test.request.ws` in detail, we'll construct a simple example,
testing the simple example application which we developed in the section describing [kettle applications](ConfigsAndApplications.md#a-simple-kettle-application).

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
    
from the [examples/testingSimpleConfig](../examples/testingSimpleConfig) directory of this project.

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
            <td><code>Object</code></td>
            <td>The HTTP headers to be sent with the request</td>
        </tr>
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
Consult the framework tests at [tests/shared/SessionTestDefs.js](../tests/shared/SessionTestDefs.js) for examples of how to write a sequence of HTTP fixtures enrolled in a session by means of returned cookies, both signed and unsigned.

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
            <td>If this is set to <code>true</code>, the argument fired to the component's <code>onReceiveMessage</code> method will be encoded as JSON. Otherwise the value will be transmitted as from the WebSocket's <code>message</code> event unchanged.</td>
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
            <td><code>(that: Component)</code></td>
            <td>Fired when the <code>open</code> event of the underlying <code>ws.WebSocket</code> is fired. This event must be listened to in the fixture sequence before any attempt is made to fire messages from the
            component with <code>send</code></td>
        </tr>
        <tr>
            <td><code>onError</code></td>
            <td><code>(error: Object, that: Component, res: <a href="https://nodejs.org/api/http.html#http_http_incomingmessage">http.IncomingMessage</a>)</td>
            <td>Fired either if an error occurs during the HTTP upgrade process, or if an <code>error</code> event is fired from the <code>ws.WebSocket</code> object once the socket is established. For an error during
            handshake, the <code>error</code> argument will be an object with <code>isError: true</code> and a <code>statusCode</code> field taken from the HTTP statusCode. For an <code>error</code> event, the 
            error will be the original error payload.</td>
        </tr>
        <tr>
            <td><code>onReceiveMessage</code></td>
            <td><code>(data: String/Object, that: Component)</td>
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
