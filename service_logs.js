const pool = require('./mysql.js');
const sql = require('./sql');
const tokenGenerator = require('./tokens.js');
const { call } = require('body-parser');


let executeQuery = function(sqlStatement, sqlParams, callback) {
	// console.log(sqlStatement);
	// console.log(sqlParams);
	pool.query(sqlStatement, sqlParams, (error, results, fields) => {
		if (error)
			console.log(error);
		if (callback)
			callback(error, results);
	});
};

let serviceLog = {
	myGarage: function(utoken, callback) {
		executeQuery("select iToken as token, name, mileage from my_garage c left join invitations i ON c.id=i.carId \
			where c.status='ACTIVE' and i.uToken=? \
		 	order by c.year desc, c.make asc, c.model asc, c.id desc", [utoken], callback);
	},

	addCar: function(params, callback) {
		let token = tokenGenerator(25);
		let inserviceDate = (params.inserviceDate)?params.inserviceDate:new Date();
		let name = "'" + params.year.substring(2) + " " + params.make + " " + params.model;
		let car  = {token: token, name: name, make: params.make, model: params.model, 
			trim: params.trim, year: params.year, inserviceDate: inserviceDate, status: "ACTIVE"};

		executeQuery("insert into my_garage set ?" , car, (err, results) => { 
			car.id = results.insertId;

			let mileage = params.mileage;
			if (!mileage) {
				mileage=0;
			}
				serviceLog.addMileage(car.id, mileage, (err, results) => {
		    	callback(err, car);
		    });
		});
	},

	carDetails: function(carId, callback) {
		executeQuery("select c.*, max(m.mileage) as mileage, DATEDIFF(now(), max(m.created_date)) as mileageReportedDays \
			from my_garage c LEFT JOIN mileage_log m ON c.id=m.carId \
			where c.id=?",
			[carId], (err, results) => {callback(err, results[0])});
	},

	completeServiceLog:  function(carId, callback) {
		executeQuery("select s.* from my_garage c join service_history s on c.id=s.carId where c.id=? \
			order by mileage asc, serviceDate asc", [carId], callback);
	},

	serviceLog:  function(carId, serviceId, callback) {
		executeQuery("select * from service_history where id=? and carId=?", [serviceId, carId], callback);
	},

	serviceDue: function(carId, callback) {
		executeQuery(sql.serviceDue, [carId], callback);
	},

	addServiceLog: function(carId, serviceDate, mileage, service, cost, note, callback) {
		this.carDetails(carId, (error, car) => {

			if (!mileage) {
				mileage = car.mileage;
			}

			if (!serviceDate) {
				serviceDate = new Date();
			}
	
			var serviceRecord = {carId: carId, mileage: mileage, serviceDate: serviceDate, service: service.trim() }

			if (cost) {
				serviceRecord.cost = cost;
			}
	
			if (note) {
				serviceRecord.note = note.trim()
			}
	
			var sqlParams  = serviceRecord;
	
			executeQuery("INSERT INTO service_history SET ?", sqlParams, callback);
	
		});
	},

	updateServiceLog: function(carId, serviceId, serviceDate, mileage, service, cost, note, regularService, monthsInterval, mileageInterval, callback) {
		var serviceRecord = {mileage: mileage, serviceDate: serviceDate, service: service.trim(), note:note }
		if (cost == undefined || cost != '') {
			serviceRecord.cost = cost;
		}

		var sqlParams  = [serviceRecord, serviceId, carId];
		executeQuery("UPDATE service_history SET ? WHERE id=? AND carId=?", sqlParams, (err, result) => {
		        
		    //add a scheduled service
		   	if (regularService) {
		   		serviceLog.addScheduledService(carId, mileageInterval, monthsInterval, service, callback);
		   	} else {
		   		callback(err, result);
		   	}

		});
	} ,

	deleteServiceLog: function(carId, serviceId, callback) {
		var sqlParams = [serviceId, carId];
		executeQuery("DELETE FROM service_history WHERE id = ? AND carId=?", sqlParams, callback);
	},

	addScheduledService: function(carId, mileageInterval, monthsInterval, service, callback) {
		var scheduleLog  = {carId: carId, mileage: mileageInterval, months: monthsInterval, service: service};
		executeQuery("INSERT INTO " + SCHEDULE_LOG_TABLE + " SET ?", scheduleLog, callback);
	},

	addMileage: function(carId, mileage, callback) {
		this.carDetails(carId, (err, carDetails) => {
			if (err) {
				callback(err);
				return;
			}

			if (!carDetails) {
				callback("Car not found");
				return;
			}

			if (carDetails.mileage > mileage) {
				callback("Mileage too low!");
				return
			}

			if (carDetails.mileage) {
				let maxApproximateMileage = carDetails.mileage+(50 * carDetails.mileageReportedDays);
				if (maxApproximateMileage < mileage) {
					callback("Mileage too high!");
					return;
				}
			}

			var sqlParams = {carId: carId, mileage: mileage};

			var sql = "INSERT INTO mileage_log SET ?";
			executeQuery(sql, sqlParams, (error, results) => {
				if (!error)
					executeQuery("UPDATE my_garage SET mileage=? WHERE id=?", [mileage, carId], callback);
			});
		});
	}

}

module.exports = serviceLog;
