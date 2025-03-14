# `link-server-class`

Provides a class that runs an http server with paths addressing processes that run search queries, many of which may be common database type of search queries.

Query execution and path parameters provide the basics for paging data.

The class is highly configurable. In its default form, it can handle queries made in a narrow, easily-parsed syntax. It then stores its data, query data, aggregation results, etc. in common JavaScript objects in application memory. In its configured form, it can extend or replace the query language and use any sort of backend storage that provides basic container methods.

Much of the flexibility stems from the use of [`copious-little-searcher`](https://www.npmjs.com/package/copious-little-searcher) and [`copious-registry`](https://www.npmjs.com/package/copious-registry).

The finall class, provided in this module, provides the constructor that takes in the configuration, provides a initialization method that prepars data classes and the API paths for HTTP, and provides method for starting and stopping the application server.

## Usage

```
npm install -s link-server-class
```


### Typical Application Pattern

```
//
const GeneralDataServer = require('link-server-class')
//


// ---- ---- ---- ---- CONSTRUCT  ---- ---- ---- ---- ---- ---- ---- ----

if ( g_conf.application_searcher === undefined || g_conf.application_searcher === false ) {
    g_conf.application_searcher = './application_searching.js'
}

let g_data_server = new GeneralDataServer(g_conf)

// ---- ---- ---- ---- START  ---- ---- ---- ---- ---- ---- ---- ----
//
g_data_server.initialize(TIMEOUT_THRESHHOLD_INTERVAL)
//
g_data_server.start()
//

// ---- ---- ---- ---- SHUTDOWN  ---- ---- ---- ---- ---- ---- ---- ----

// Handle ^C
process.on('SIGINT', () => {
    console.log("shutting down")
    try {
        g_data_server.shutdown()
    } catch(e) {
        process.exit(0)
    }
});

```

### Web API paths

* `/`
* `/:uid/:query/:bcount/:offset`
* `/custom/:owner/:query/:bcount/:offset`
* `/custom/:op/:owner`
* `/cycle/:halt`			-- (requires admin permission)
* `/reload`  -- (requires admin permission)
* `/persistence/add-publisher/:plink`			-- (requires admin permission)


## Principle Classes

The module export three princpile classes:

* **GeneralLinkServer**
* **RecordSearchApp**
* **ServiceEntryWatcher**

The **GeneralLinkServer** uses **RecordSearchApp** or its descendants to respond to web requests that it initializes. In turn, **RecordSearchApp** acts as a go-between data arrival handlers and searching processes.

Data arrival handlers are network and directory interfaces that take in new items to store for future searching. The **ServiceEntryWatcher** looks for new objects in a directory by deriving these process from *DirWatcherHandler* found in [`copious-little-searcher`](https://www.npmjs.com/package/copious-little-searcher). The **ServiceEntryWatcher** also subscribes to publication process when it is commanded to do so. The links to the publishers are added in response to `/persistence/add-publisher/:plink` an API endpoint of **GeneralLinkServer**. The **ServiceEntryWatcher** passes new publications onto the **RecordSearchApp** which then installs them into `searching`.

The conigured `conf.application_searcher` should be a module accessible in the file system and it should provide a class that is a descendant of `searching` in [`copious-little-searcher`](https://www.npmjs.com/package/copious-little-searcher).

This module does not provide a default for `conf.application_searcher`. Notice that in the above example code *(Typical Application Pattern)*  the application provides it. 

The provided application code should descend from ***Searching*** provided by 
[`copious-little-searcher`](https://www.npmjs.com/package/copious-little-searcher).

