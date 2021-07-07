var express = require('express'),
    router = express.Router();
const config = require("./config.json");
// const exceptions = require('./exceptions.js');
const plivo = require('./plivo.js');
const pool = require('./mysql');


var executeQuery = function(sqlStatement, sqlParams, callback) {
	// console.log(sqlStatement);
	// console.log(sqlParams);
    pool.query(sqlStatement, sqlParams, (error, results, fields) => {
    	if (error)
    		console.log(error);
		callback(error, results);
    });
};


/**
 * Registers user with a new car
 */
 
router.get('/unreported', function (req, res) {
	let sql = 'select my_garage.id, my_garage.name as car, user_accounts.phone as phone, user_accounts.aToken as aToken, \
	invitations.iToken as cToken, datediff(now(),max(mileage_log.created_date)) as last_reported \
	from  mileage_log join my_garage on mileage_log.carId = my_garage.id \
	join invitations on invitations.oToken = my_garage.token \
	join user_accounts on invitations.uToken =  user_accounts.uToken \
	where my_garage.status=\'ACTIVE\' and invitations.role=10 \
	group by my_garage.id, user_accounts.phone, user_accounts.aToken, invitations.iToken, my_garage.name having last_reported > ?'

	executeQuery(sql, [30], (err, results) => {

		if (err)
			console.log(err);

		Object.keys(results).forEach(function(row) {
	      	var fields = results[row];
			//send sms message
			if (config.plivo.enabled) {
				if (fields['phone']) {
					plivo.messages.create(
						config.plivo.phone,
						fields['phone'],
						'You have not report mileage for your ' + fields['car'] + ' in over ' + fields['last_reported'] + ' days. Follow link to report mileage\n\n' + config.host + '/mileage?aToken=' + fields['aToken'] + '&cToken=' + fields['cToken']
					).then(function(message_created) {

					});
				}
			} else {
				console.log('You have not report mileage for your ' + fields['car'] + ' in over ' + fields['last_reported'] + ' days. Follow link to report mileage\n\n' + config.host + '/mileage?aToken=' + fields['aToken'] + '&cToken=' + fields['cToken']);
			}
		});

		res.sendStatus(200);


	});
});

router.get('/service', function (req, res) {
	let sql = "select distinct id, name as car, phone, aToken, iToken as cToken from ( \
		select c.id, c.name, a.phone, a.aToken, i.iToken, ms.service, \
		DATEDIFF(DATE_ADD(COALESCE(max(s.serviceDate),c.inserviceDate), INTERVAL months MONTH), now()) as  due_in_days, \
		COALESCE(max(s.mileage),0)+ms.mileage-c.mileage as due_in_miles \
		from my_garage c left join scheduled_maintenance ms on c.id=ms.carId \
		left outer join service_history s on s.service=ms.service and s.carId=ms.carId \
		left join invitations i on i.oToken=c.token \
		left join user_accounts a on a.uToken=i.uToken \
		where c.status='ACTIVE' and i.role=10 \
		group by c.id, c.name, a.phone, a.aToken, i.iToken, ms.service, ms.months, ms.mileage \
		) as s where due_in_days<30 or due_in_miles<500";

	executeQuery(sql, [], (err, results) => {

		if (err)
			console.log(err);

		Object.keys(results).forEach(function(row) {
	      	var fields = results[row];
			//send sms message
			if (config.plivo.enabled) {
				if (fields['phone']) {
					plivo.messages.create(
						config.plivo.phone,
						fields['phone'],
						'Service due for your ' + fields['car'] + '. Follow link to view services\n\n' + config.host + '/service?aToken=' + fields['aToken'] + '&cToken=' + fields['cToken']
					).then(function(message_created) {

					});
				}
			} else {
				console.log('Service due for your ' + fields['car'] + '. Follow link to view services\n\n' + config.host + '/service?aToken=' + fields['aToken'] + '&cToken=' + fields['cToken']);
			}
		});

		res.sendStatus(200);


	});
});

module.exports = router;
