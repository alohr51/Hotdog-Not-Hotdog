'use strict';
var express = require('express');
var app = express();
var cfenv = require("cfenv");
var http = require("http").Server(app);
var request = require("request");
// bodyParser is middleware that creates a new body object containing key-value pairs,
// where the value can be a string or array (when extended is false), or any type (when extended is true)
var bodyParser = require('body-parser');
var multer  = require('multer');
var fs = require('fs');
var path = require('path');
var mime = require('mime');
var watson = require('watson-developer-cloud');
const crypto = require('crypto');
const IMAGE_SIZE_LIMIT_BYTES = 2000000; //2MB
const UPLOAD_DIR_NAME = "uploads";

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, './uploads/')
	},
	filename: function (req, file, cb) {
		crypto.pseudoRandomBytes(16, function (err, raw) {
			cb(null, raw.toString('hex') + Date.now() + '.' + mime.extension(file.mimetype));
		});
	}
});

var upload = multer({ storage: storage });
app.use(bodyParser.urlencoded({ extended: true }));

// use the cfenv package to grab our application environment obj
var appEnv = cfenv.getAppEnv();

// get the bounded Bluemix service credentials
var watsonService = appEnv.getService("Hotdog-Visual-Recognition");
var apikey = watsonService.credentials.api_key;

var visual_recognition = watson.visual_recognition({
  api_key: apikey,
  version: 'v3',
  version_date: '2016-05-20'
});

// Configure views
app.use(express.static(path.join(__dirname, 'views')));

//make uploads dir if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR_NAME)){
    fs.mkdirSync(UPLOAD_DIR_NAME);
}

// Handle HTTP GET request to the "/" URL
app.get('/', function(req, res) {
	res.render('index');
});

app.post('/hotdog', upload.single('maybe-hotdog-image'), function(req, res) {
	// make sure there is an image to process
	if(typeof req.file === "undefined"){
		return res.status(400).json({msg: "An image must be provided"});
	}
	var filePath = req.file.path;

	// check its only png or jpeg (watson service only uses those 2 mimetypes)
	var mtype = req.file.mimetype;
	if(typeof mtype === "undefined" || (mtype !== "image/jpeg" && mtype !== "image/png")){
		deleteFile(filePath);
		return res.status(400).json({msg: "Only jpeg and png images are allowed"});
	}

	// limit size to 2MB 
	if(req.file.size > IMAGE_SIZE_LIMIT_BYTES){
		deleteFile(filePath);
		return res.status(400).json({msg: "Images must be 2MB or less. Your image was: " + formatBytes(req.file.size)});
	}

	var params = {
		classifier_ids: ["Hotdogs_1346435223"],
		threshold: .5,
		image_file: fs.createReadStream(filePath)
	};

	visual_recognition.classify(params, function(err, result) {
		// now that the image is classified we can delete it from uploads folder
		deleteFile(filePath);

		if (err){
			console.log(err);
			return res.status(500).json({msg: "Failure to classify image"});
		}
		return res.status(200).json(result);
	});
});

app.get('/hotdog', upload.single('maybe-hotdog-image'), function(req, res) {
	var url = req.query.url;
	// make sure there is an image to process
	if(typeof url === "undefined" || url === ""){
		return res.status(400).json({msg: "A url must be provided"});
	}

	// poke the provided url to validate the image before sending to watson
	getURLHeaders(url, function(err, headers){
		if(err){
			return res.status(502).json({msg: "Failure to verify image"});
		}

		var contentType = headers['content-type'];
		var contentLength = headers['content-length'];

		if(typeof contentType === "undefined" || (contentType !== "image/jpeg" && contentType !== "image/png")){
			return res.status(400).json({msg: "Only jpeg and png images are allowed"});
		}

		// limit size to 2MB 
		if(contentLength > IMAGE_SIZE_LIMIT_BYTES){
			return res.status(400).json({msg: "Images must be 2MB or less. Your image was: " + formatBytes(contentLength)});
		}

		var params = {
			classifier_ids: ["Hotdogs_1346435223"],
			threshold: .5,
			url: url
		};

		visual_recognition.classify(params, function(err, result) {
			if (err){
				console.log(err);
				return res.status(500).json({msg: "Failure to classify image"});
			}
			return res.status(200).json(result);
		});
	});
});

function formatBytes(bytes, decimals) {
	if(bytes == 0) return '0 Bytes';
	var k = 1000;
	var dm = decimals || 2;
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	var i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function deleteFile(filePath){
	fs.unlink(filePath, err => {
		if(err)
			console.log(err);
	});
}

function getURLHeaders(url, callback){
	request.head(url, function(err, res, body){
		if(err){
			console.log("Error getting HEAD for url: " + url);
			return callback(err, null);
		}
		return callback(null, res.headers);
	});
}

http.listen(appEnv.port, appEnv.bind);
console.log('App started on ' + appEnv.bind + ':' + appEnv.port);
