# `link-server-class`

Provides a class that runs an http server with paths addressing processes that run search queries, many of which may be common database type of search queries.

Query execution and path parameters provide the basics for paging data.

The class is highly configurable. In its default form, it can handle queries made in a narrow, easily-parsed syntax. It then stores its data, query data, aggregation results, etc. in common JavaScript objects in application memory. In its configured form, it can extend or replace the query language and use any sort of backend storage that provides basic container methods.

Much of the flexibility stems from the use of `copious-little-searcher` and `copious-registry`. 

The finall class, provided in this module, provides the constructor that takes in the configuration, provides a initialization method that prepars data classes and the API paths for HTTP, and provides method for starting and stopping the application server.

## Usage

```
npm install -s link-server-class
```


### Web API paths

* `/`
* `/:uid/:query/:bcount/:offset`
* `/custom/:owner/:query/:bcount/:offset`
* `/custom/:op/:owner`
* `/cycle/:halt`
* `/persistence/add-publisher/:plink`

