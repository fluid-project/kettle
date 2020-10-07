---
title: DataSources
layout: default
category: Kettle
---
# DataSources

A DataSource is an Infusion component which meets a simple contract for read/write access to indexed data.
DataSource is a simple semantic, broadly the same as that encoded in
[CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete), although the current DataSource semantic does
not provide explicitly for deletion.

The concrete DataSources in Kettle provide support for HTTP endpoints (with a particular variety specialised for
accessing CouchDB databases with CRUDlike semantics) as well as the filesystem, with an emphasis on JSON payloads.

The DataSource API is drawn from the following two methods – a read-only DataSource will just implement `get`, and a
writeable DataSource will implement both `get` and `set`:

```javascript
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
```

## Simple example of using an HTTP dataSource

In this example we define and instantiate a simple HTTP-backed dataSource accepting one argument to configure a URL
segment:

```javascript
var fluid = require("infusion"),
    kettle = require("../../kettle.js"),
    examples = fluid.registerNamespace("examples");


fluid.defaults("examples.httpDataSource", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://jsonplaceholder.typicode.com/posts/%postId",
    termMap: {
        postId: "%directPostId"
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

You can run this snippet from our code samples by running `node simpleDataSource.js` from
[examples/simpleDataSource](../examples/simpleDataSource) in our samples area.
This contacts the useful JSON placeholder API service at
[`jsonplaceholder.typicode.com`](http://jsonplaceholder.typicode.com/)
to retrieve a small JSON document holding some placeholder text. If you get a 404 or an error, please contact us and
we'll update this sample to contact a new service.

An interesting element in this snippet is the `termMap` configured as options of our dataSource. This sets up an
indirection between the `directModel` supplied as the argument to the `dataSource.get` call, and the URL issued in the
HTTP request. The keys in the `termMap` are interpolation variables in the URL, which in the URL are prefixed by `%`.
The values in the `termMap` represent either

* Plain values to be interpolated as strings directly into the URL, or
* If the first character of the value in the `termMap` is %, the remainder of the string represents a path which will
  be dereferenced from the `directModel` argument to the current `set` or `get` request.

In addition, if the term value has the prefix `noencode:`, it will be interpolated without any
[URI encoding](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent).

We document these configuration options in the next section:

## Configuration options accepted by `kettle.dataSource.URL`

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
            <td>If this option is set to <code>true</code>, a <code>set</code> method will be fabricated for this
                dataSource – otherwise, it will implement only a <code>get</code> method.</td>
        </tr>
        <tr>
            <td><code>writeMethod</code></td>
            <td><code>String</code> (default: <code>PUT</code>)</td>
            <td>The HTTP method to be used when the <code>set</code> method is operated on this writable DataSource
                (with grade <code>fluid.dataSource.writable</code>). This defaults to <code>PUT</code> but
                <code>POST</code> is another option. Note that this option can also be supplied within the
                <code>options</code> argument to the <code>set</code> method itself.</td>
        </tr>
        <tr>
            <td><code>url</code></td>
            <td><code>String</code></td>
            <td>A URL template, with interpolable elements expressed by terms beginning with the <code>%</code>
                character, for the URL which will be operated by the <code>get</code> and <code>set</code> methods of
                this dataSource.</td>
        </tr>
        <tr>
            <td><code>termMap</code></td>
            <td><code>Object</code> (map of <code>String</code> to <code>String</code>)</td>
            <td>A map, of which the keys are some of the interpolation terms held in the <code>url</code> string,
                and the values will be used to perform the interpolation. If a value begins with <code>%</code>,
                the remainder of the string represents a
                <a href="http://docs.fluidproject.org/infusion/development/FrameworkConcepts.html#el-paths">path</a>
                into the <code>directModel</code> argument accepted by the <code>get</code> and <code>set</code>
                methods of the DataSource. By default any such values looked up will be
                <a href="https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent">
                URI Encoded</a> before being interpolated into the URL – unless their value in the termMap is
                prefixed by the string <code>noencode:</code>.</td>
        </tr>
        <tr>
            <td><code>notFoundIsEmpty</code></td>
            <td><code>Boolean</code></a> (default: <code>false</code>)</td>
            <td>If this option is set to <code>true</code>, a fetch of a nonexistent resource (that is, a
            nonexistent file, or an HTTP resource giving a 404) will result in a <code>resolve</code> with an empty
            payload rather than a <code>reject</code> response.</td>
        </tr>
        <tr>
            <td><code>censorRequestOptionsLog</code></td>
            <td><code>Object</code> (map of <code>String</code> to <code>Boolean</code>) (default:
                <code>{auth: true, "headers.Authorization": true}</code>)
            </td>
            <td>A map of paths into the <a href="https://nodejs.org/api/http.html#http_http_request_options_callback">
                request options</a> which should be censored from appearing in logs. Any path which maps to <code>true</code>
                will not appear either in the logging output derived from the request options parsed from the url
                or the url itself.
            </td>
        </tr>
        <tr>
            <td><code>components.encoding.type</code></td>
            <td><code>String</code> (grade name)</td>
            <td>A <code>kettle.dataSource.URL</code> has a subcomponent named <code>encoding</code> which the user can
                override in order to choose the encoding used to read and write the <code>model</code>
                object to and from the textual form in persistence. This defaults to
                <code>kettle.dataSource.encoding.JSON</code>. Other builtin encodings are
                <code>kettle.dataSource.encoding.formenc</code> operating HTML
                <a href="http://www.w3.org/TR/html401/interact/forms.html#didx-applicationx-www-form-urlencoded">form
                encoding</a> and <code>kettle.dataSource.encoding.none</code> which applies no encoding.
                More details in <a href="#using-content-encodings-with-a-datasource">Using Content Encodings with a
                DataSource</a>.</td>
        </tr>
        <tr>
            <td><code>setResponseTransforms</code></td>
            <td><code>Array of String</code></a> (default: <code>["encoding"]</code>)</td>
            <td>Contains a list of the namespaces of the transform elements (see section
                <a href="#transforming-promise-chains">transforming promise chains</a> that are to be applied if there
                is a response payload from the <code>set</code> method, which is often the case with an HTTP backend.
                With a JSON encoding these encoding typically happens symmetrically - with a JSON request one will
                receive a JSON response - however, with other encoding such as
                <a href="http://www.w3.org/TR/html401/interact/forms.html#didx-applicationx-www-form-urlencoded">form
                encoding</a> this is often not the case and one might like to defeat the effect of trying to decode
                the HTTP response as a form. In this case, for example, one can override
                <code>setResponseTransforms</code> with the empty array <code>[]</code>. </td>
        </tr>
        <tr>
            <td><code>charEncoding</code></td>
            <td><code>String</code> (default: <code>utf8</code>)</td>
            <td>The character encoding of the incoming HTTP stream used to convert its data to characters - this will
                be sent directly to the
                <a href="https://nodejs.org/api/stream.html#stream_readable_setencoding_encoding">setEncoding</code>
                method of the response stream</td>
        </tr>
        <tr>
            <td><code>invokers.resolveUrl</code></td>
            <td><a href="http://docs.fluidproject.org/infusion/development/Invokers.html"><code>IoC Invoker</code></a>
                (default: <code>kettle.dataSource.URL.resolveUrl</code>)</td>
            <td>This invoker can be overridden to customise the process of building the url for a dataSource request.
                The default implementation uses an invocation of
                <a href="http://docs.fluidproject.org/infusion/development/CoreAPI.html#fluid-stringtemplate-template-terms-"><code>fluid.stringTemplate</code></a>
                to interpolate elements from <code>termMap</code> and the <code>directModel</code> argument into the
                template string held in <code>url</code>. By overriding this invoker, the user can implement a
                strategy of their choosing. The supplied arguments to the invoker consist of the values
                <code>(url, termMap, directModel)</code> taken from these options and the dataSource request arguments,
                but the override can replace these with any IoC-sourced values in the invoker definition.</td>
        </tr>
    </tbody>
</table>

In addition, a `kettle.dataSource.URL` component will accept any options accepted by node's native
[`http.request`](https://nodejs.org/api/http.html#http_http_request_options_callback) constructor – supported in
addition to the above are `protocol`, `host`, `port`, `headers`, `hostname`, `family`, `localAddress`, `socketPath`,
`auth` and `agent`. All of these options will be overriden by options of the same names supplied as the `options` object
supplied as the last argument to the dataSource's `get` and `set` methods. This is a good way, for example, to send
custom HTTP headers along with a URL dataSource request. Note that any of these component-level options (e.g. `port`,
`protocol`, etc.) that can be derived from parsing the `url` option will override the value from the url. Compare this
setup with the very similar one operated in the testing framework for
[`kettle.test.request.http`](KettleTestingFramework.md#kettle.test.request.http).

## Configuration options accepted by `kettle.dataSource.file`

An alternative dataSource implementation is `kettle.dataSource.file` - this is backed by the node filesystem API to
allow files to be read and written in various encodings. The interpolation support based on `termMap` is very similar
to that for `kettle.dataSource.URL`, but with the location template option named `path` representing an absolute
filesystem path rather than the `url` property of `kettle.dataSource.URL` representing
a URL.

Exactly the same scheme based on the subcomponent named `encoding` can be used to control content encoding for a
`kettle.dataSource.file` as for a `kettle.dataSource.URL`. Similarly, `kettle.dataSource.file` supports
a further option named `charEncoding` which can select between various of the character encodings supported by node.js.

<table>
    <thead>
        <tr>
            <th colspan="3">Supported configurable options for a <code>kettle.dataSource.file</code></th>
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
            <td>If this option is set to <code>true</code>, a <code>set</code> method will be fabricated for this
                dataSource – otherwise, it will implement only a <code>get</code> method.</td>
        </tr>
        <tr>
            <td><code>path</code></td>
            <td><code>String</code></td>
            <td>An (absolute) file path template, with interpolable elements expressed by terms beginning with the
                <code>%</code> character, for the file which will be read and written the <code>get</code> and
                <code>set</code> methods of this dataSource.</td>
        </tr>
        <tr>
            <td><code>termMap</code></td>
            <td><code>Object</code> (map of <code>String</code> to <code>String</code>)</td>
            <td>A map, of which the keys are some of the interpolation terms held in the <code>url</code> string, and
                the values, if prefixed by <code>%</code> are paths into the <code>directModel</code> argument
                accepted by the <code>get</code> and <code>set</code> methods of the DataSource.</td>
        </tr>
        <tr>
            <td><code>charEncoding</code></td>
            <td><code>String</code> (default: <code>utf8</code></td>
            <td>The character encoding of the file used to convert its data to characters - one of the values supported
                by the <a href="https://nodejs.org/api/fs.html#fs_fs_createreadstream_path_options">node filesystem
                API</a> - values it advertises include <code>utf8</code>, <code>ascii</code> or <code>based64</code>.
                There is also evidence of support for <code>ucs2</code>.</td>
        </tr>
    </tbody>
</table>

A helpful mixin grade for `kettle.dataSource.file` is `kettle.dataSource.file.moduleTerms` which will allow
interpolation by any module name registered with the Infusion module system
[`fluid.module.register`](http://docs.fluidproject.org/infusion/development/NodeAPI.html#fluid-module-register-name-basedir-modulerequire-)
 – e.g. `%kettle/tests/data/couchDataSourceError.json`.

## Using content encodings with a DataSource

`kettle.dataSource.URL` has a subcomponent named `encoding` which the user can override in order to choose the content
encoding used to convert the model seen at the `get/set` API to the textual (character) form in which it is
transmitted by the dataSource. The encoding subcomponent will also correctly set the
[`Content-Type`](http://www.w3.org/Protocols/rfc1341/4_Content-Type.html) header of the outgoing HTTP request in the
case of a `set` request. The encoding defaults to a JSON encoding represented by a subcomponent of type
`kettle.dataSource.encoding.JSON`. Here is an example of choosing a different encoding to submit
[form encoded](http://www.w3.org/TR/html401/interact/forms.html#didx-applicationx-www-form-urlencoded) data to an HTTP
endpoint:

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
    setResponseTransforms: [] // Do not parse the "set" response as formenc - it is in fact JSON
});

var myDataSource = examples.formDataSource();
var promise = myDataSource.set(null, {myField1: "myValue1", myField2: "myValue2"});

promise.then(function (response) {
    console.log("Got dataSource response of ", JSON.parse(response));
}, function (error) {
    console.error("Got dataSource error response of ", error);
});
```

In this example we set up a form-encoded, writable dataSource targetted at the popular HTTP testing site `httpbin.org`
sending a simple payload encoding two form elements. We use Kettle's built-in form encoding grade by configuring an
`encoding` subcomponent name `kettle.dataSource.encoding.formenc`. You can try out this sample live in its place in the
[examples directory](examples/formDataSource/formDataSource.js). Note that since this particular endpoint sends a JSON
response rather than a form-encoded response,
we need to defeat the dataSource's attempt to apply the inverse decoding in the response by writing
`setResponseTransforms: []`.

## Built-in content encodings

Kettle features three built-in content encoding grades which can be configured as the subcomponent of a dataSource
named `encoding` in order to determine what encoding it applies to models. They are described in this table:

|Grade name| Encoding type | Content-Type header |
|----------|---------------|----------------|
|`kettle.dataSource.encoding.JSON`|[JSON](http://json.org)|`application/json`|
|`kettle.dataSource.encoding.JSON5`|[JSON5](http://json5.org)|`application/json5`|
|`kettle.dataSource.encoding.formenc`|[form encoding](http://www.w3.org/TR/html401/interact/forms.html#didx-applicationx-www-form-urlencoded)|`application/x-www-form-urlencoded`|
|`kettle.dataSource.encoding.none`|No encoding|`text/plain`|

## Elements of an encoding component

You can operate a custom encoding by implementing a grade with the following elements, and using it as the `encoding`
subcomponent in place of one of the built-in implementations in the above table:

|Member name| Type | Description |
|-----------|------|-------------|
|`parse`|`Function (String) -> Any`| Parses the textual form of the data from its encoded form into the in-memory form|
|`render`|`Function (Any) -> String`| Renders the in-memory form of the data into its textual form|
|`contentType`|`String`| Holds the value that should be supplied in the
[`Content-Type`](http://www.w3.org/Protocols/rfc1341/4_Content-Type.html) of an outgoing HTTP request whose body is
encoded in this form|

## The `kettle.dataSource.CouchDB` mixin grade

Kettle includes a further mixin grade, `kettle.dataSource.CouchDB`, which is suitable for reading and writing to the
[`doc`](http://docs.couchdb.org/en/1.6.1/api/document/common.html) URL space of a [CouchDB](http://couchdb.apache.org/)
database.
This can be applied to either a `kettle.dataSource.URL` or a `kettle.dataSource.file` (the latter clearly only useful
for testing purposes). This is a basic implementation which simply adapts the base documents in this API to a simple
CRUD contract, taking care of:

* Packaging and unpackaging the special `_id` and `_rev` fields which appear at top level in a CouchDB document
  * The user's document is in fact escaped in a top-level path named `value` to avoid conflicts between its keys and
    any of those of the CouchDB machinery. If you wish to change this behavior, you can do so by providing different
    [model transformation rules](http://docs.fluidproject.org/infusion/development/ModelTransformationAPI.html) in
    `options.rules.readPayload` and `options.rules.writePayload`.
* Applying a "read-before-write" of the `_rev` field to minimise (but not eliminate completely) the possibility for a
  Couch-level conflict

This grade is not properly tested and still carries some (though very small) risk of a conflict during update – it
should be used with caution. Please contact the development team if you are interested in improved Couch-specific
functionality.

## Advanced implementation notes on DataSources

In this section are a few notes for advanced users of DataSources, who are interested in extending their functionality
or else in issuing I/O in Kettle by other means.

### Transforming promise chains

The detailed implementation of the Kettle DataSource is structured around a particular device taken from the Infusion
Promises library, the concept of a
["transforming promise chain"](http://docs.fluidproject.org/infusion/development/PromisesAPI.html#fluid-promise-firetransformevent-event-payload-options-).
The core DataSource grade implements two events, `onRead` and and `onWrite`. These events are fired during the `get` and
`set` operations of the DataSource, respectively.
These events are better described as "pseudoevents" since they are not fired in the conventional way – rather than each
event listener receiving the same signature, each instead receives the payload returned by the previous listener – it
may then transform this payload and produce its own return in the form of a promise. Any promise rejection terminates
the listener notification chain and propagates the failure to the caller. The DataSource implementation in fact fires
these events by invoking the
[`fireTransformEvent`](http://docs.fluidproject.org/infusion/development/PromisesAPI.html#fluid-promise-firetransformevent-event-payload-options-)
function from Infusion's Promises API.

The virtue of this implementation strategy is that extra stages of processing
for the DataSource can be inserted and removed from any part of the processing chain by means of supplying suitable
event [priorities](http://docs.fluidproject.org/infusion/development/Priorities.html) to
the event's
[listeners](http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html#registering-a-listener-to-an-event).
Both the JSON encoding/decoding and CouchDB wrapping/unwrapping facilities for the DataSources are implemented in
terms of event listeners of this type, rather than in terms of conditional implementation code. This is a powerful and
open implementation strategy which we plan to extend in future.

### Callback wrapping in DataSources

It's important that Kettle's inbuilt DataSources are used whenever possible when performing I/O from a Kettle
application, since it is crucial that any running implementation code is always properly contextualised by its
appropriate [request component](RequestHandlersAndApps.md#request-components). Kettle guarantees that the
[IoC context](http://docs.fluidproject.org/infusion/development/Contexts.html) `{request}` will always be resolvable
onto the appropriate request component from any code executing within that request. If arbitrary callbacks are supplied
to node I/O APIs, the code executing in them will not be properly contextualised. If for some reason a DataSource is
not appropriate, you can manually wrap any callbacks that you use by supplying them to the API `kettle.wrapCallback`.
[Get in touch](../README.md#getting-started-and-community) with the dev team if you find yourself in this situation.
