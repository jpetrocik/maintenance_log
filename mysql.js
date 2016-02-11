var mysql     =    require('mysql');

var pool      =    mysql.createPool({
    connectionLimit : 100, //important
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'personal',
    debug    :  false,
    insecureAuth: true
});

module.exports = {
  loadMaintenanceLogs: function(req,callback) {
    
    pool.getConnection(function(err,connection){
      if (err) {
        connection.release();
        callback(err);
        return;
      }   

      connection.on('error', function(err) {      
        callback(err);
        return;     
      });

      connection.query("select * from maintenance_log order by mileage desc",function(err,rows){
        connection.release();
        callback(err, rows);
      });

    });
  },
  addMaintenanceLog: function(serviceDate, mileage, service, cost, note, callback) {
    
    pool.getConnection(function(err,connection){
        if (err) {
          connection.release();
          callback(err);
          return;
        }   

        connection.on('error', function(err) {      
              callback;
              return;     
        });

        var post  = {car_id: 1, performed_on: serviceDate.trim(), mileage: mileage.trim(), service: service.trim(), cost: cost.trim(), note:note.trim() };
        connection.query('INSERT INTO maintenance_log SET ?', post, function(err, result) {
          connection.release();
          callback(err, result);
          return;
        });

    });
  }  
}