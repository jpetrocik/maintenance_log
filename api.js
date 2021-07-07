var express = require('express'),
    router = express.Router();
const config = require("./config.json");
const exceptions = require('./exceptions.js');
const plivo = require('./plivo.js');

router.head('/', function (req, res) {
	invitations.validateUser(req, res, (err, uToken) => {
		if (!uToken) {
			res.sendStatus(401);
			return;
		}

		res.sendStatus(200);
	});
});

/**
 * Registers user with a new car
 */
router.post('/register', function (req, res) {
	invitations.register(req.body.email, req.body.phone, function(err, user){
		if (err) {
			if (err.code === exceptions.USER_EXISTS.code) {
				res.sendStatus(400);
				return;
			}
			res.sendStatus(500);
			return;
		}

		res.cookie('_aToken', user.aToken, { maxAge: (90 * 24 * 60 * 60)});
		res.sendStatus('200');
	});
});

router.post('/sendAuth', function (req, res) {
	invitations.sendAuth(req.body.email, function(err){
		res.sendStatus('200');
	});
});

router.get('/validate', function (req, res) {
	invitations.validateUser(req, res, (err, uToken) => {
		if (!uToken) {
			res.sendStatus(401);
			return;
		}

		invitations.createValidationCode(uToken, (err, validationCode) => {
			res.json({validationCode: validationCode });
		});
	});
});

router.post('/validate', function (req, res) {
	invitations.validateCode(req.body.validationCode, (err, uToken) => {
		invitations.loginUser(uToken, res, (err, result) => {
			if (!result) {
				res.sendStatus(401);
				return;
			}

			res.sendStatus(200);
		});
	});
});

router.get('/mfa', function(req, res) {
	invitations.generateMfa(req.query.phone, (err, token) => {
		if (err) {
            console.log(err);
			res.sendStatus(401);
			return;
		}

        res.json(token);
	});

});

router.post('/mfa', function(req, res) {
	invitations.validateMfa(req.body, (err, uToken) => {
		if (err) {
            console.log(err);
			res.sendStatus(401);
			return;
		}

        invitations.loginUser(uToken, res, (err, status) => {
            if (err) {
                console.log("Error: " + err);
                res.sendStatus(401);
                return;
            }

            res.sendStatus(200);
        });
	});

});

router.post('/share/:token', function (req, res) {
    invitations.resolveInvitation(req.params.token, (err, carId, carToken) => {
        if (!carToken) {
            console.log('Connection unauthorized' );
            res.sendStatus(401);
            return;
        }

        //method to create an invitation
        let createInvitationCallBack = function(user, carId, carToken) {
            invitations.createInvitation(user.uToken, carId, carToken, (err, iToken) => {
                if (err) {
                	res.sendStatus(409);
                    return;
                }

                let inviteLink = config.host + '/setup/' + iToken;

                if (config.plivo.enabled) {
                    plivo.messages.create(
                        config.plivo.phone,
                        user.phone,
                        inviteLink        
                    ).then(function(message_created) {
                        res.sendStatus(200);
                    });
                } else {
                    console.log(inviteLink);
                    res.sendStatus(200);
                }
            });
        };

        invitations.register(req.body.email, req.body.phone, (err, user) => {
            if (err) {
                if (err.code === exceptions.USER_EXISTS.code) {
                	console.log("User exists, looking up by phone...");
                    invitations.lookupUserByPhone(req.body.phone, (err, user) => {
                        if (err) {
                            console.log(err);
                            res.sendStatus(500);
                            return;
                        }
                    	console.log("Found user!");

                        createInvitationCallBack(user, carId, carToken);
                    });
                    return;
                } else {
                    res.sendStatus(500);
                    return;
                }
            }
            createInvitationCallBack(user, carId, carToken);
        });

    });
});

router.post('/car', function(req, res) {
	invitations.validateUser(req, res, (err, uToken) => {
		if (!uToken) {
			res.sendStatus(401);
			return;
		}

		serviceLogs.addCar(req.body, (err, car) => {
			invitations.createInvitation( uToken, car.id, car.token, (err, iToken) => {
				res.json({token: iToken, name: car.name});			
			});
		});
	});

});

/**
 * Returns list of all car
 */
router.get('/car', function (req, res) {
	invitations.validateUser(req, res, (err, uToken) => {
		if (!uToken) {
			res.sendStatus(401);
			return;
		}

		serviceLogs.myGarage(uToken, function(err, rows){
			res.json(rows);
		});
	});
});

/**
 * Returns the car details
 */
router.get('/car/:iToken', function (req, res) {
	invitations.resolveInvitation(req.params.iToken, (err, carId) => {
		if (!carId) {
			res.sendStatus(401);
			return;
		}
		serviceLogs.carDetails(carId, function(err, rows){
			rows.token = req.params.iToken;
			res.json(rows);
		});
	});
});

/**
 * Returns the service history for a car
 */
router.get('/car/:iToken/service', function (req, res) {
	invitations.resolveInvitation(req.params.iToken, (err, carId) => {
		if (!carId) {
			res.sendStatus(401);
			return;
		}

		serviceLogs.completeServiceLog(carId, function(err, rows){
			res.json(rows);
		});
	});
});

/**
 * Returns a particular service log
 */
router.get('/car/:iToken/service/:serviceId', function (req, res) {
	invitations.resolveInvitation(req.params.iToken, (err, carId) => {
		if (!carId) {
			res.sendStatus(401);
			return;
		}
		serviceLogs.serviceLog(carId, req.params.serviceId, function(err, rows){
			res.json(rows);
		});
	});
});

/**
 * Add service log entry
 */
router.post('/car/:iToken/service', function (req, res) {
	invitations.resolveInvitation(req.params.iToken, (err, carId) => {
		if (!carId) {
			res.sendStatus(401);
			return;
		}

		serviceLogs.addServiceLog(carId, req.body.serviceDate, req.body.mileage, req.body.service, req.body.cost, req.body.note,
			function(err, result){
				if (err) {
					res.status(500).json(err).end()
				} else {
					res.status(200).json({ "id": result.insertId }).end()
				}
		});
	});
});

/**
 * Updates service log entry
 */
router.put('/car/:iToken/service/:serviceId', function (req, res) {
	invitations.resolveInvitation(req.params.iToken, (err, carId) => {
		if (!carId) {
			res.sendStatus(401);
			return;
		}

		serviceLogs.updateServiceLog(carId, req.params.serviceId, req.body.serviceDate, req.body.mileage, req.body.service, req.body.cost, req.body.note, req.body.regularService, req.body.monthsInterval, req.body.mileageInterval,
			function(err, result){
				if (err) {
					res.status(500).json(err).end()
				} else {
					res.status(200).json({ "id": req.params.serviceId }).end()
				}
		});
	});
});

/**
 * Deletes service log entry
 */
router.delete('/car/:iToken/service/:serviceId', function (req, res) {
	invitations.resolveInvitation(req.params.iToken, (err, carId) => {
		if (!carId) {
			res.sendStatus(401);
			return;
		}

		serviceLogs.deleteServiceLog(carId, req.params.serviceId,
			function(err, result){
				if (err) {
					res.status(500).json(err).end()
				} else {
					res.status(200).json({ "id": req.params.serviceId }).end()
				}
		});
	});
});


/**
 * Adds a mileage log
 */
router.put('/car/:iToken/mileage/:mileage', function (req, res) {
	invitations.resolveInvitation(req.params.iToken, (err, carId) => {
		if (!carId) {
			res.sendStatus(401);
			return;
		}

		serviceLogs.addMileage(carId, req.params.mileage, (err, result) => {
			if (err) {
				res.status(500).json(err).end()
			} else {
				res.sendStatus(200);
			}
		});
	});
});

/**
 * Get upcoming/needed service
 */
router.get('/car/:iToken/schedule', function (req, res) {
	invitations.resolveInvitation(req.params.iToken, (err, carId) => {
		if (!carId) {
			res.sendStatus(401);
			return;
		}

		serviceLogs.serviceDue(carId, (err, result) => {
			res.json(result);
		});
	});
});

module.exports = router;
