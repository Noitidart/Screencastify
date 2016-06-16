var core;
var gMainWkComm;

function init(aArg, aComm) {
	core = aArg;

	importScripts(core.addon.path.scripts + '3rd/ffmpeg-all-codecs.js');
}


function run(aArg, aReportProgress, aComm) {
	var { args, arrbuf } = aArg;

	aReportProgress({
		status: 'CONV_STARTED'
	});

	var print = function(stdout) {
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
	console.log('conversion done'); //, converted_files:', converted_files);

	if (converted_files.length) {
		return {
			status: true,
			arrbuf: converted_files[0].data,
			__XFER: ['arrbuf']
		}
	} else {
		return {
			status: false
		}
	}
}

// TODO: complete this mainworker-worker comm api
// start - CommAPI
var gWorker = this;

// start - CommAPI for mainworker-worker - worker side
function workerComm() {

	var scope = gWorker;
	var firstMethodCalled = false;
	this.nextcbid = 1; // next callback id
	this.callbackReceptacle = {};
	this.reportProgress = function(aProgressArg) {
		// aProgressArg MUST be an object, devuser can set __PROGRESS:1 but doesnt have to, because i'll set it here if its not there
		// this gets passed as thrid argument to each method that is called in the scope
		// devuser MUST NEVER bind reportProgress. as it is bound to {THIS:this, cbid:cbid}
		// devuser must set up the aCallback they pass to initial putMessage to handle being called with an object with key __PROGRESS:1 so they know its not the final reply to callback, but an intermediate progress update
		aProgressArg.__PROGRESS = 1;
		this.THIS.putMessage(this.cbid, aProgressArg);
	};
	this.putMessage = function(aMethod, aArg, aCallback) {
		// aMethod is a string - the method to call in bootstrap
		// aCallback is a function - optional - it will be triggered in scope when aMethod is done calling

		var cbid = null;
		if (typeof(aMethod) == 'number') {
			// this is a response to a callack waiting in framescript
			cbid = aMethod;
			aMethod = null;
		} else {
			if (aCallback) {
				cbid = this.nextcbid++;
				this.callbackReceptacle[cbid] = aCallback;
			}
		}

		var aTransfers;
		if (aArg && aArg.__XFER) {
			// if want to transfer stuff aArg MUST be an object, with a key __XFER holding the keys that should be transferred
			// __XFER is either array or object. if array it is strings of the keys that should be transferred. if object, the keys should be names of the keys to transfer and values can be anything
			aTransfers = [];
			var __XFER = aArg.__XFER;
			if (Array.isArray(__XFER)) {
				for (var p of __XFER) {
					aTransfers.push(aArg[p]);
				}
			} else {
				// assume its an object
				for (var p in __XFER) {
					aTransfers.push(aArg[p]);
				}
			}
		}

		self.postMessage({
			method: aMethod,
			arg: aArg,
			cbid
		}, aTransfers);
	};
	this.listener = function(e) {
		var payload = e.data;
		console.log('worker mainworkerworkerComm - incoming, payload:', payload); //, 'e:', e);

		if (payload.method) {
			if (!firstMethodCalled) {
				firstMethodCalled = true;
				if (payload.method != 'init' && scope.init) {
					this.putMessage('triggerOnAfterInit', scope.init(undefined, this));
				}
			}
			console.log('scope:', scope);
			if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') } // dev line remove on prod
			var rez_worker_call__for_mainworker = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
			// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
			console.log('rez_worker_call__for_mainworker:', rez_worker_call__for_mainworker);
			if (payload.cbid) {
				if (rez_worker_call__for_mainworker && rez_worker_call__for_mainworker.constructor.name == 'Promise') {
					rez_worker_call__for_mainworker.then(
						function(aVal) {
							console.log('Fullfilled - rez_worker_call__for_mainworker - ', aVal);
							this.putMessage(payload.cbid, aVal);
						}.bind(this),
						genericReject.bind(null, 'rez_worker_call__for_mainworker', 0)
					).catch(genericCatch.bind(null, 'rez_worker_call__for_mainworker', 0));
				} else {
					console.log('calling putMessage for callback with rez_worker_call__for_mainworker:', rez_worker_call__for_mainworker, 'this:', this);
					this.putMessage(payload.cbid, rez_worker_call__for_mainworker);
				}
			}
			// gets here on programtic init, as it for sure does not have a callback
			if (payload.method == 'init') {
				this.putMessage('triggerOnAfterInit', rez_worker_call__for_mainworker);
			}
		} else if (!payload.method && payload.cbid) {
			// its a cbid
			this.callbackReceptacle[payload.cbid](payload.arg, this);
			if (payload.arg && !payload.arg.__PROGRESS) {
				delete this.callbackReceptacle[payload.cbid];
			}
		} else {
			console.error('worker mainworkerworkerComm - invalid combination');
			throw new Error('worker mainworkerworkerComm - invalid combination');
		}
	}.bind(this);

	self.onmessage = this.listener;
}
// end - CommAPI for bootstrap-worker - worker side - cross-file-link5323131347

gMainWkComm = new workerComm();
