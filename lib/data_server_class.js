#!/usr/bin/env node

// data server under ....<app name>
// viewing data server
//
const fs = require('fs')
const polka = require('polka');
const send = require('@polka/send-type');
const cors = require('cors')

//
const {ObjFileDirLoader, SearchesByUser} = require('copious-little-searcher')
const EntryWatcher = require('./app_dir_watcher.js')
const RecordSearchApp = require('./the_record_searcher_app.js')

// ---- ---- ---- ---- ---- ---- ---- ---- ----
//
const TIMEOUT_THRESHOLD = 8*60*60     // in seconds


class GeneralLinkServer {

    constructor(conf) {
        //
        this.conf = conf
        this.app = false

        // now to be a parameter of the class
        const AppSearching = require(this.conf.application_searcher)  // the definer of this data type
        this.search_app = new RecordSearchApp(this.conf,SearchesByUser,AppSearching,EntryWatcher,ObjFileDirLoader)
        this._port = false
        this._items_loader = false
        this._search_interface = false
        this.search_app = false
        //
        if ( conf.timeout_threshold ) {
            this.timeout_threshold = parseInt(conf.timeout_threshold)
        } else {
            this.timeout_threshold = TIMEOUT_THRESHOLD
        }
        //
    }

    /**
     * initialize
     */
    async initialize(prune_timeout) {
        //
        const app         = polka();
        app.use(cors())
        this.app = app
        
        this.html_paths()

        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        //
        this._port = this.search_app.port()
        this._items_loader = this.search_app.items_loader()
        this._search_interface = this.search_app.search_interface()
        this._dir_watcher = this.search_app.dir_watcher()
        this._link_manager = this._dir_watcher._link_manger
        this._link_manager.add_instance_target("data-server",this)  // tell the link manager to look for this LMTP server for path use

        //
        // ---- ----  ---- ---- MESSAGE RELAY....(for publishing assets)
        // had a message relay here for publishing that a new entry came in... leave it up to data supplier to publish
        // ---- ----  ---- ---- WATCH SUBDIRECTORY....   // Get new data as files. Files may contain one (dedicated file) or more entries (JSON array)
        this.search_app.start_watching_files()
        //
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        // ---- ---- ---- ---- RUN  ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        // // // 
        //
        this._items_loader.load_directory()
        this._search_interface.restore_searches()
        let self = this
        this._prune_timeout = setInterval(() => {
            self.prune_searches()
        },prune_timeout)
        //

    }


    /**
     * prune_searches
     */
    prune_searches() {
        console.log("pruning searches")
        let count = this._search_interface.prune(this.timeout_threshold)
        console.log(`searches pruned: ${count}`)
    }

    /**
     * start
     */
    async start() {
        try {
            this.app.listen(this._port, () => {
                console.log(`[contact searcher] Application Listening on Port ${this._port}`);
            })
        } catch (err) {
            this.app.log.error(err)
            process.exit(1)
        }
    }

    shutdown() {
        console.log('shutdown');
        if ( this._prune_timeout !== null ) {
            clearInterval(this._prune_timeout)
        }
        if ( this._search_interface ) {
            this._search_interface.backup_searches(true)
        } else {
            process.exit(0)
        }
    }





    // ---- ---- ---- ---- HTML APPLICATION PATHWAYS  ---- ---- ---- ---- ---- ---- ----
    /**
     * html_paths
     */
    html_paths() {

        if( this.app === false ) {
            throw new Error("could not initialize basic html paths")
        }

        this.app.get('/',(req, res) => {
            try {
                if ( this.conf && this.conf.index_file ) {
                    const data = fs.readFileSync(this.conf.index_file)
                    send(res,200,data)
                } else {
                    const data = fs.readFileSync("./index.html")
                    send(res,200,data)
                }
            } catch (e) {
                send(res,404,"what")    
            }
        })

        /**
         * /:uid/:query/:bcount/:offset
         * 
         * GET
         * /:uid - USER ID -- a ccwid of the caller --- check on rate limit if implemented
         * /:query - SYNTACTICALLY APPROPRIATE QUERY
         * /:bcount - THE NUMBER OF QUERY RESULTS TO RETURN
         * /:offset - THE OFFSET (starting point) in the query data
         * 
         */
        this.app.get('/:uid/:query/:bcount/:offset', async (req, res) => {
            let data = await this.search_app.rated_search_processing(req,res)
            send(res,200,data)
        })


        /**
         * /custom/:owner/:query/:bcount/:offset
         * GET
         * 
         * /:uid - USER ID -- a ccwid
         * /:owner -- 
         * /:query - SYNTACTICALLY APPROPRIATE QUERY
         * /:bcount - THE NUMBER OF QUERY RESULTS TO RETURN
         * /:offset - THE OFFSET (starting point) in the query data
         * 
         */
        this.app.get('/custom/:owner/:query/:bcount/:offset', async (req, res) => {
            let data = await this.search_app.rated_custom_search_processing(req,res)
            send(res,200,data)
        })

        this.app.post('/custom/:op/:owner', async (req, res) => {
            let data = await this.search_app.rated_custom_search_ops(req,res)
            send(res,200,data)
        })


        // // put these into an endpoint that can be managed by the tool.
        // this.app.get('/cycle/:halt', (req, res) => {
        //     // requires admin permission
        //     let do_halt = req.params.halt
        //     this._search_interface.backup_searches(do_halt)
        //     send(res,200,"OK")
        // })

        // this.app.get('/reload',(req, res) => {
        //     // requires admin permission
        //     this._items_loader.load_directory()
        //     send(res,200,"OK")
        // })

        // this.app.get('/persistence/add-publisher/:plink', (req, res) => {
        //     // requires admin permission
        //     let persistence_link = req.params.plink
        //     persistence_link = decodeURIComponent(persistence_link)
        //     // check that this publisher is OK.  This will give us a link making
        //     // this service be a client for subcription to publication...
        //     this.search_app.add_persistence_service(persistence_link,'admin-contacts')
        //     send(res,200,{ "status" : "OK" })
        // })

    }

    // now admin comes from a tool that connects to this application's link_manager endpoint
    //
    async external_op_request(conf) {
        switch ( conf.command ) {
            case "cycle": {
                let do_halt = ((conf.halt !== undefined) ? conf.halt : false)
                this._search_interface.backup_searches(do_halt)
                break
            }
            case "reload" : {
                this._items_loader.load_directory()
                break;
            }
            default : {
                break;
            }
        }
    }



}

module.exports = GeneralLinkServer
