/**
 * RecordSearchApp
 * 
 */

class RecordSearchApp {
    //
    constructor(conf,UserOnlySearches,AppSearching,EntryWatcher,ObjFileDirLoader) {
        //
        this._USearch = UserOnlySearches
        this._AppSearching = AppSearching       // a class that does searching
        this._EntryWatcher = EntryWatcher       // a class that watches for new entries
        this._ObjFileDirLoader = ObjFileDirLoader
        //
        this._subdir = conf.records_dir
        this._update_dir = conf.updating_records_directory
        this._user_assets_dir = conf.assets_directory
        this._port = conf.port
        this._address = conf.address
        this._global_file_list = []
        this._global_file_list_by = {}
        //
        this._counting_services = {}
        this._active_counting_service = false
        this._retired_counting_service = []
        //
        this._search_interface = false
        this._search_watcher = false
        this._items_loader = false
        this._conf = conf
        //
        this._big_file_list = []
        this._big_file_list_by = {}
        //
        this._particular_user_searches = false
        this.initialize()
    }

    // ---- ---- ---- ---- ---- ---- ---- ----
    //
    set_big_file_list(list_type_obj) {
        this._big_file_list = list_type_obj
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    /**
     * initialize
     * 
     */
    initialize() {              // INSTANCES 
        this._search_interface = new this._AppSearching(this._conf)        // see initialization below
        this._search_interface.set_global_file_list_refs(this._big_file_list,this._big_file_list_by)
        //
        this._search_watcher = new this._EntryWatcher(this._update_dir,this._conf,this._search_interface,this)
        let search_list_holder = this._search_interface.get_global_file_list()
        //
        if ( this._USearch ) {
            this._particular_user_searches = {
                'admin' : new this._USearch(this._search_interface,'admin',this._conf)
            }
        }
        //
        this._items_loader = new this._ObjFileDirLoader(this._subdir,search_list_holder,this._search_watcher,() => { this.after_loading() })
    }


    /**
     * after_loading
     */
    after_loading() {
        if (  this._search_interface ) {
            this._search_interface.update_global_file_list_quotes_by()
        }
    }

    /**
     * start_watching_files
     */
    start_watching_files() {
        if ( this._search_watcher ) {
            this._search_watcher.start()
        }
    }

    port() {
        return this._port
    }
    
    items_loader() {
        return this._items_loader
    }
    
    search_interface() {
        return this._search_interface
    }

    /**
     * save_publication
     * 
     * @param {object} pub_data 
     */
    save_publication(pub_data) {
        if ( typeof pub_data === "string" ) {
            try {
                pub_data = JSON.parse(pub_data)
            } catch (e) {
            }
        }
        this._items_loader.save(pub_data)
    }

    /**
     * remove_publication
     * 
     * @param {string} tracking 
     */
    remove_publication(tracking) {
        this._items_loader.remove(tracking)
    }



    //-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
    /**
     * get_custom_search
     * 
     * @param {string} owner  -- ccwid
     * @returns object
     */
    get_custom_search(owner) {
        if ( this._particular_user_searches !== false ) {
            let user_search =  this._particular_user_searches[owner]
            if ( user_search === undefined ) {
                this._particular_user_searches[owner] = new this._USearch(this._search_interface,owner,this._conf)
            }
            user_search = this._particular_user_searches[owner]
            if ( user_search ) {
                return user_search
            }
        }
        return false
    }


    //-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
    /**
     * process_search
     * 
     * @param {object} req 
     * @returns Array - a list of search results...
     */
    async process_search(req) {
        let query = req.params.query;
        let box_count = parseInt(req.params.bcount);
        let offset = parseInt(req.params.offset);
        //
        if ( this._search_interface ) {
            let search_results = await this._search_interface.get_search(query,offset,box_count);
            return(search_results)
        }
        return []
    }
    
    //-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 

    /**
     * process_custom_search
     * 
     * @param {string} owner 
     * @param {object} req 
     * @returns Array -- data objects
     */
    async process_custom_search(owner,req) {
        let data = []
        if ( this._particular_user_searches !== false ) {
            try {
                let custom = this._particular_user_searches[owner]
                if ( custom ) {
                    data = await custom.process_search(req)
                }
            } catch (e) {
            }
        }
        return(data)
    }

    //-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 

    /**
     * run_custom_operation
     * @param {string} owner -- ccwid
     * @param {string} op -- one of a few operations 
     * @returns 
     */
    async run_custom_operation(owner,op) {
        let result = { "status" : "emtpy" } 
        if ( this._particular_user_searches !== false ) {
            try {
                // custom is the query set owned by the owner
                let custom = this._particular_user_searches[owner]
                if ( custom ) {
                    let custom = this._particular_user_searches[owner]
                    result = await custom.run_op(op)
                }
            } catch(e) {}
            }
        return result
    }

    
    //-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
    /**
     * particular_interface_info
     * 
     * Runs an info operation for a particular user --- useful of admin
     * 
     * @param {string} item_key 
     * @returns object
     */
    async particular_interface_info(item_key) {
        let result = { "status" : "emtpy" } 
        if ( this._particular_user_searches !== false ) {
            let custom = this._particular_user_searches[item_key]
            let op = { "cmd" : "info" } 
            result = await custom.run_op(op)
        }
        return(result)
    }


    // RATING INTERFACE

    rate_limited(uid) {
        return false
    }
    
    rate_limit_redirect(req,res) {
        return res.redirect('/')
    }



    //  RATED METHODS
    //-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
    /**
     * 
     * @param {object} req 
     * @param {object} res 
     * @returns 
     */
    async rated_search_processing(req,res) {
        //
        let uid = req.params.uid;
        if ( this.rate_limited(uid) ) {
            return this.rate_limit_redirect(req,res)
        }
        //
        let data = await this.process_search(req)
        return data
    }

    //-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
    /**
     * rated_custom_search_processing
     * 
     * @param {object} req 
     * @param {object} res 
     * @returns Array
     */
    async rated_custom_search_processing(req,res) {
        let owner = req.params.owner;
        if ( this.rate_limited(owner) ) {
            return this.rate_limit_redirect(req,res)
        }
        if ( this._search_watcher ) {
            let data = this.process_custom_search(owner,req)
            //
            return data
        }
        return []
    }

    //-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
    /**
     * rated_custom_search_ops
     * 
     * @param {object} req 
     * @param {object} res 
     * 
     * @returns Array
     */
    async rated_custom_search_ops(req,res) {
        let owner = req.params.owner;
        if ( this.rate_limited(owner) ) {
            return this.rate_limit_redirect(req,res)
        }
        let cmd = req.params.op
        if ( cmd === 'user-info' ) {
            let uid = req.body.uid
            let response = await this.particular_interface_info(owner,uid)  // particular_interface_info shall check for role access
            return response
        }
        //
        let op = {
            "cmd" : req.params.op,
            "req" : req
        }
        //
        if ( this._search_watcher ) {
            let data = await this.run_custom_operation(owner,op)
            return data
        }
    }

    /**
     * add_persistence_service
     * 
     * @param {string} persistence_link 
     * @param {string} special_path 
     */
    add_persistence_service(persistence_link,special_path) {
        this._search_watcher.add_persistence_service(persistence_link,special_path)
    }


    // will keep this for uses, such as validation of counting services on newly pubished meta data.
    // injest_counting_service
    /**
     * injest_counting_service
     * 
     * @param {object} counter 
     */
    async injest_counting_service(counter) {
        let cs_tracking = counter._tracking
        this._counting_services[cs_tracking] = counter
        this._active_counting_service = counter  // pick the closest or something
    }


    // remove_counting_service
    /**
     * remove_counting_service
     * 
     * @param {object} counter 
     */
    async remove_counting_service(counter) {
        let cs_tracking = counter._tracking
        if ( this._counting_services[cs_tracking] ) {
            this._retired_counting_service.push(this._counting_services[cs_tracking]._tracking)
            while ( this._retired_counting_service.length > 5 ) {
                this._retired_counting_service.shift()
            }
            delete this._counting_services[cs_tracking]
            let services = Object.keys(this._counting_services)
            if ( services.length ) {
                this._active_counting_service = this._counting_services[services[0]]   // or some algoritm
            } else {
                this._active_counting_service = false
            }
        }
    }

}


module.exports = RecordSearchApp