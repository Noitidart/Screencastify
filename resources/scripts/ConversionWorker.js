importScripts('chrome://screencastify/content/resources/scripts/comm/Comm.js');
var {callInBootstrap, callInMainworker} = CommHelper.childworker;
var gWkComm = new Comm.client.worker();

var core;
var gWkComm;

function init(aArg, aComm) {
	core = aArg;

	importScripts(core.addon.path.scripts + '3rd/ffmpeg-all-codecs.js');
}

function run(aArg, aReportProgress, aComm) {
	var { args, arrbuf } = aArg;

	aReportProgress({
		status: 'CONV_STARTED'
	});

	var printed = [];

	var print = function(stdout) {
		printed.push(stdout);
		aReportProgress({
			status: 'CONV_STDOUT',
			stdout
		});
		// console.warn('stdout:', stdout);
	};

	var converted_files = ffmpeg_run({
		arguments: args,
		files: [{ data:(new Uint8Array(arrbuf)), name:'input.webm' }],
		TOTAL_MEMORY: 536870912,
		print,
		printErr: print
	});
	console.error('conversion done, printed:', printed, 'converted_files:', converted_files);

	if (converted_files[0].data.byteLength) {
		return {
			status: true,
			arrbuf: converted_files[0].data,
			__XFER: ['arrbuf']
		}
	} else {
		return {
			status: false,
			printed
		}
	}
}

// start - common helper functions
function Deferred() {
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
