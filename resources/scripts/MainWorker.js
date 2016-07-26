// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('chrome://screencastify/content/resources/scripts/comm/Comm.js');
var {callInBootstrap, callInChildworker1} = CommHelper.mainworker;

// Globals
var core;
var gBsComm = new Comm.client.worker();
var gConvWkComm;
var callInConvworker = Comm.callInX.bind(null, 'gConvWkComm', null);
var gHydrants; // keys are getPage() names, like NewRecordingPage and value is an object which is its hydrant

// build arguments for ffmpeg based on target conversion type
var gConversionArgs = {
	gif: [
		'-i', 'input.webm',
		'-vf', 'showinfo',
		'-strict', '-2',
		'output.gif'
	],
	mp4: [ // https://twittercommunity.com/t/ffmpeg-mp4-upload-to-twitter-unsupported-error/68602/2?u=noitidart
		'-i', 'input.webm',
		'-vcodec', 'libx264',
		'-pix_fmt', 'yuv420p',
		'-vf', 'showinfo',
		'-acodec', 'aac',
		'output.mp4'
	]
};
// '\'' + '-t 3 -i input.webm -vf showinfo -strict -2 -c:v libx264 output.mp4'.split(' ').join('\', \'') + '\''

function dummyForInstantInstantiate() {}
function init(objCore) {
	//console.log('in worker init');

	core = objCore;

	importScripts(core.addon.path.scripts + 'supplement/MainWorkerSupplement.js');
	importScripts(core.addon.path.scripts + '3rd/hmac-sha1.js');
	importScripts(core.addon.path.scripts + '3rd/enc-base64-min.js');

	core.os.name = OS.Constants.Sys.Name.toLowerCase();
	core.os.mname = core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name; // mname stands for modified-name

	core.addon.path.storage = OS.Path.join(OS.Constants.Path.profileDir, 'jetpack', core.addon.id, 'simple-storage');

	// load all localization pacakages
	formatStringFromName('blah', 'main');
	formatStringFromName('blah', 'app');
	core.addon.l10n = _cache_formatStringFromName_packages;

	// prepare but dont yet create conversion worker
	gConvWkComm = new Comm.server.worker(core.addon.path.scripts + 'ConversionWorker.js?' + core.addon.cache_key, ()=>{return core});

	setTimeoutSync(1000); // i want to delay 1sec to allow old framescripts to destroy

	return core;
}

// Start - Addon Functionality
self.onclose = function() {
	console.log('doing mainworker term proc');

	workerComm_unregAll();

	switch (core.os.mname) {
		case 'android':

				if (OSStuff.jenv) {
					JNI.UnloadClasses(OSStuff.jenv);
				}

			break;
	}

	console.log('ok ready to terminate');
}

var gDataStore = {}; // key is recording actionid
var gDataStoreNextId = 0;
function createStore() {
	var storeid = gDataStoreNextId++;
	gDataStore[storeid] = {};
	return storeid;
}
function getStore(storeid) {
	// returns the btn store from gBtnStore, if it doesnt exist, it creates one
	return gDataStore[storeid];
}

////// start - specific helper functions
function autogenScreencastFileName(aDateGettime) {
	// no extension generated

	// Screencast - Mmm DD, YYYY - hh:mm AM
	// Screencast - Feb 25, 2016 - 5:04 AM

	var nowDate = new Date();
	if (aDateGettime) {
		nowDate = new Date(aDateGettime);
	}

	var Mmm = formatStringFromName('month.' + (nowDate.getMonth() + 1) + '.Mmm', 'chrome://global/locale/dateFormat.properties');
	var YYYY = nowDate.getFullYear();
	var DD = nowDate.getDate();

	var mm = nowDate.getMinutes();
	var hh = nowDate.getHours(); // 0 - 23
	var AM;
	if (hh < 12) {
		AM = 'AM';
	} else {
		AM = 'PM';
	}

	// adjust hh to 12 hour
	if (hh === 0) {
		hh = 12;
	} else if (hh > 12) {
		hh -= 12;
	}

	// prefix mm with 0
	if (mm < 10) {
		mm = '0' + mm;
	}

	return [formatStringFromName('screencast', 'main'), ' - ', Mmm, ' ', DD, ', ', YYYY, ' ', hh, ':', mm, ' ', AM].join('');
}

function buildPathForScreencast(path, rec, unsafe_filename) {
	// unsafe_filename is either a string, or undefined. if undefined, rec.time is used with autogenScreencastFileName
	// after unsafe_filename is a string, it is safedForPlatFS
	if (!unsafe_filename) {
		unsafe_filename = autogenScreencastFileName(unsafe_filename);
	}

	return OS.Path.join( path, safedForPlatFS(unsafe_filename, {repStr:'.'}) ) + '.' + rec.mimetype.substr(rec.mimetype.indexOf('/')+1);
}


function buildOSFileErrorString(aMethod, aOSFileError) { // rev1 - https://gist.github.com/Noitidart/a67dc6c83ae79aeffe5e3123d42d8f65
	// aMethod:string - enum[writeAtomic]

	switch (aMethod) {
		case 'writeAtomic':
				var explain;
				if (aOSFileError.becauseNoSuchFile) {
					explain = formatStringFromName('osfileerror_writeatomic_nosuchfile', 'main');
				} else {
					explain = formatStringFromName('osfileerror_unknownreason', 'main');
				}
				formatStringFromName('osfileerror_' + aMethod, 'app', [explain, aOSFileError.winLastError || aOSFileError.unixErrno])
			break;
	}
}

function convertRec(rec, to, aResumeCallback, aActionFinalizer, aReportProgress) {
	// to: mp4, gif, webm
	// does a mimetype shouldConvert check

	// aActionFinalizer in case error and this guy needs to finalize
	// on success it calls aResumeCallback, and mimetype and arrbuf in rec will be overwritten

	// start async-proc8888
	var shouldConvert = function() {
		if (rec.mimetype.endsWith('/' + to)) {
			// no need to convert
			aResumeCallback()
		} else {
			convert()
		}
	};

	var convert = function() {
		console.log('converting to:', to);

		// convert it
		aReportProgress({
			reason_code: 'CONVERTING_WAIT-' + to
		});

		callInConvworker('run', {
			arrbuf: rec.arrbuf,
			args: gConversionArgs[to],
			__XFER: ['arrbuf']
		}, checkConverted);
	};

	var checkConverted = function(aConvArg, aComm) {
		if (aConvArg.__PROGRESS) {
			switch(aConvArg.status) {
				case 'CONV_STARTED':
						aReportProgress({
							reason_code: 'CONVERTING_PROGRESS-' + to
						});
					break;
				case 'CONV_STDOUT':
						var { stdout } = aConvArg;
						aReportProgress({
							reason_code: 'CONVERTING_PROGRESS-' + to + '_' + stdout.substr(0, 144) + '...'
						});
					break;
			}
		} else {
			if (aConvArg.status) {
				rec.arrbuf = aConvArg.arrbuf;
				switch (to) {
					case 'gif':
							rec.mimetype = 'image/gif';
						break;
					case 'mp4':
							rec.mimetype = 'video/mp4';
						break;
					case 'webm':
							rec.mimetype = 'video/webm';
						break;
				}
				aResumeCallback();
			} else {
				var finalize_obj = {
					ok: false,
					reason_code: 'CONVERTING_FAIL-' + JSON.stringify({
						to,
						printed: aConvArg.printed
					})
				};
				// special and specific to gfycat
				if (rec.serviceid == 'gfycat' || rec.serviceid == 'gfycatanon') {
					finalize_obj.body_prefix = null; // remove the prefix
					finalize_obj.body_suffix = formatStringFromName('newrecording_alertsuffix_neededgfycatconv', 'app');
				}
				aActionFinalizer(finalize_obj);
			}
		}
	};

	shouldConvert();
	// end async-proc8888
}

function genericOnUploadProgress(rec, aReportProgress, e) {

	var total_size = formatBytes(rec.arrbuf.byteLength, 1);


	var percent;
	var uploaded_size;
	if (e.lengthComputable) {
		percent = Math.round((e.loaded / e.total) * 100);
		uploaded_size = formatBytes(e.loaded, 1);
	} else {
		percent = '?';
		uploaded_size = '?';
	}

	aReportProgress({
		reason: formatStringFromName('uploading_progress', 'app', [percent, uploaded_size, total_size])
	});
};


////// start - non-oauth actions
function action_browse(rec, aActionFinalizer, aReportProgress) {
	// action for save-browse
	console.error('action browse called!');

	// start async-proc0003
	var filepath;
	var browse = function() {
		aReportProgress({
			reason: formatStringFromName('newrecording_alertbody_browseopened', 'app')
		});
		var file_ext = rec.mimetype.substr(rec.mimetype.indexOf('/')+1);
		callInBootstrap(
			'browseFile',
			{
				aDialogTitle: formatStringFromName('dialog_save_title', 'main'),
				aOptions: {
					mode: 'modeSave',
					filters: [
						formatStringFromName('webm', 'main'), '*.webm',
						formatStringFromName('gif', 'main'), '*.gif',
						formatStringFromName('mp4', 'main'), '*.mp4'
					],
					async: true,
					win: 'navigator:browser',
					defaultString: safedForPlatFS(autogenScreencastFileName(rec.time), {repStr:'.'}),
					returnDetails: true
				}
			},
			function(aArg, aComm) {
				if (!aArg) {
					aActionFinalizer({
						status: false,
						reason_code: 'CANCELLED'
					});
				} else {
					filepath = aArg.filepath;
					filter = aArg.filter;
					// filepath should be safed, as the browse dialog wont let in illegal characters
					var ext = filter.substr(2); // as i start filters with a *.
					if (!filepath.toLowerCase().endsWith('.' + ext)) {
						filepath += '.' + ext;
					}
					tryConvert(ext);
				}
			}
		);
	};

	var tryConvert = function(ext) {
		convertRec(rec, ext, write, aActionFinalizer, aReportProgress);
	};

	var write = function() {

		aReportProgress({
			reason: formatStringFromName('newrecording_alertbody_writing', 'app')
		});

		try {
			OS.File.writeAtomic( filepath, new Uint8Array(rec.arrbuf) );
			aActionFinalizer({
				ok: true,
				reason_code: 'FILE_SAVE_SUCCESS_RESULTS-' + JSON.stringify({
					link: filepath
				})
			});
		} catch (OSFileError) {
			console.error('OSFileError:', OSFileError);
			aActionFinalizer({
				ok: false,
				reason: buildOSFileErrorString('writeAtomic', OSFileError)
			});
		}
	};

	browse();
	// end async-proc0003
}

function action_gfycatanon(rec, aActionFinalizer, aReportProgress) {
	// start async-proc938

	var YourOwnRandomString = randomString(10);
	console.log('YourOwnRandomString:', YourOwnRandomString);
	var shouldConvert = function() {
		if (rec.duration > 15) {
			// gfycat allows mp4 to be max 15s, if over that then i should convert
			aReportProgress({
				body_prefix: formatStringFromName('newrecording_alertprefix_needgfycatconv', 'app')
			});
			convertRec(rec, 'gif', upload, aActionFinalizer, aReportProgress);
		} else {
			upload();
		}
	};

	var upload = function() {
		aReportProgress({
			body_prefix: undefined, // remove the had to convert to gif prefix, in case it was there
			reason: formatStringFromName('uploading_init', 'app')
		});

		var blob = new Blob([new Uint8Array(rec.arrbuf)], { type:rec.mimetype });
		var file = new File([blob], autogenScreencastFileName(rec.time));

		var data = new FormData();
		data.append('key', YourOwnRandomString);
		data.append('acl', 'private');
		data.append('AWSAccessKeyId', 'AKIAIT4VU4B7G2LQYKZQ');
		data.append('policy', 'eyAiZXhwaXJhdGlvbiI6ICIyMDIwLTEyLTAxVDEyOjAwOjAwLjAwMFoiLAogICAgICAgICAgICAiY29uZGl0aW9ucyI6IFsKICAgICAgICAgICAgeyJidWNrZXQiOiAiZ2lmYWZmZSJ9LAogICAgICAgICAgICBbInN0YXJ0cy13aXRoIiwgIiRrZXkiLCAiIl0sCiAgICAgICAgICAgIHsiYWNsIjogInByaXZhdGUifSwKCSAgICB7InN1Y2Nlc3NfYWN0aW9uX3N0YXR1cyI6ICIyMDAifSwKICAgICAgICAgICAgWyJzdGFydHMtd2l0aCIsICIkQ29udGVudC1UeXBlIiwgIiJdLAogICAgICAgICAgICBbImNvbnRlbnQtbGVuZ3RoLXJhbmdlIiwgMCwgNTI0Mjg4MDAwXQogICAgICAgICAgICBdCiAgICAgICAgICB9');
		data.append('success_action_status', '200');
		data.append('signature', 'mk9t/U/wRN4/uU01mXfeTe2Kcoc=');
		data.append('Content-Type', rec.mimetype);
		data.append('file', file);

		xhrAsync(
			'https://gifaffe.s3.amazonaws.com/',
			{
				method: 'POST',
				data,
				onuploadprogress: genericOnUploadProgress.bind(null, rec, aReportProgress)
			},
			// verifyOauthXhrBind(rec, checkUpload, aActionFinalizer, aReportProgress)
			checkUpload
		);
	};

	var checkUpload = function(xhrArg) {
		var { request, ok, reason } = xhrArg;
		var { status, statusText, response, responseText } = request;
		console.log('checkUpload:', { request, ok, reason, status, statusText, response, responseText });
		if (xhrArg.ok) {
			transcode();
		} else {
			aActionFinalizer({
				ok: false,
				reason: formatStringFromName('unhandled_status', 'app', [status, request.responseURL, JSON.stringify(response)])
			});
		}
	};

	var transcode = function() {
		aReportProgress({
			reason: formatStringFromName('gfycat_start_conversions', 'app')
		});
		xhrAsync(
			'https://upload.gfycat.com/transcodeRelease/' + YourOwnRandomString,
			{
				method: 'GET',
				responseType: 'json'
			},
			checkTranscode
		);
	};

	var start_time;
	var checkTranscode = function(xhrArg) {
		var { request, ok, reason } = xhrArg;
		var { status, statusText, response } = request;
		console.log('checkTranscode:', { request, ok, reason, status, statusText, response });
		if (xhrArg.ok) {
			// response = {
			// 	isOk: 'true'
			// }
			switch (response.isOk) {
				case 'true':
						start_time = Date.now();
						requestStatus();
					break;
				default:
					aActionFinalizer({
						ok: false,
						reason: formatStringFromName('unhandled_status', 'app', [status, request.responseURL, JSON.stringify(response)])
					});
			}
		} else {
			aActionFinalizer({
				ok: false,
				reason: formatStringFromName('unhandled_status', 'app', [status, request.responseURL, JSON.stringify(response)])
			});
		}
	};

	var gfyname;
	var requestStatus = function(xhrArg) {
		aReportProgress({
			reason: formatStringFromName('fetching_progress', 'app')
		});
		xhrAsync(
			'https://upload.gfycat.com/status/' + YourOwnRandomString,
			{
				method: 'GET',
				responseType: 'json'
			},
			checkStatus
		);
	};

	var checkStatus = function(xhrArg) {
		// xhrArg is either xhrArg or false/undefined as this is triggered by verifyOauthXhr
		if (!xhrArg) {
			// retry xhr
			requestStatus();
		} else {
			var { request, ok, reason } = xhrArg;
			var { status, statusText, response } = request;
			switch (status) {
				case 200:
						if (response.task == 'complete') {
							gfyname = response.gfyname;
							aActionFinalizer({
								ok: true,
								reason_code: 'UPLOAD_SUCCESS_RESULTS-' + JSON.stringify({
									link_gfycat: 'https://gfycat.com/' + gfyname,
									link_webm: 'https://zippy.gfycat.com/' + gfyname + '.webm',
									link_mp4:  'https://fat.gfycat.com/' + gfyname + '.mp4',
									link_gif: 'https://fat.gfycat.com/' + gfyname + '.gif',
									link_gifsmall: 'https://zippy.gfycat.com/' + gfyname + '.gif'
								})
							});
						} else {
							aReportProgress({
								reason_code: 'GFYCAT_CONVERTING-' + JSON.stringify({
									current_step: response.task,
									link_webm: rec.mimetype == 'video/webm' ? 'https://zippy.gfycat.com/' + gfyname + '.webm' : undefined,
									link: 'https://zippy.gfycat.com/' + gfyname,
									check_in: 10,
									start_time
								})
							});
							setTimeout(requestStatus, 10000);
						}
					break;
				default:
					aActionFinalizer({
						ok: false,
						reason: formatStringFromName('unhandled_status', 'app', [status, request.responseURL, JSON.stringify(response)])
					});
			}
		}
	};

	shouldConvert();
	// end async-proc938
}

function action_quick(rec, aActionFinalizer, aReportProgress) {
	// action for save-quick
	console.log('worker - action_quick');

	// start async-proc3933
	var gsd = function() {
		console.log('worker - action_quick - gsd');
		aReportProgress({
			reason: formatStringFromName('determining_default_vids', 'app')
		});
		getSystemDirectory('Videos').then(write);
	};

	var write = function(path) {
		console.log('worker - action_quick - write');
		aReportProgress({
			reason: formatStringFromName('newrecording_alertbody_writing', 'app')
		});
		try {
			OS.File.writeAtomic( buildPathForScreencast(path, rec), new Uint8Array(rec.arrbuf) );
			aActionFinalizer({
				ok: true,
				reason_code: 'FILE_SAVE_SUCCESS_RESULTS-' + JSON.stringify({
					link: buildPathForScreencast(path, rec)
				})
			});
		} catch (OSFileError) {
			console.error('OSFileError:', OSFileError);
			aActionFinalizer({
				ok: false,
				reason: buildOSFileErrorString('writeAtomic', OSFileError)
			});
		}
	};

	gsd();
	// end async-proc3933
}
////// start - non-oauth actions


// start - functions called by bootstrap
function fetchHydrant(head, aComm) {
	// returns undefined if no hydrant, otherwise the page will overwrite its hydrant with an empty object which will screw up all the default values for redux

	if (!gHydrants) {
		try {
			gHydrants = JSON.parse(OS.File.read(OS.Path.join(core.addon.path.storage, 'hydrants.json'), {encoding:'utf-8'}));
		} catch (OSFileError) {
			if (OSFileError.becauseNoSuchFile) {
				gHydrants = {};
			}
			else { console.error('OSFileError:', OSFileError); throw new Error('error when trying to ready hydrant:', OSFileError); }
		}
	}

	return gHydrants[head];
}

var gWriteHydrantsTimeout;
function updateHydrant(aArg, aComm) {
	var { head, hydrant } = aArg;
	gHydrants[head] = hydrant;

	if (gWriteHydrantsTimeout) {
		clearTimeout(gWriteHydrantsTimeout);
	}
	gWriteHydrantsTimeout = setTimeout(writeHydrants, 30000);
}

function writeHydrants() {
	gWriteHydrantsTimeout = null;
	if (gHydrants) {
		console.error('writing hydrants.json');
		writeThenDir(OS.Path.join(core.addon.path.storage, 'hydrants.json'), JSON.stringify(gHydrants), OS.Constants.Path.profileDir);
	}
}

function bootstrapTimeout(milliseconds) {
	var mainDeferred_bootstrapTimeout = new Deferred();
	setTimeout(function() {
		mainDeferred_bootstrapTimeout.resolve();
	}, milliseconds)
	return mainDeferred_bootstrapTimeout.promise;
}

var gWorker = this;
function processAction(aArg, aReportProgress, aComm) {
	var { actionid, serviceid, duration, arrbuf, time, mimetype, action_options } = aArg;

	var deferredMain_processAction = new Deferred();

	console.log('worker - processAction - aArg:', aArg);
	var rec = { serviceid, actionid, duration, arrbuf, time, mimetype, action_options };
	// time - is time it was taken, i use that as videoid

	gWorker['action_' + serviceid](rec, function(status) {
		console.log('worker - processAction complete, status:', status);
		deferredMain_processAction.resolve(status);
	}, aReportProgress);

	return deferredMain_processAction.promise;
}
// end - functions called by bootstrap

// End - Addon Functionality

// start - common helper functions
function queryStringAsJson(aQueryString) {
	var asJsonStringify = aQueryString;
	asJsonStringify = asJsonStringify.replace(/&/g, '","');
	asJsonStringify = asJsonStringify.replace(/=/g, '":"');
	asJsonStringify = '{"' + asJsonStringify + '"}';
	asJsonStringify = asJsonStringify.replace(/"(\d+|true|false)"/, function($0, $1) { return $1; });

	return JSON.parse(asJsonStringify);
}

function to_rfc3986(aStr) {
	// https://af-design.com/2008/03/14/rfc-3986-compliant-uri-encoding-in-javascript/
	// i should test with the samples given here - https://dev.twitter.com/oauth/overview/percent-encoding-parameters
	var tmp =  encodeURIComponent(aStr);
	tmp = tmp.replace(/\!/g,'%21');
	tmp = tmp.replace(/\*/g,'%2A');
	tmp = tmp.replace(/\(/g,'%28');
	tmp = tmp.replace(/\)/g,'%29');
	tmp = tmp.replace(/'/g,'%27');
	return tmp;
}

function alphaStrOfObj(aObj, aParseFunc, aJoinStr, aDblQuot) {
	var arr = Object.keys(aObj);
	arr.sort();

	if (!aParseFunc) {
		aParseFunc = function(aToBeParsed) {
			return aToBeParsed;
		};
	}

	for (var i=0; i<arr.length; i++) {
		arr[i] = aParseFunc(arr[i]) + '=' + (aDblQuot ? '"' : '') + aParseFunc(aObj[arr[i]]) + (aDblQuot ? '"' : '');
	}

	return arr.join(aJoinStr);
}

function parseArguments(text) {
	// from videoconverter.js
  text = text.replace(/\s+/g, ' ');
  var args = [];
  // Allow double quotes to not split args.
  text.split('"').forEach(function(t, i) {
    t = t.trim();
    if ((i % 2) === 1) {
      args.push(t);
    } else {
      args = args.concat(t.split(" "));
    }
  });
  return args;
}

function formatBytes(bytes,decimals) {
   if(bytes == 0) return '0 Byte';
   var k = 1024; // or 1024 for binary
   var dm = decimals + 1 || 3;
   var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
   var i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function nonce(length) {
	// generates a nonce
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for(var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function randomString(aLength) {
	// http://stackoverflow.com/a/1349426/1828637
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < aLength; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

var _cache_getSystemDirectory = {};
function getSystemDirectory(type) {
	// main entry point that should be used for getting system path. worker, botostrap, etc should call here
	// for each type, guranteed to return a string

	// resolves to string
	// type - string - enum: Videos
	var deferredMain_getSystemDirectory = new Deferred();

	if (_cache_getSystemDirectory[type]) {
		deferredMain_getSystemDirectory.resolve(_cache_getSystemDirectory[type]);
	} else {
		const TYPE_ROUTE_BOOTSTRAP = 0;
		const TYPE_ROUTE_ANDROID = 1;
		const TYPE_ROUTE_OS_CONST = 2;
		switch (type) {
			case 'Videos':

					var platform = {
						winnt: { type:'Vids', route:TYPE_ROUTE_BOOTSTRAP },
						darwin: { type:'Mov', route:TYPE_ROUTE_BOOTSTRAP },
						gtk: { type:'XDGVids', route:TYPE_ROUTE_BOOTSTRAP },
						android: { type:'DIRECTORY_MOVIES', route:TYPE_ROUTE_ANDROID }
					};

				break;
		}

		var { type, route } = platform[core.os.mname];

		switch (route) {
			case TYPE_ROUTE_BOOTSTRAP:
					callInBootstrap('getSystemDirectory_bootstrap', type, function(path) {
						deferredMain_getSystemDirectory.resolve(path);
					});
				break;
			case TYPE_ROUTE_ANDROID:
					deferredMain_getSystemDirectory.resolve(getSystemDirectory_android[type]);
				break;
			case TYPE_ROUTE_OS_CONST:
					deferredMain_getSystemDirectory.resolve(OS.Constants.Path[type]);
				break;
		};
	}

	return deferredMain_getSystemDirectory.promise;
}

function getSystemDirectory_android(type) {
	// progrmatic helper for getSystemDirectory in MainWorker - devuser should NEVER call this himself
	// type - string - currently accepted values
		// DIRECTORY_DOWNLOADS
		// DIRECTORY_MOVIES
		// DIRECTORY_MUSIC
		// DIRECTORY_PICTURES

	// var OSStuff.jenv = null;
	try {
		if (!OSStuff.jenv) {
			OSStuff.jenv = JNI.GetForThread();
		}

		var SIG = {
			Environment: 'Landroid/os/Environment;',
			String: 'Ljava/lang/String;',
			File: 'Ljava/io/File;'
		};

		var Environment = JNI.LoadClass(OSStuff.jenv, SIG.Environment.substr(1, SIG.Environment.length - 2), {
			static_fields: [
				{ name: 'DIRECTORY_DOWNLOADS', sig: SIG.String },
				{ name: 'DIRECTORY_MOVIES', sig: SIG.String },
				{ name: 'DIRECTORY_MUSIC', sig: SIG.String },
				{ name: 'DIRECTORY_PICTURES', sig: SIG.String }
			],
			static_methods: [
				{ name:'getExternalStorageDirectory', sig:'()' + SIG.File }
			]
		});

		var jFile = JNI.LoadClass(OSStuff.jenv, SIG.File.substr(1, SIG.File.length - 2), {
			methods: [
				{ name:'getPath', sig:'()' + SIG.String }
			]
		});

		var OSPath_dirExternalStorage = JNI.ReadString(OSStuff.jenv, Environment.getExternalStorageDirectory().getPath());
		var OSPath_dirname = JNI.ReadString(OSStuff.jenv, Environment[type]);
		var OSPath_dir = OS.Path.join(OSPath_dirExternalStorage, OSPath_dirname);
		console.log('OSPath_dir:', OSPath_dir);

		return OSPath_dir;

	} finally {
		// if (OSStuff.jenv) {
		// 	JNI.UnloadClasses(OSStuff.jenv);
		// }
	}
}

// rev4 - not yet updated to gist - jun 12 16 - using Object.assign for defaults - https://gist.github.com/Noitidart/e6dbbe47fbacc06eb4ca
var _safedForPlatFS_pattWIN = /([\\*:?<>|\/\"])/g;
var _safedForPlatFS_pattNIXMAC = /[\/:]/g;
function safedForPlatFS(aStr, aOptions={}) {
	// depends on core.os.mname - expects it to be lower case
	// short for getSafedForPlatformFilesystem - meaning after running this on it, you can safely use the return in a filename on this current platform
	// aOptions
	//	repStr - use this string, in place of the default repCharForSafePath in place of non-platform safe characters
	//	allPlatSafe - by default it will return a path safed for the current OS. Set this to true if you want to to get a string that can be used on ALL platforms filesystems. A Windows path is safe on all other platforms

	// 022816 - i added : to _safedForPlatFS_pattNIXMAC because on mac it was replacing it with a `/` which is horrible it will screw up OS.Path.join .split etc

	// set defaults on aOptions
	aOptions = Object.assign({
		allPlatSafe: false,
		repStr: '-'
	}, aOptions)

	var usePlat = aOptions.allPlatSafe ? 'winnt' : core.os.mname; // a windows path is safe in all platforms so force that. IF they dont want all platforms then use the current platform
	switch (usePlat) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				return aStr.replace(_safedForPlatFS_pattWIN, aOptions.repStr);

			break;
		default:

				return aStr.replace(_safedForPlatFS_pattNIXMAC, aOptions.repStr);
	}
}

// rev2 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
var jQLike = { // my stand alone jquery like functions
	serialize: function(aSerializeObject, aEncoder=encodeURIComponent) {
		// https://api.jquery.com/serialize/

		// verified this by testing
			// http://www.w3schools.com/jquery/tryit.asp?filename=tryjquery_ajax_serialize
			// http://www.the-art-of-web.com/javascript/escape/

		var serializedStrArr = [];
		for (var cSerializeKey in aSerializeObject) {
			serializedStrArr.push(aEncoder(cSerializeKey) + '=' + aEncoder(aSerializeObject[cSerializeKey]));
		}
		return serializedStrArr.join('&');
	}
};

// https://gist.github.com/Noitidart/7810121036595cdc735de2936a7952da -rev1
function writeThenDir(aPlatPath, aContents, aDirFrom, aOptions={}) {
	// tries to writeAtomic
	// if it fails due to dirs not existing, it creates the dir
	// then writes again
	// if fail again for whatever reason it throws

	var cOptionsDefaults = {
		encoding: 'utf-8',
		noOverwrite: false
		// tmpPath: aPlatPath + '.tmp'
	};

	aOptions = Object.assign(cOptionsDefaults, aOptions);

	var do_write = function() {
		OS.File.writeAtomic(aPlatPath, aContents, aOptions); // doing unixMode:0o4777 here doesn't work, i have to `OS.File.setPermissions(path_toFile, {unixMode:0o4777})` after the file is made
	};

	try {
		do_write();
	} catch (OSFileError) {
		if (OSFileError.becauseNoSuchFile) { // this happens when directories dont exist to it
			OS.File.makeDir(OS.Path.dirname(aPlatPath), {from:aDirFrom});
			do_write(); // if it fails this time it will throw outloud
		} else {
			throw OSFileError;
		}
	}

}

function setTimeoutSync(aMilliseconds) {
	var breakDate = Date.now() + aMilliseconds;
	while (Date.now() < breakDate) {}
}

// rev1 - _ff-addon-snippet-safedForPlatFS.js - https://gist.github.com/Noitidart/e6dbbe47fbacc06eb4ca
var _safedForPlatFS_pattWIN = /([\\*:?<>|\/\"])/g;
var _safedForPlatFS_pattNIXMAC = /\//g;
function safedForPlatFS(aStr, aOptions={}) {
	// short for getSafedForPlatformFilesystem - meaning after running this on it, you can safely use the return in a filename on this current platform
	// aOptions
	//	repStr - use this string, in place of the default repCharForSafePath in place of non-platform safe characters
	//	allPlatSafe - by default it will return a path safed for the current OS. Set this to true if you want to to get a string that can be used on ALL platforms filesystems. A Windows path is safe on all other platforms

	// set defaults on aOptions
	if (!('allPlatSafe' in aOptions)) {
		aOptions.allPlatSafe = false;
	}
	if (!('repStr' in aOptions)) {
		aOptions.repStr = '-';
	}

	var usePlat = aOptions.allPlatSafe ? 'winnt' : core.os.name; // a windows path is safe in all platforms so force that. IF they dont want all platforms then use the current platform
	switch (usePlat) {
		case 'winnt':
		case 'winmo':
		case 'wince':

				return aStr.replace(_safedForPlatFS_pattWIN, aOptions.repStr);

			break;
		default:

				return aStr.replace(_safedForPlatFS_pattNIXMAC, aOptions.repStr);
	}
}
function validateOptionsObj(aOptions, aOptionsDefaults) {
	// ensures no invalid keys are found in aOptions, any key found in aOptions not having a key in aOptionsDefaults causes throw new Error as invalid option
	for (var aOptKey in aOptions) {
		if (!(aOptKey in aOptionsDefaults)) {
			console.error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value, aOptionsDefaults:', aOptionsDefaults, 'aOptions:', aOptions);
			throw new Error('aOptKey of ' + aOptKey + ' is an invalid key, as it has no default value');
		}
	}

	// if a key is not found in aOptions, but is found in aOptionsDefaults, it sets the key in aOptions to the default value
	for (var aOptKey in aOptionsDefaults) {
		if (!(aOptKey in aOptions)) {
			aOptions[aOptKey] = aOptionsDefaults[aOptKey];
		}
	}
}

// rev2 - https://gist.github.com/Noitidart/ec1e6b9a593ec7e3efed
function xhr(aUrlOrFileUri, aOptions={}) {
	// console.error('in xhr!!! aUrlOrFileUri:', aUrlOrFileUri);

	// all requests are sync - as this is in a worker
	var aOptionsDefaults = {
		responseType: 'text',
		timeout: 0, // integer, milliseconds, 0 means never timeout, value is in milliseconds
		headers: null, // make it an object of key value pairs
		method: 'GET', // string
		data: null // make it whatever you want (formdata, null, etc), but follow the rules, like if aMethod is 'GET' then this must be null
	};
	aOptions = Object.assign(aOptionsDefaults, aOptions);

	var cRequest = new XMLHttpRequest();

	cRequest.open(aOptions.method, aUrlOrFileUri, false); // 3rd arg is false for synchronus

	if (aOptions.headers) {
		for (var h in aOptions.headers) {
			cRequest.setRequestHeader(h, aOptions.headers[h]);
		}
	}

	cRequest.responseType = aOptions.responseType;
	cRequest.send(aOptions.data);

	// console.log('response:', cRequest.response);

	// console.error('done xhr!!!');
	return cRequest;
}

// rev4 - https://gist.github.com/Noitidart/6d8a20739b9a4a97bc47
var _cache_formatStringFromName_packages = {}; // holds imported packages
function formatStringFromName(aKey, aLocalizedPackageName, aReplacements) {
	// depends on ```core.addon.path.locale``` it must be set to the path to your locale folder

	// aLocalizedPackageName is name of the .properties file. so mainworker.properties you would provide mainworker // or if it includes chrome:// at the start then it fetches that
	// aKey - string for key in aLocalizedPackageName
	// aReplacements - array of string

	// returns null if aKey not found in pacakage

	var packagePath;
	var packageName;
	if (aLocalizedPackageName.indexOf('chrome:') === 0 || aLocalizedPackageName.indexOf('resource:') === 0) {
		packagePath = aLocalizedPackageName;
		packageName = aLocalizedPackageName.substring(aLocalizedPackageName.lastIndexOf('/') + 1, aLocalizedPackageName.indexOf('.properties'));
	} else {
		packagePath = core.addon.path.locale + aLocalizedPackageName + '.properties';
		packageName = aLocalizedPackageName;
	}

	if (!_cache_formatStringFromName_packages[packageName]) {
		var packageStr = xhr(packagePath).response;
		var packageJson = {};

		var propPatt = /(.*?)=(.*?)$/gm;
		var propMatch;
		while (propMatch = propPatt.exec(packageStr)) {
			packageJson[propMatch[1]] = propMatch[2];
		}

		_cache_formatStringFromName_packages[packageName] = packageJson;

		console.log('packageJson:', packageJson);
	}

	var cLocalizedStr = _cache_formatStringFromName_packages[packageName][aKey];
	if (!cLocalizedStr) {
		return null;
	}
	if (aReplacements) {
		for (var i=0; i<aReplacements.length; i++) {
			cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
		}
	}

	return cLocalizedStr;
}

function xhrAsync(aUrlOrFileUri, aOptions={}, aCallback) { // 052716 - added timeout support
	// console.error('in xhr!!! aUrlOrFileUri:', aUrlOrFileUri);
	if (!aUrlOrFileUri && aOptions.url) { aUrlOrFileUri = aOptions.url }

	// all requests are sync - as this is in a worker
	var aOptionsDefaults = {
		responseType: 'text',
		timeout: 0, // integer, milliseconds, 0 means never timeout, value is in milliseconds
		headers: null, // make it an object of key value pairs
		method: 'GET', // string
		data: null, // make it whatever you want (formdata, null, etc), but follow the rules, like if aMethod is 'GET' then this must be null
		onprogress: undefined, // set to callback you want called
		onuploadprogress: undefined // set to callback you want called
	};
	Object.assign(aOptionsDefaults, aOptions);
	aOptions = aOptionsDefaults;

	var request = new XMLHttpRequest();

	request.timeout = aOptions.timeout;

	var handler = ev => {
		evf(m => request.removeEventListener(m, handler, !1));

		switch (ev.type) {
			case 'load':

					aCallback({request, ok:true});
					// if (xhr.readyState == 4) {
					// 	if (xhr.status == 200) {
					// 		deferredMain_xhr.resolve(xhr);
					// 	} else {
					// 		var rejObj = {
					// 			name: 'deferredMain_xhr.promise',
					// 			aReason: 'Load Not Success', // loaded but status is not success status
					// 			xhr: xhr,
					// 			message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					// 		};
					// 		deferredMain_xhr.reject(rejObj);
					// 	}
					// } else if (xhr.readyState == 0) {
					// 	var uritest = Services.io.newURI(aStr, null, null);
					// 	if (uritest.schemeIs('file')) {
					// 		deferredMain_xhr.resolve(xhr);
					// 	} else {
					// 		var rejObj = {
					// 			name: 'deferredMain_xhr.promise',
					// 			aReason: 'Load Failed', // didnt even load
					// 			xhr: xhr,
					// 			message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					// 		};
					// 		deferredMain_xhr.reject(rejObj);
					// 	}
					// }

				break;
			case 'abort':
			case 'error':
			case 'timeout':

					// var result_details = {
					// 	reason: ev.type,
					// 	request,
					// 	message: request.statusText + ' [' + ev.type + ':' + request.status + ']'
					// };
					aCallback({request, ok:false, reason:ev.type});

				break;
			default:
				var result_details = {
					reason: 'unknown',
					request,
					message: request.statusText + ' [' + ev.type + ':' + request.status + ']'
				};
				aCallback({request, ok:false, reason:ev.type, result_details});
		}
	};


	var evf = f => ['load', 'error', 'abort', 'timeout'].forEach(f);
	evf(m => request.addEventListener(m, handler, false));

	if (aOptions.onprogress) {
		request.addEventListener('progress', aOptions.onprogress, false);
	}
	if (aOptions.onuploadprogress) {
		request.upload.addEventListener('progress', aOptions.onuploadprogress, false);
	}
	request.open(aOptions.method, aUrlOrFileUri, true); // 3rd arg is false for async

	if (aOptions.headers) {
		for (var h in aOptions.headers) {
			request.setRequestHeader(h, aOptions.headers[h]);
		}
	}

	request.responseType = aOptions.responseType;
	request.send(aOptions.data);

	// console.log('response:', request.response);

	// console.error('done xhr!!!');

}

function Deferred() { // revFinal
	this.resolve = null;
	this.reject = null;
	this.promise = new Promise(function(resolve, reject) {
		this.resolve = resolve;
		this.reject = reject;
	}.bind(this));
	Object.freeze(this);
}
function genericReject(aPromiseName, aPromiseToReject, aReason) {
	var rejObj = {
		name: aPromiseName,
		aReason: aReason
	};
	console.error('Rejected - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
function genericCatch(aPromiseName, aPromiseToReject, aCaught) {
	var rejObj = {
		name: aPromiseName,
		aCaught: aCaught
	};
	console.error('Caught - ' + aPromiseName + ' - ', rejObj);
	if (aPromiseToReject) {
		aPromiseToReject.reject(rejObj);
	}
}
// end - common helper functions
