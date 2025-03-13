//
const { DirWatcherHandler } = require('copious-little-searcher')  // passed through from copious-registry  
const { MultiPathRelayClient } = require('categorical-handlers')


const TRACK_KEY = "LISTFILE::"
const TRACK_KEY_LEN = TRACK_KEY.length

const PUB_TOPIC = "add_meta_searching"
const UNPUB_TOPIC = "remove_meta_searching"
const COUNTING_SERVICE_TOPIC = "add_counting_service"
const UNCOUNTING_SERVICE_TOPIC = "remove_counting_service"


/**
 * ServiceEntryWatcher
 * 
 * The service entry watcher is a class that at its bases watches a directory for new items coming in from some
 * type of publication process.
 * 
 * SUBSCRIBES TO PUBLISHERS:
 * 
 * This class also provides `add_persistence_service` which uses a multi-path client to connect to any number of friendly 
 * publishers (determined by running processes causing the data server to call this method). The method `add_persistence_service` 
 * subscribes to publishers that add and remove meta data.
 * 
 */
class ServiceEntryWatcher extends DirWatcherHandler {

    constructor(dir,conf,element_manager,app) {
        super(dir,element_manager,conf)
        //
        this._conf = conf
        this.application = app
        this.msg_relay = new MultiPathRelayClient(conf.relayer)
        //
        this._asset_type = conf.asset_type
        this._pub_topic = conf.pub_topic ? conf.pub_topic : PUB_TOPIC
        this._unpub_topic = conf.unpub_topic ? conf.unpub_topic : UNPUB_TOPIC
    }


    /**
     * add_persistence_service
     * 
     * The link server has a connection to a publisher. This method subscribes to publications and redactions
     * 
     * Must use a port and address  (??? does it -- maybe linux sockets on the same machine)
     * 
     * @param {string} persistence_link 
     * @param {string} special_path 
     * 
     */
    async add_persistence_service(persistence_link,special_path) {
        //
        let [address,port] = persistence_link.split(':')
        if ( port === undefined ) {
            return
        }
        //  either the program picks a path or the path is the host (as in location.host) of publisher
        let select_path = special_path ? special_path : persistence_link
        let conf = {
            "path" : select_path,
            "address" : address,
            "port" : port,
        }
        if ( this._conf.tls ) {
            conf.tls = this._conf.tls
        }
        //
        let path = select_path
        //
        this.msg_relay.add_relay_path(conf,conf)      // add another client 
        await this.msg_relay.await_ready(path)

        let handler = (publication) => {
            this.injest_publication(publication)
        }
        let unhandler = (publication) => {
            this.remove_publication(publication)
        }
        if ( Array.isArray(this._asset_type) ) {
            for ( let a_type of this._asset_type ) {
                let topic_add = `${this._pub_topic}_${a_type}`
                this.msg_relay.subscribe(topic_add,select_path,{},handler)
                let topic_remove = `${this._unpub_topic}_${a_type}`
                this.msg_relay.subscribe(topic_remove,select_path,{},unhandler)             
            }
        } else {
            let topic_add = `${this._pub_topic}_${this._asset_type}`
            this.msg_relay.subscribe(topic_add,select_path,{},handler)
            let topic_remove = `${this._unpub_topic}_${this._asset_type}`
            this.msg_relay.subscribe(topic_remove,select_path,{},unhandler)    
        }
        //
        // the counting service may be nice to have at some point. 
        // The current approach is to have it in the meta data.
        // But, it can be used to vet meta data or fix an err of omission.
        let cs_handler = (counter) => {
            this.injest_counting_service(counter)
        }
        let cs_unhandler = (counter) => {
            this.remove_counting_service(counter)
        }
        this.msg_relay.subscribe(COUNTING_SERVICE_TOPIC,select_path,{},cs_handler)
        this.msg_relay.subscribe(UNCOUNTING_SERVICE_TOPIC,select_path,{},cs_unhandler)
    }


    // handle input from subscriptions
    /**
     * injest_publication
     * 
     * @param {object} pub 
     */
    async injest_publication(pub) {
        try {
            if ( pub.data === undefined ) {
                if ( (typeof pub !== 'string') ) {
                    pub = JSON.stringify(pub)
                }
                await this.add_just_one_new_asset(pub)         // may actually be a file operation....
                this.application.save_publication(pub)    
            } else {
                if ( (typeof pub.data !== 'string') ) {
                    pub.data = JSON.stringify(pub.data)
                }
                await this.add_just_one_new_asset(pub.data)         // may actually be a file operation....
                this.application.save_publication(pub.data)    
            }
    
        } catch (e) {
            console.log(e)
        }
    }

    // handle input from subscriptions

    /**
     * remove_publication
     * 
     * @param {object} pub 
     */
    async remove_publication(pub) {
        let tracking = pub._tracking
        if ( tracking ) {
            await super.remove_just_one_asset(tracking)     // may actually be a file operation....
            this.application.remove_publication(tracking)
        }
    }

    /**
     * injest_counting_service
     * 
     * @param {object} counter 
     */

    async injest_counting_service(counter) {
        await this.application.injest_counting_service(counter)
    }

    /**
     * remove_counting_service
     * 
     * @param {object} counter 
     */
    async remove_counting_service(counter) {
        await this.application.remove_counting_service(counter)
    }
    

    //
    /**
     * add_just_one_new_asset
     * 
     * @param {object} fdata 
     */
    async add_just_one_new_asset(fdata) {
        let f_obj = super.add_just_one_new_asset(fdata)
        if ( f_obj !== false ) {
            let is_new = true
            if ( Array.isArray(f_obj) ) {
                for ( let fobj of f_obj ) {
                    this.addToCustomSearch(fobj,is_new)                   /// custom search for users in memory
                }
            } else {
                this.addToCustomSearch(f_obj,is_new)                      /// custom search for users in memory
            }
        }
    }

    
    // override
    /**
     * track_list_id
     * 
     * @param {*} name_id 
     * @returns boolean 
     */
    track_list_id(name_id) {
        if ( (typeof name_id === "string") && (name_id.substring(TRACK_KEY_LEN) === TRACK_KEY) ) {
            return(true)
        } else {
            return(false)
        }
    }

    //
    /**
     * remove_just_one_asset
     * 
     * @param {string} fname 
     */
    async remove_just_one_asset(fname) {
        if ( fname.indexOf('+') > 0 ) {
            let asset_name = fname.replace('.json','')
            if( asset_name != fname ) {
                let [tracking,type,ucwid] = fname.split('+')
                super.remove_just_one_asset(tracking)
            }
        }
    }

    //
    /**
     * addToCustomSearch
     * 
     * 
     * @param {object} f_obj 
     * @param {boolean} is_new 
     */
    addToCustomSearch(f_obj,is_new) {
        if ( f_obj._id === undefined ) {
            f_obj._id = f_obj._tracking
        }
        if ( f_obj._id ) {
            let owner = f_obj.ucwid
            let user_search = this.application.get_custom_search(owner)
            if ( user_search ) user_search.add_just_one(f_obj,is_new)
        }
    }

}


module.exports = ServiceEntryWatcher