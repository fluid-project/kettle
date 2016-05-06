---
title: Kettle Servers
layout: default
category: Kettle
---

Kettle includes two builtin grades, [kettle.server](#kettle.server) for defining a plain HTTP server, and a derived grade [kettle.server.ws)(#kettle.server.ws) for defining a server
capable of handling WebSockets endpoints. The former wraps the standard facilities of node.js for constructing an [`http.Server`](https://nodejs.org/api/http.html#http_class_http_server), and
the latter wraps the facilities of the [ws WebSockets library](https://github.com/websockets/ws) for constructing a [`ws.Server`](https://github.com/websockets/ws/blob/master/doc/ws.md#new-wsserveroptions-callback). In both
cases, the Kettle grades can either accept servers previously constructed and injected in configuration, or can take responsibility for constructing the native servers themselves (the default).

<a id="kettle.server"></a>

## Configuration options for a `kettle.server`

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
            <td><a href="#structure-of-entries-in-a-middlewaresequence"><code>middlewareSequence</code></a></td>
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
            <td><code>events.onContributeRouteHandlers</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html"><code>Event</code></a></td>
            <td>This event is useful for authors trying to integrate with 3rd-party express applications. This is a useful lifecycle point, before Kettle registers its own route handlers to the express application,
            for an external integrator to register their own route handlers first, e.g. using <code>app.get</code> etc.. Fired with one argument, the server component itself – typically only <code>that.expressApp</code> will be of interest to the listener</code></td>
        </tr>      
    </tbody>
</table>

<a id="kettle.server.ws"></a>

## Configuration options for a `kettle.server.ws`

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
