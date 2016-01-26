var aws = require('aws-sdk');
var doc = require('dynamodb-doc');
var fs = require('fs');

aws.config.update({
	accessKeyId: process.env.ACCESS_KEY || 'Temp',
	secretAccessKey: process.env.SECRET_KEY || 'Temp',
	endpoint: process.env.DYNAMODB_ENDPOINT || 'http://192.168.99.100:8000',
	region: process.env.AWS_REGION || 'us-east-1'
});

var schema = process.env.SCHEMA_LOCATION || './tables/';
var sampleData = process.env.DATA_LOCATION || './table_data/';
var dynamodb = new doc.DynamoDB(new aws.DynamoDB());

fs.readdir(schema, function(err, items) {
	if (err) {
	    console.log(err);
	}
	else {
		makeTables(items);
	}
});

function makeTables(items){
	for (var i = 0; i < items.length; i++) {
		var table = items[i].split(".")[0];
		console.log('making table ' + table);
		createTable(table, loadData(table))();
	}
}

function createTable(tableName, cb) {
	return function() {
		dynamodb.deleteTable({ TableName: tableName }, function(err, data) {
		    if (err) {
		        console.log('error in delete for ' + tableName + ': ' + err);
		    }

	    	dynamodb.waitFor('tableNotExists', { TableName: tableName }, function(err, data) {
	    		var params = require(schema + tableName + '.json');
				dynamodb.createTable(params, function(err, data) {
					if (err) {
					    console.log('error in create for ' + tableName + ': ' + err);
					}

					dynamodb.waitFor('tableExists', { TableName: tableName }, function(err, data) {
					  	if (err) {
					  	    console.log(err, err.stack);
					  	}
					  	else {
							console.log('table created: ' + tableName);
				    		cb();
						}
					});
				});
	    	});
		});
	}
};

function loadData(tableName) {
	return function() {
		try {
			var items = require(sampleData + tableName + '.json');
		} catch (error) {
			console.log(error);
			return;
		}

		var requestItem = {};
		requestItem[tableName] = [];

		var batchWrite = function() {
		    dynamodb.batchWriteItem({ RequestItems: requestItem }, function(err, data) {
                    if (err) {
                        console.log('error in batch write for ' + tableName + ': ' + err);
                    }
                    else {
                        console.log("items saved for " + tableName);
                    }
                });
		}

		for (var i = 0; i < items.length; i++) {
	        requestItem[tableName].push({
				PutRequest: {
					Item: items[i]
				}
			});

		    if (i % 25 === 0) {
                batchWrite();
                requestItem[tableName] = [];
		    }
		}

		if (requestItem[tableName].length > 0) {
		    batchWrite();
		}
	}
}

