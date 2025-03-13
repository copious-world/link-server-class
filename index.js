const GeneralLinkServer = require('./lib/data_server_class')

const RecordSearchApp = require('./lib/the_record_searcher_app')
const ServiceEntryWatcher = require('./lib/app_dir_watcher')


module.exports = GeneralLinkServer
module.exports.RecordSearchApp = RecordSearchApp
module.exports.ServiceEntryWatcher = ServiceEntryWatcher
