const fsExists = require('fs.promises.exists')
const fsPromises = require('fs').promises

module.exports = function (utils, db_path) {
  var module = {};
  const debounce = require('debounce')
  const fs = require('fs')

  module.queue = []
  module.active_wrksp = []
  module.users  = []
  // module.payments = []

  dbWrite = function() {
    utils.time('dbWrite')
    // utils.log("queue ", queue, "active worksp ", active_wrksp, "users ", users, "payments ", payments)
    const files = [{name:db_path+'./dbQueue.json',data:{queue:module.queue}},
                   {name:db_path+'./dbActiveWrksp.json',data:{active_wrksp:module.active_wrksp}},
                   {name:db_path+'./dbUsers.json',data:{users:module.users}},
                  //  {name:db_path+'./dbPayments.json',data:{payments:module.payments}}
                  ] 
    files.forEach(async (file) => {
      const dataExists = await fsExists(file.name)
      var dataOnDisk = await fsPromises.readFile(file.name,'utf8')
      const dataIsDifferent = dataExists && JSON.stringify(file.data) !== dataOnDisk
      if(dataIsDifferent){
        try{
          await fsPromises.writeFile(`${file.name}.tmp.json`, JSON.stringify(file.data))
          await fsPromises.rename(`${file.name}.tmp.json`, file.name)
        }catch(err){utils.log('Failed to write db file'.bgRed);utils.log(err)}
      }
    })
    utils.timeEnd('dbWrite')
  }
  debounce(dbWrite,10000,true) // at least 10 seconds between writes
  module.dbWrite=dbWrite
  module.dbRead = function() {
    utils.time('dbRead')
    try{
      module.queue=JSON.parse(fs.readFileSync(db_path+'./dbQueue.json')).queue
      module.users=JSON.parse(fs.readFileSync(db_path+'./dbUsers.json')).users
      // module.payments=JSON.parse(fs.readFileSync(db_path+'./dbPayments.json')).payments
      module.payments=JSON.parse(fs.readFileSync(db_path+'./dbActiveWrksp.json')).active_wrksp
    } catch (err){
      utils.log('Failed to read db files'.bgRed);
      utils.log(err)
    }
    utils.timeEnd('dbRead')
  }

  return module;
};