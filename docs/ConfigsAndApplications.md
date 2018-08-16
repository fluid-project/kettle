---
title: Kettle Configs and Applications
layout: default
category: Kettle
---
# Kettle Configs and Applications

The top-level structure of a Kettle application can be described by a "config" file in JSON or
[JSON5](http://json5.org/) format. A Kettle "config" describes the configuration of a number of "Kettle apps"
([grade](http://docs.fluidproject.org/infusion/development/ComponentGrades.html)
[`kettle.app`](RequestHandlersAndApps.md#kettle.app)) hosted in a number of "Kettle servers"
(grade [`kettle.server`](Servers.md)).

The config JSON (or JSON5) file represents an Infusion
[component tree](http://docs.fluidproject.org/infusion/development/HowToUseInfusionIoC.html). If you aren't familiar
with the syntax and meaning of component trees, it is a good idea to browse the documentation, tutorials and examples
at the Infusion [documentation site](http://docs.fluidproject.org/infusion/development/). Kettle components are
currently derived from the base grade `fluid.component`, so you can ignore for these purposes the parts of the Infusion
documentation relating to model and view components.

Note that Kettle configs can represent any Infusion applications; they are not
restricted to representing just Kettle applications. Their structure is
freeform, other than the top level derived from `fluid.component`, and they may
be used to encode any Infusion application as a component tree.

## A simple Kettle application

In this section, we will construct a simple Kettle application within JavaScript code, to produce a self-contained
example. You can find and try out this same application represented in two forms in the
[examples/simpleConfig](../examples/simpleConfig) directory.

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

The JSON "config" form of the application itself is held at
[examples/simpleConfig/examples.simpleConfig.json](../examples/simpleConfig/examples.simpleConfig.json),
which encodes the same information as in the first `fluid.defaults` call above. The definitions for request handlers
such as `examples.simpleConfig.handler` and `examples.simpleConfig.handleRequest`, which in our sample are held in
[examples/simpleConfig/simpleConfig-config-handler.js](../examples/simpleConfig/simpleConfig-config-handler.js),
always need to be supplied in standard `.js` files required by the application – although future versions of Kettle
may allow the defaults for the handler grade to be encoded in JSON. Consult the Infusion framework documentation on
[grades](http://docs.fluidproject.org/infusion/development/ComponentGrades.html) if you are not familiar with this
kind of configuration.

You can try out these samples in [examples/simpleConfig](../examples/simpleConfig) by, for example, from that
directory, typing `node simpleConfig-config-driver.js`. The last line of the driver files load a common module,
`simpleConfig-client.js` which tests the server by firing an HTTP request to it and logging the payload – this uses
one of the HTTP client drivers taken from Kettle's
[testing](KettleTestingFramework.md) definitions. Later on, we will see how to issue formal test fixtures against this
application by using the [Kettle testing framework](KettleTestingFramework.md).

## Starting an application encoded by a Kettle config

An application encoded as a Kettle config can be started in a variety of ways,
both programmatically and from the command line - as well as being easily embedded
into other applications, whether they are Infusion component trees or raw Express apps.

### Starting a Kettle config programmatically

Kettle includes a driver function, `kettle.config.loadConfig` which will load and run a Kettle application defined as a
JSON or JSON5 file in the filesystem. It accepts an `options` structure which includes the
following fields:

|Member name| Type | Description |
|-----------|------|-------------|
|`configName`| `String` | The name of the config (the bare filename, minus any extension) which is to be loaded|
|`configPath`| `String` | The directory holding the config. This path may start with a symbolic module reference, e.g.
of the form `%kettle`, to a module which has been registered using Infusion's module API
[`fluid.module.register`](http://docs.fluidproject.org/infusion/development/NodeAPI.html#fluid-module-register-name-basedir-modulerequire-)|

`kettle.config.loadConfig` will return the (Infusion) component instance of the initialised application. You could use
this, for example, to terminate the application using its ``destroy()`` method.

An alternative to `kettle.config.loadConfig` is `kettle.config.createDefaults`. This accepts the same arguments but
simply loads the config as a [grade](http://docs.fluidproject.org/infusion/development/ComponentGrades.html)
rather than instantiating it as well. The return value from `kettle.config.loadConfig` is the grade name of the
application. You can construct this application later by use of Infusion's
[`invokeGlobalFunction`](http://docs.fluidproject.org/infusion/development/CoreAPI.html#fluid-invokeglobalfunction-functionpath-args-)
API, or else embed it in a wider application as a subcomponent.

### Starting a Kettle config from the command line

Kettle includes a top-level driver file named `init.js` which will accept values from the command line and the
environment variable ``NODE_ENV`` in order to determine which application config to start.
For example, from Kettle's top-level directory you can run

```shell
    node init.js <configPath> [<configName>]
````

The `configPath` argument is required - its meaning is as given in the `configPath` option to
`kettle.config.loadConfig` call described in the previous section.

The `configName` argument is optional. If this value is not supplied at the command line, it will be read from the
environment variable ``NODE_ENV``.
The meaning is as given in the `configName` option to `kettle.config.loadConfig` described in the previous section.

For example, you can start the sample app from the [previous section](#a-simple-kettle-application) by running

```shell
   node init.js examples/simpleConfig examples.simpleConfig
```

from the root directory of a Kettle checkout.

## Referring to external data via resolvers

Kettle configs may refer to external data, for example encoded in environment
variables, files, or other sources. This is achieved via Infusion's
[expander](http://docs.fluidproject.org/infusion/development/ExpansionOfComponentOptions.html#expanders) syntax
within the config, together with some standard built-in global functions
representing _resolvers_.

Here is an example of a little config which accepts a `url` property from an
environment variable named `KETTLE_ENV_TEST`, via Infusion's
[compact syntax](http://docs.fluidproject.org/infusion/development/ExpansionOfComponentOptions.html#compact-format-for-expanders):

```json
{
    "type": "fluid.component",
    "options": {
        "url": "@expand:kettle.resolvers.env(KETTLE_ENV_TEST)"
    }
}
```

If you need the ability for the target configuration to retain its default
value in the case that the resolver value is missing, you should use
Infusion's [options distributions](http://docs.fluidproject.org/infusion/development/IoCSS.html)
to target the resolved value rather than writing it at top level within the config.

### kettle.resolvers.env

`kettle.resolvers.env` is a global function which allows the resolution of
environment variables. It accepts one argument, which is the name of the
environment variable to be resolved. If the environment variable is not defined,
the function returns `undefined`.

### kettle.resolvers.file

`kettle.resolvers.file` is a global function which allows the resolution of
material held in text files. It accepts one argument, which is the name of the
file to be loaded. The filename may contain
[module-relative path]("http://docs.fluidproject.org/infusion/development/NodeAPI.html#node-js-module-apis") such as
`%kettle` to indicate a path relative to a module registered with Infusion.

The file must contain text in the UTF-8 encoding. The contents of the file will be
loaded via node's `fs.loadFileSync` API and returned as a string.

### kettle.resolvers.args

`kettle.resolvers.args` is a global function which allows the resolution of
the command-line arguments that the current node application was started with.
It accepts zero or one arguments. If supplied no arguments, it will return the
full value of node's `process.argv` argument array. If supplied one argument,
it will return the value of using this to index into `process.argv`.

## Structure of a Kettle application's config

In the previous section, we saw a [simple example](../examples/simpleConfig/examples.simpleConfig.json) of a
JSON-formatted Kettle config, which declaratively encodes a Kettle application structure.
In this section we describe the top-level members of this structure, and in the next secion we'll look at the
containment structure in terms of [grades](http://docs.fluidproject.org/infusion/development/ComponentGrades.html).
In the rest of this document we'll describe the options accepted by the various grades which make up a Kettle
application (`kettle.server`, `kettle.app`, `kettle.middleware` and `kettle.request`). The structure of our
minimal application will serve as a general template – the full definition of a Kettle application consists of a
config, ***plus*** definitions of request handler grades ***plus*** implementations of request handler functions.

<table>
    <thead>
        <tr>
            <th colspan="3">Top-level members of a Kettle application's "config" configuration file</th>
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
            <td>The type name for this config. This should be a fully-qualified grade name – it is suggested that it
                agree with the file name of the config file without the <code>.json</code> extension.</td>
        </tr>
        <tr>
            <td><code>options</code></td>
            <td><code>Object</code> (component options)</td>
            <td>The options for the application structure. These should start with the application's
                <code>gradeNames</code> which will usually just be <code>fluid.component</code>, and then continue
                with <code>components</code> designating the next level of containment of the application, the
                <code>kettle.server</code> level – see the next section on
                <a href="#containment-structure-of-a-kettle-application">containment structure of a Kettle
                application</a> for the full structure</td>
        </tr>
        <tr>
            <td><code>mergeConfigs</code> (optional)</td>
            <td><code>String/Array of String</code></td>
            <td>A filename (or array of these) of other config files which are to be included into this application.
            These names may begin with a
            <a href="http://docs.fluidproject.org/infusion/development/NodeAPI.html#node-js-module-apis">module-relative
            path</a> such as <code>%kettle</code> or else will be interpreted as
            paths relative to this config's location in the filesystem. The filenames may either end with a
            <code>.json</code> or a <code>.json5</code> extension representing configuration files in those formats,
            or the extension may be omitted in which case both of those extensions (in the order <code>.json</code>,
            <code>.json5</code>) will be tried as possibilities. Each config file will be loaded and resolved as a
            grade and then merged with the structure of this config (via an algorithm similar to
            <a href="https://api.jquery.com/jquery.extend/">jQuery.extend</a> – note that because of a current
            Infusion framework bug <a href="https://issues.fluidproject.org/browse/FLUID-5614">FLUID-5614</a>,
            all of the semantics of nested
            <a href="http://docs.fluidproject.org/infusion/development/OptionsMerging.html">options merging</a> will
            not be respected and the merging will occur in a simple-minded way below top level)</td>
        </tr>
        <tr>
            <td><code>loadConfigs</code> (optional)</td>
            <td><code>String/Array of String</code></td>
            <td>A filename (or array of these) of other config files which will be loaded before this config is
            interpreted. These names may begin with a
            <a href="http://docs.fluidproject.org/infusion/development/NodeAPI.html#node-js-module-apis">module-relative
            path</a> such as <code>%kettle</code> or else will be interpreted as paths relative to this config's
            location in the filesystem. As with <code>mergeConfigs</code>, the filenames may be specified with
            <code>.json</code>, <code>.json5</code> or no extension. Each filename listed here will be loaded and
            resolved as a grade. The workflow is similar to that with <code>mergeConfigs</code>, only the grades
            represented in <code>loadConfigs</code> will not be automatically merged with the current config as parent
            grades. Instead, the user is free to refer to them as required - for example as the <code>type</code> or
            <code>gradeNames</code> of a
            <a href="http://docs.fluidproject.org/infusion/development/SubcomponentDeclaration.html">subcomponent</a></td>
        </tr>
        <tr>
            <td><code>require</code> (optional)</td>
            <td><code>String/Array of String</code></td>
            <td>A <a href="https://nodejs.org/api/modules.html">module identifier</a> (or array of these) that will be
            loaded when this config is loaded. These modules will be loaded as if by the standard node.js API
            <a href="https://nodejs.org/api/modules.html"><code>require</code></a> operating from the config's
            directory (the
            <a href="https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders">global folder
            rules</a> will be ignored).
            These names may begin with a
            <a href="http://docs.fluidproject.org/infusion/development/NodeAPI.html#node-js-module-apis">module-relative
            path</a> such as <code>%kettle</code> to indicate a path relative to a module registered with Infusion.</td>
        </tr>
    </tbody>
</table>

## Containment structure of a Kettle application

The overall structure of a Kettle application within its config shows a 4-level pattern:

* At top level, the application container – this has the simple grade `fluid.component` and does not carry any
  functionality – it is simply used for grouping the definitions at the next level
  * At 2nd level, one or more Kettle servers – these have the grade [`kettle.server`](Servers.md) – in the case there
    is just one server it is conventionally named `server`
    * At 3rd level, one more Kettle apps – these have the grade
      [`kettle.app`](RequestHandlersAndApps.md#kettle.app) – this is the level at which independently mountable
      segments of applications are grouped (an app is a grouping of handlers)
      * At 4th level, one or more Kettle request handlers – these have the grade
        [`kettle.request`](RequestHandlersAndApps.md#kettle.request) – each of these handles one endpoint (HTTP or
        WebSockets) routed by URL and request method

This expression is much more verbose in simple cases than the traditional raw use of express apps, but in larger and
more complex applications this verbosity is amortised, with the ability to easily customise and reassort groups of
handlers and servers from application to application.

Note that the containment relationships between the top 3 levels need not be direct – servers may be nested any number
of levels below the config root, and apps may be nested any number of levels below a server. However, request handlers
must be defined as direct children of their parent apps, in the options section named `requestHandlers`.

## Further reading

Go on to [Kettle servers](Servers.md) to learn about the 2nd level of containment, and [Kettle request handlers and
apps](RequestHandlersAndApps.md) to learn about levels 3 and 4.
