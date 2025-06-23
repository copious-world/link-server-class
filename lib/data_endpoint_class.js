#!/usr/bin/env node

// data server under ....<app name>
// viewing data server
//


//
const {ObjFileDirLoader, SearchesByUser} = require('copious-little-searcher')
const EntryWatcher = require('./app_dir_watcher.js')
const RecordSearchApp = require('./the_record_searcher_app.js')
const {OperationsCategory} = require('categorical-handlers')

// ---- ---- ---- ---- ---- ---- ---- ---- ----
//
const TIMEOUT_THRESHOLD = 8*60*60     // in seconds


class MetaDataEndpointServer extends OperationsCategory {

    constructor(conf) {
        //
        super(conf)
        //
        this.conf = conf

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
     * 
     * fetch_single
     * 
     * wrap some methods tied to instances to simplify client code.
     * 
     * @param {string} tracking 
     * @returns 
     */
    async fetch_single(tracking) {
        if ( this._search_interface ) {
            return await this._search_interface.fetch_single(tracking)
        }
        return false
    }



    async application_operation_cmd_handling(cmd_op,parameters) {

        let op_action = "done"
        switch ( cmd_op ) {
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
                op_action = "noop"
                break;
            }
        }

        return { "action" : op_action, "paraeters" : parameters }
    }

    async application_operation_info_handling(cmd_op,parameters) {
        if ( cmd_op === "search" ) {
            let data = await this.search_app.app_process_search(parameters)
            return { "action" : "search", "data" : data }    
        }
        return { "action" : "noop" }
    }

    async application_operation_cmd_reversal(was_cmd_op) {
        console.log("The application should implement the application_operation_cmd_handling method ")
        return { "action" : "noop" }
    }



    /**
     * prune_searches
     */
    prune_searches() {
        console.log("pruning searches")
        let count = this._search_interface.prune(this.timeout_threshold)
        console.log(`searches pruned: ${count}`)
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



}

module.exports = MetaDataEndpointServer
