// Imports
const {interfaces: Ci, manager: Cm, results: Cr, utils:Cu} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);

// Globals
var core = {addon: {id:'Screencastify@jetpack'}}; // all that should be needed is core.addon.id, the rest is brought over on init
var gBsComm;
var gWinComm;

const MATCH_APP = 1;

// start - about module
var aboutFactory_screencastify;
function AboutScreencastify() {}

function initAndRegisterAboutScreencastify() {
	// init it
	AboutScreencastify.prototype = Object.freeze({
		classDescription: 'not yet localized', // TODO: localize this
		contractID: '@mozilla.org/network/protocol/about;1?what=screencastify',
		classID: Components.ID('{b95ad6bd-3865-40ac-8f87-f78fb0cb240e}'),
		QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

		getURIFlags: function(aURI) {
			return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT | Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.URI_MUST_LOAD_IN_CHILD;
		},

		newChannel: function(aURI, aSecurity_or_aLoadInfo) {
			var redirUrl = core.addon.path.pages + 'app.xhtml';

			var channel;
			if (Services.vc.compare(core.firefox.version, '47.*') > 0) {
				var redirURI = Services.io.newURI(redirUrl, 'UTF-8', Services.io.newURI('about:screencastify', null, null));
				channel = Services.io.newChannelFromURIWithLoadInfo(redirURI, aSecurity_or_aLoadInfo);
			} else {
				console.log('doing old way');
				channel = Services.io.newChannel(redirUrl, null, null);
			}
			channel.originalURI = aURI;

			return channel;
		}
	});

	// register it
	aboutFactory_screencastify = new AboutFactory(AboutScreencastify);
}

function AboutFactory(component) {
	this.createInstance = function(outer, iid) {
		if (outer) {
			throw Cr.NS_ERROR_NO_AGGREGATION;
		}
		return new component();
	};
	this.register = function() {
		Cm.registerFactory(component.prototype.classID, component.prototype.classDescription, component.prototype.contractID, this);
	};
	this.unregister = function() {
		Cm.unregisterFactory(component.prototype.classID, this);
	}
	Object.freeze(this);
	this.register();
}
// end - about module

// start - pageLoader
var progressListener = {
	register: function() {
		if (!docShell) {
			console.error('NO DOCSHEL!!!');
		} else {
			var webProgress = docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebProgress);
			webProgress.addProgressListener(progressListener.listener, Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);
		}
	},
	unregister: function() {
		if (!docShell) {
			console.error('NO DOCSHEL!!!');
		} else {
			var webProgress = docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebProgress);
			webProgress.removeProgressListener(progressListener.listener);
		}
	},
	listener: {
		onStateChange: function(webProgress, aRequest, flags, status) {
			console.log('progressListener :: onStateChange:', webProgress, aRequest, flags, status);
			// // figure out the flags
			var flagStrs = [];
			for (var f in Ci.nsIWebProgressListener) {
				if (!/a-z/.test(f)) { // if it has any lower case letters its not a flag
					if (flags & Ci.nsIWebProgressListener[f]) {
						flagStrs.push(f);
					}
				}
			}
			console.info('progressListener :: onStateChange, flagStrs:', flagStrs);

			var url;
			try {
				url = aRequest.QueryInterface(Ci.nsIChannel).URI.spec;
			} catch(ignore) {}
			console.error('progressListener :: onStateChange, url:', url);

			if (url) {
				if (url.toLowerCase().startsWith('https://screencastify')) {
					// if (aRequest instanceof Ci.nsIHttpChannel) {
					// 	var aHttpChannel = aRequest.QueryInterface(Ci.nsIHttpChannel);
					// 	console.error('progressListener :: onStateChange, aHttpChannel:', aHttpChannel);
					// 	aHttpChannel.redirectTo(Services.io.newURI('data:text,url_blocked', null, null));
					// } else {
					// 	console.error('not instance of');
					// }
					/*
					08:21:47 	<noit>	Aw crud, its saying NS_ERROR_NOT_AVAILABLE: Component returned failure code: 0x80040111 (NS_ERROR_NOT_AVAILABLE) [nsIChannel.contentType]
					08:21:50 	<noit>	On Qi :(
					08:24:33 	<palant>	nope, on nsIChannel.contentType - meaning that content type hasn't been received yet.
					08:24:45 	<noit>	Ah
					08:25:00 	<noit>	I tried doing aRequest.contentType = 'plain/text'; and then QI'ing nsiHTTP but that didnt work either
					08:25:27 	<noit>	I am catching this in onStatusChange so I'll have to catch later to use redirectTo probably huh
					08:25:33 	<palant>	not everything you get there will be an HTTP channel - do `instanceof Ci.nsIHTTPChannel`
					08:25:47 	<noit>	ah
					08:25:49 	<noit>	Thanks trying now
					08:28:27 	<noit>	Wow this is nuts! So instanceof reports true, but the QI fails with that contentType error so nuts
					08:31:43 	<noit>	I'm gonna try to recreate what redirectTo does. Looking it up
					08:41:44 	<noit>	Crap I dont know what the heck redirectTo is doing but i figured out my too much recursion. I was setting window.location soon after calling aReqest.cancel. I wasn't waiting for the STATE_STOP. So now I wait for STATE_STOP then set window.locaiton :)
					*/
					if (flags & Ci.nsIWebProgressListener.STATE_START) {
						aRequest.cancel(Cr.NS_BINDING_ABORTED);
					} else if (flags & Ci.nsIWebProgressListener.STATE_STOP) {
						var window = webProgress.DOMWindow;
						// console.log('progressListener :: onStateChange, DOMWindow:', window);
						if (window) {
							window.location.href = url.replace(/https\:\/\/screencastify\/?/, 'about:screencastify');
							console.log('progressListener :: onStateChange, ok replaced');
						}
					}
				} else if (url.toLowerCase().startsWith('http://127.0.0.1/screencastify')) {
					if (flags & Ci.nsIWebProgressListener.STATE_START) {
						aRequest.cancel(Cr.NS_BINDING_ABORTED);
					} else if (flags & Ci.nsIWebProgressListener.STATE_STOP) {
						var window = webProgress.DOMWindow;
						// console.log('progressListener :: onStateChange, DOMWindow:', window);
						if (window) {
							var authorized = !url.toLowerCase().includes('error=access_denied');
							window.location.href = 'about:screencastify?' + (authorized ? 'authorized' : 'denied') + '/' + url.toLowerCase().match(/screencastify_([a-z]+)/)[1];
							console.log('progressListener :: onStateChange, ok replaced');
						}
					}
				}
			}
			// var data = {
			// 	requestURL: request.QueryInterface(Ci.nsIChannel).URI.spec,
			// 	windowId: webProgress.DOMWindowID,
			// 	parentWindowId: getParentWindowId(webProgress.DOMWindow),
			// 	status,
			// 	stateFlags,
			// };

			// if (webProgress.DOMWindow.top != webProgress.DOMWindow) {
			// 	// this is a frame element
			// 	var webNav = webProgress.QueryInterface(Ci.nsIWebNavigation);
			// 	if (!webNav.canGoBack) {
			// 		// For some reason we don't fire onLocationChange for the
			// 		// initial navigation of a sub-frame. So we need to simulate
			// 		// it here.
			// 	}
			// }
		},
		onLocationChange: function(webProgress, aRequest, locationURI, flags) {
			console.log('progressListener :: onLocationChange:', arguments);

			// figure out the flags
			var flagStrs = [];
			for (var f in Ci.nsIWebProgressListener) {
				if (!/a-z/.test(f)) { // if it has any lower case letters its not a flag
					if (flags & Ci.nsIWebProgressListener[f]) {
						flagStrs.push(f);
					}
				}
			}
			console.info('progressListener :: onLocationChange, flagStrs:', flagStrs);

			// if (aRequest) {
			// 	aRequest.cancel(Cr.NS_BINDING_ABORTED)
			// }
			// var data = {
			// 	location: locationURI ? locationURI.spec : '',
			// 	windowId: webProgress.DOMWindowID,
			// 	parentWindowId: getParentWindowId(webProgress.DOMWindow),
			// 	flags,
			// };
		},
		onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
			console.log('progressListener :: onStatusChange:', arguments);

			// if (aRequest) {
			// 	aRequest.cancel(Cr.NS_BINDING_ABORTED)
			// }
		},
		onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
			console.log('progressListener :: onProgressChange:', arguments);

			// if (aRequest) {
			// 	aRequest.cancel(Cr.NS_BINDING_ABORTED)
			// }
		},
		onSecurityChange: function(aWebProgress, aRequest, aState) {
			console.log('progressListener :: onSecurityChange:', arguments);

			// if (aRequest) {
			// 	aRequest.cancel(Cr.NS_BINDING_ABORTED)
			// }
		},
		QueryInterface: function QueryInterface(aIID) {
			if (aIID.equals(Ci.nsIWebProgressListener) || aIID.equals(Ci.nsISupportsWeakReference) || aIID.equals(Ci.nsISupports)) {
				return progressListener.listener;
			}

			throw Cr.NS_ERROR_NO_INTERFACE;
		}
	}
};
var pageLoader = {
	// start - devuser editable
	IGNORE_FRAMES: true,
	IGNORE_LOAD: true,
	IGNORE_NONMATCH: true,
	matches: function(aHREF, aLocation) {
		// do your tests on aHREF, which is aLocation.href.toLowerCase(), return true if it matches
		var href_lower = aLocation.href.toLowerCase();
		if (href_lower.startsWith('about:screencastify') || href_lower.startsWith('https://screencastify')) {
			return MATCH_APP;
		}
	},
	ready: function(aContentWindow) {
		// triggered on page ready
		// triggered for each frame if IGNORE_FRAMES is false
		// to test if frame do `if (aContentWindow.frameElement)`

		var contentWindow = aContentWindow;
		console.log('ready enter');

		switch (pageLoader.matches(contentWindow.location.href, contentWindow.location)) {
			case MATCH_APP:
					// about:screencastify app

					// trick firefox into thinking my about page is https and hostname is screencastify by doing pushState
					// doing setCurrentURI does not do the trick. i need to change the webNav.document.documentURI, which is done by pushState
					var webNav = contentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
					var docURI = webNav.document.documentURI;
					console.log('docURI:', docURI);
					if (!webNav.setCurrentURI) {
						console.error('no setCurrentURI!!!!, i should reload the page till i get one');
						return;
					}
					webNav.setCurrentURI(Services.io.newURI('https://screencastify', null, null)); // need to setCurrentURI otherwise the pushState says operation insecure
					contentWindow.history.pushState(null, null, docURI.replace('about:screencastify', 'https://screencastify')); // note: for mediaSource:'screen' it MUST be https://screencastify/SOMETHING_HERE otherwise it wont work
					webNav.setCurrentURI(Services.io.newURI(docURI, null, null)); // make it look like about uri again

					gWinComm = new contentComm(contentWindow); // cross-file-link884757009

					// var principal = contentWindow.document.nodePrincipal; // contentWindow.location.origin (this is undefined for about: pages) // docShell.chromeEventHandler.contentPrincipal (chromeEventHandler no longer has contentPrincipal)
					// console.log('contentWindow.document.nodePrincipal', contentWindow.document.nodePrincipal);
					// console.error('principal:', principal);
					// gSandbox = Cu.Sandbox(principal, {
					// 	sandboxPrototype: contentWindow,
					// 	wantXrays: true, // only set this to false if you need direct access to the page's javascript. true provides a safer, isolated context.
					// 	sameZoneAs: contentWindow,
					// 	wantComponents: false
					// });
					// Services.scriptloader.loadSubScript(core.addon.path.scripts + 'hidden_contentscript.js?' + core.addon.cache_key, gSandbox, 'UTF-8');

					console.log('ready done');

				break;
		}
	},
	load: function(aContentWindow) {}, // triggered on page load if IGNORE_LOAD is false
	error: function(aContentWindow, aDocURI) {
		// triggered when page fails to load due to error
		console.warn('hostname page ready, but an error page loaded, so like offline or something, aHref:', aContentWindow.location.href, 'aDocURI:', aDocURI);
		if (aContentWindow.location.href.startsWith('about:screencastify')) {
			console.warn('it is about:screencastify, so load it again, href:', aContentWindow.location.href);
			aContentWindow.location.href = aContentWindow.location.href;
		}
		//  about:screencastify?recording/new aDocURI: about:neterror?e=malformedURI&u=about%3Ascreencastify%3Frecording/new&c=&f=regular&d=The%20URL%20is%20not%20valid%20and%20cannot%20be%20loaded.
	},
	readyNonmatch: function(aContentWindow) {
		gWinComm = null;
	},
	loadNonmatch: function(aContentWindow) {},
	errorNonmatch: function(aContentWindow, aDocURI) {},
	// not yet supported
	// timeout: function(aContentWindow) {
	// 	// triggered on timeout
	// },
	// timeoutNonmatch: function(aContentWindow) {
	// 	// triggered on timeout
	// },
	// end - devuser editable
	// start - BOILERLATE - DO NOT EDIT
	register: function() {
		// DO NOT EDIT - boilerplate
		addEventListener('DOMContentLoaded', pageLoader.onPageReady, false);
		// addEventListener('DOMWindowCreated', pageLoader.onContentCreated, false);
	},
	unregister: function() {
		// DO NOT EDIT - boilerplate
		removeEventListener('DOMContentLoaded', pageLoader.onPageReady, false);
		// removeEventListener('DOMWindowCreated', pageLoader.onContentCreated, false);
	},
	// onContentCreated: function(e) {
	// 	console.log('onContentCreated - e:', e);
	// 	var contentWindow = e.target.defaultView;
	//
	// 	var readyState = contentWindow.document.readyState;
	// 	console.log('onContentCreated readyState:', readyState, 'url:', contentWindow.location.href, 'location:', contentWindow.location);
	// },
	onPageReady: function(e) {
		// DO NOT EDIT
		// boilerpate triggered on DOMContentLoaded
		// frames are skipped if IGNORE_FRAMES is true

		var contentWindow = e.target.defaultView;
		// console.log('page ready, contentWindow.location.href:', contentWindow.location.href);

		// i can skip frames, as DOMContentLoaded is triggered on frames too
		if (pageLoader.IGNORE_FRAMES && contentWindow.frameElement) { return }

		var href = contentWindow.location.href.toLowerCase();
		if (pageLoader.matches(href, contentWindow.location)) {
			// ok its our intended, lets make sure its not an error page
			var webNav = contentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
			var docURI = webNav.document.documentURI;
			// console.info('docURI:', docURI);

			if (docURI.indexOf('about:neterror') === 0) {
				pageLoader.error(contentWindow, docURI);
			} else {
				// our page ready without error

				if (!pageLoader.IGNORE_LOAD) {
					// i can attach the load listener here, and remove it on trigger of it, because for sure after this point the load will fire
					contentWindow.addEventListener('load', pageLoader.onPageLoad, false);
				}

				pageLoader.ready(contentWindow);
			}
		} else {
			if (!pageLoader.IGNORE_NONMATCH) {
				console.log('page ready, but its not match:', uneval(contentWindow.location));
				var webNav = contentWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
				var docURI = webNav.document.documentURI;
				// console.info('docURI:', docURI);

				if (docURI.indexOf('about:neterror') === 0) {
					pageLoader.errorNonmatch(contentWindow, docURI);
				} else {
					// our page ready without error

					if (!pageLoader.IGNORE_LOAD) {
						// i can attach the load listener here, and remove it on trigger of it, because for sure after this point the load will fire
						contentWindow.addEventListener('load', pageLoader.onPageLoadNonmatch, false);
					}

					pageLoader.readyNonmatch(contentWindow);
				}
			}
		}
	},
	onPageLoad: function(e) {
		// DO NOT EDIT
		// boilerplate triggered on load if IGNORE_LOAD is false
		var contentWindow = e.target.defaultView;
		contentWindow.removeEventListener('load', pageLoader.onPageLoad, false);
		pageLoader.load(contentWindow);
	},
	onPageLoadNonmatch: function(e) {
		// DO NOT EDIT
		// boilerplate triggered on load if IGNORE_LOAD is false
		var contentWindow = e.target.defaultView;
		contentWindow.removeEventListener('load', pageLoader.onPageLoadNonmatch, false);
		pageLoader.loadNonmatch(contentWindow);
	}
	// end - BOILERLATE - DO NOT EDIT
};
// end - pageLoader

function init() {
	gBsComm = new crossprocComm(core.addon.id);

	gBsComm.transcribeMessage('fetchCore', null, function(aCore, aComm) {
		core = aCore;
		console.log('ok updated core to:', core);

		// addEventListener('unload', uninit, false);

		pageLoader.register(); // pageLoader boilerpate
		progressListener.register();

		try {
			initAndRegisterAboutScreencastify();
		} catch(ignore) {} // its non-e10s so it will throw saying already registered

		// var webNav = content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
		// var docURI = webNav.document.documentURI;
		// console.error('testing matches', content.window.location.href, 'docURI:', docURI);
		switch (pageLoader.matches(content.window.location.href.toLowerCase(), content.window.location)) {
			case MATCH_APP:
					// for about pages, need to reload it, as it it loaded before i registered it
					content.window.location.href = content.window.location.href.replace(/https\:\/\/screencastify\/?/, 'about:screencastify'); // cannot use .reload() as the webNav.document.documentURI is now https://screencastify/
				break;
			// case MATCH_TWITTER:
			// 		// for non-about pages, i dont reload, i just initiate the ready of pageLoader
			// 		if (content.document.readyState == 'interactive' || content.document.readyState == 'complete') {
			// 			pageLoader.onPageReady({target:content.document}); // IGNORE_LOAD is true, so no need to worry about triggering load
			// 		}
			// 	break;
		}
	});
}

function uninit() { // link4757484773732
	// an issue with this unload is that framescripts are left over, i want to destory them eventually

	removeEventListener('unload', uninit, false);

	if (gWinComm) {
		gWinComm.putMessage('uninit');
	}

	crossprocComm_unregAll();

	pageLoader.unregister(); // pageLoader boilerpate
	progressListener.unregister();

	if (aboutFactory_screencastify) {
		aboutFactory_screencastify.unregister();
	}

}
// testing commapi
function testCallFramescriptFromContent(aArg, aMessageManager, aBrowser, aComm, aReportProgress) {
	// called by framescript
	console.error('in framescript, aArg:', aArg);
}
function testCallFramescriptFromContent_transfer(aArg, aMessageManager, aBrowser, aComm, aReportProgress) {
	// called by framescript
	console.error('in framescript, aArg:', aArg);
}
function testCallFramescriptFromContent_justcb(aArg, aMessageManager, aBrowser, aComm, aReportProgress) {
	// called by framescript
	console.error('in framescript, aArg:', aArg);
	return 2;
}
function testCallFramescriptFromContent_justcb_thattransfers(aArg, aComm, aReportProgress) {
	// called by framescript
	console.error('in framescript, aArg:', aArg);
	var send = {
		num: 2,
		buf: new ArrayBuffer(20),
		__XFER: ['buf']
	};
	content.setTimeout(function() {
		console.log('send.buf:', send.buf);
	});
	return send;
}
function testCallFramescriptFromContent_cbAndFullXfer(aArg, aReportProgress, aComm) {
	console.error('in framescript, aArg:', aArg);
	var argP = {start:2, bufP:new ArrayBuffer(20), __XFER:['bufP']};
	aReportProgress(argP);
	console.log('argP.bufP:', argP.bufP);
	var argF = {end:2, bufF:new ArrayBuffer(20), __XFER:['bufF']};
	var deferred = new Deferred();
	content.setTimeout(function() {
		deferred.resolve(argF);
		console.log('argF.bufF:', argF.bufF);
	}, 2000);
	return deferred.promise;
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
// start - CommAPI
// common to all of these apis
	// whenever you use the message method, the method MUST not be a number, as if it is, then it is assumed it is a callback
	// if you want to do a transfer of data from a callback, if transferring is supported by the api, then you must arg must be an object and you must include the key __XFER

var gCFMM = this;

// start - CommAPI for bootstrap-framescript - bootstrap side - cross-file-link55565665464644
// message method - transcribeMessage - it is meant to indicate nothing can be transferred, just copied/transcribed to the other process
// first arg to transcribeMessage is a message manager, this is different from the other comm api's
var gCrossprocComms = [];
function crossprocComm_unregAll() {
	var l = gCrossprocComms.length;
	for (var i=0; i<l; i++) {
		gCrossprocComms[i].unregister();
	}
}
function crossprocComm(aChannelId) {
	// when a new framescript creates a crossprocComm on framscript side, it requests whatever it needs on init, so i dont offer a onBeforeInit or onAfterInit on bootstrap side

	var scope = gCommScope;
	this.nextcbid = 1; // next callback id // doesnt have to be defined on this. but i do it so i can check nextcbid from debug sources
	this.callbackReceptacle = {};
	this.reportProgress = function(aProgressArg) {
		// aProgressArg MUST be an object, devuser can set __PROGRESS:1 but doesnt have to, because i'll set it here if its not there
		// this gets passed as thrid argument to each method that is called in the scope
		// devuser MUST NEVER bind reportProgress. as it is bound to {THIS:this, cbid:cbid}
		// devuser must set up the aCallback they pass to initial putMessage to handle being called with an object with key __PROGRESS:1 so they know its not the final reply to callback, but an intermediate progress update
		aProgressArg.__PROGRESS = 1;
		this.THIS.transcribeMessage(this.cbid, aProgressArg);
	};

	gCrossprocComms.push(this);

	this.unregister = function() {
		removeMessageListener(aChannelId, this.listener);

		var l = gCrossprocComms.length;
		for (var i=0; i<l; i++) {
			if (gCrossprocComms[i] == this) {
				gCrossprocComms.splice(i, 1);
				break;
			}
		}
	};

	this.listener = {
		receiveMessage: function(e) {
			var messageManager = e.target.messageManager;
			var browser = e.target;
			var payload = e.data;
			console.log('framescript crossprocComm - incoming, payload:', payload); //, 'e:', e);
			// console.log('this in receiveMessage bootstrap:', this);

			if (payload.method) {
				if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') }  // dev line remove on prod
				var rez_fs_call__for_bs = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
				// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
				if (payload.cbid) {
					if (rez_fs_call__for_bs && rez_fs_call__for_bs.constructor.name == 'Promise') {
						rez_fs_call__for_bs.then(
							function(aVal) {
								console.log('Fullfilled - rez_fs_call__for_bs - ', aVal);
								this.transcribeMessage(payload.cbid, aVal);
							}.bind(this),
							genericReject.bind(null, 'rez_fs_call__for_bs', 0)
						).catch(genericCatch.bind(null, 'rez_fs_call__for_bs', 0));
					} else {
						console.log('calling transcribeMessage for callbck with args:', payload.cbid, rez_fs_call__for_bs);
						this.transcribeMessage(payload.cbid, rez_fs_call__for_bs);
					}
				}
			} else if (!payload.method && payload.cbid) {
				// its a cbid
				this.callbackReceptacle[payload.cbid](payload.arg, messageManager, browser, this);
				if (payload.arg && !payload.arg.__PROGRESS) {
					delete this.callbackReceptacle[payload.cbid];
				}
			} else {
				console.error('framesript - crossprocComm - invalid combination, payload:', payload);
				throw new Error('framesript - crossprocComm - invalid combination');
			}
		}.bind(this)
	};

	this.transcribeMessage = function(aMethod, aArg, aCallback) { // framescript version doesnt have messageManager arg
		// console.log('bootstrap sending message to framescript', aMethod, aArg);
		// aMethod is a string - the method to call in framescript
		// aCallback is a function - optional - it will be triggered when aMethod is done calling

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

		gCFMM.sendAsyncMessage(aChannelId, {
			method: aMethod,
			arg: aArg,
			cbid
		});
	};

	addMessageListener(aChannelId, this.listener);
}
// end - CommAPI for bootstrap-framescript - bootstrap side - cross-file-link55565665464644
// start - CommAPI for framescript-content - bootstrap side - cross-file-link0048958576532536411
// message method - putMessage - content is in-process-content-windows, transferring works
// there is a bootstrap version of this that requires a feed of the ports.
function contentComm(aContentWindow, onHandshakeComplete) { // framescript version doesnt have aPort1/aPort2 args, it generates its own with a WebWorker
	// onHandshakeComplete is triggered when handshake is complete
	// when a new contentWindow creates a contentComm on contentWindow side, it requests whatever it needs on init, so i dont offer a onBeforeInit. I do offer a onHandshakeComplete which is similar to onAfterInit, but not exactly the same
	// no unregister for this really, as no listeners setup, to unregister you just need to GC everything, so just break all references to it

	var portWorker = new Worker(core.addon.path.scripts + 'contentComm_framescriptWorker.js');

	var aPort1;
	var aPort2;
	var handshakeComplete = false; // indicates this.putMessage will now work i think. it might work even before though as the messages might be saved till a listener is setup? i dont know i should ask
	var scope = gCommScope;

	this.nextcbid = 1; // next callback id // doesnt have to be defined on this. but i do it so i can check nextcbid from debug sources
	this.callbackReceptacle = {};
	this.reportProgress = function(aProgressArg) {
		// aProgressArg MUST be an object, devuser can set __PROGRESS:1 but doesnt have to, because i'll set it here if its not there
		// this gets passed as thrid argument to each method that is called in the scope
		// devuser MUST NEVER bind reportProgress. as it is bound to {THIS:this, cbid:cbid}
		// devuser must set up the aCallback they pass to initial putMessage to handle being called with an object with key __PROGRESS:1 so they know its not the final reply to callback, but an intermediate progress update
		aProgressArg.__PROGRESS = 1;
		this.THIS.putMessage(this.cbid, aProgressArg);
	};

	this.listener = function(e) {
		var payload = e.data;
		console.log('framescript contentComm - incoming, payload:', payload); //, 'e:', e);

		if (payload.method) {
			if (payload.method == 'contentComm_handshake_finalized') {
				handshakeComplete = false;
				if (onHandshakeComplete) {
					onHandshakeComplete(this);
				}
				return;
			}
			if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') } // dev line remove on prod
			var rez_fs_call__for_win = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
			// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
			console.log('rez_fs_call__for_win:', rez_fs_call__for_win);
			if (payload.cbid) {
				if (rez_fs_call__for_win && rez_fs_call__for_win.constructor.name == 'Promise') {
					rez_fs_call__for_win.then(
						function(aVal) {
							console.log('Fullfilled - rez_fs_call__for_win - ', aVal);
							this.putMessage(payload.cbid, aVal);
						}.bind(this),
						genericReject.bind(null, 'rez_fs_call__for_win', 0)
					).catch(genericCatch.bind(null, 'rez_fs_call__for_win', 0));
				} else {
					console.log('calling putMessage for callback with rez_fs_call__for_win:', rez_fs_call__for_win, 'this:', this);
					this.putMessage(payload.cbid, rez_fs_call__for_win);
				}
			}
		} else if (!payload.method && payload.cbid) {
			// its a cbid
			this.callbackReceptacle[payload.cbid](payload.arg, this);
			if (payload.arg && !payload.arg.__PROGRESS) {
				delete this.callbackReceptacle[payload.cbid];
			}
		} else {
			throw new Error('invalid combination');
		}
	}.bind(this);



	this.putMessage = function(aMethod, aArg, aCallback) {

		// aMethod is a string - the method to call in framescript
		// aCallback is a function - optional - it will be triggered when aMethod is done calling
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

		// return;
		aPort1.postMessage({
			method: aMethod,
			arg: aArg,
			cbid
		}, aTransfers);
	}


	portWorker.onmessage = function(e) {
		portWorker.terminate();
		aPort1 = e.data.port1;
		aPort2 = e.data.port2;

		aPort1.onmessage = this.listener;

		aContentWindow.postMessage({
			topic: 'contentComm_handshake',
			port2: aPort2
		}, '*', [aPort2]);
	}.bind(this);

}
// end - CommAPI for framescript-content - framescript side - cross-file-link0048958576532536411
// CommAPI Abstraction - framescript side
function callInContent(aMethod, aArg, aCallback) {
	if (aMethod.constructor.name == 'Object') {
		// called by bootstrap
		var aReportProgress = aArg;
		var aComm = aCallback;
		var {m:aMethod, a:aArg} = aMethod;
		if (aReportProgress) { // if (wait) { // if it has aReportProgress then the scope has a callback waiting for reply
			var deferred = new Deferred();
			gWinComm.putMessage(aMethod, aArg, function(rez) {
				if (rez && rez.__PROGRESS) {
					aReportProgress(rez);
				} else {
					deferred.resolve(rez);
				}
			});
			return deferred.promise;
		} else {
			gWinComm.putMessage(aMethod, aArg);
		}
	} else {
		gWinComm.putMessage(aMethod, aArg, aCallback);
	}
}
function callInBootstrap(aMethod, aArg, aCallback) {
	if (aMethod.constructor.name == 'Object') {
		// called by content
		var aReportProgress = aArg;
		var aComm = aCallback;
		var {m:aMethod, a:aArg} = aMethod;
		if (aReportProgress) { // if (wait) { // if it has aReportProgress then the scope has a callback waiting for reply
			var deferred = new Deferred();
			gBsComm.transcribeMessage(aMethod, aArg, function(rez) {
				if (rez && rez.__PROGRESS) {
					aReportProgress(rez);
				} else {
					deferred.resolve(rez);
				}
			});
			return deferred.promise;
		} else {
			gBsComm.transcribeMessage(aMethod, aArg);
		}
	} else {
		gBsComm.transcribeMessage(aMethod, aArg, aCallback);
	}
}
function callInWorker(aMethod, aArg, aCallback) {
	if (aMethod.constructor.name == 'Object') {
		// content called this
		var aReportProgress = aArg;
		var aComm = aCallback;
		var {m:aMethod, a:aArg} = aMethod;
		if (aReportProgress) { // if (wait) { // if it has aReportProgress then the scope has a callback waiting for reply
			var deferred = new Deferred();
			gBsComm.transcribeMessage('callInWorker', {
				m: aMethod,
				a: aArg
			}, function(rez) {
				if (rez && rez.__PROGRESS) {
					aReportProgress(rez);
				} else {
					deferred.resolve(rez);
				}
			});
			return deferred.promise;
		} else {
			gBsComm.transcribeMessage('callInWorker', {
				m: aMethod,
				a: aArg
			});
		}
	} else {
		gBsComm.transcribeMessage('callInWorker', {
			m: aMethod,
			a: aArg
		}, aCallback);
	}
}
// because in framescripts `this` is not global scope i have to do this:
var gCommScope = {
	// apart of CommAPI
	UNINIT_FRAMESCRIPT: function() { // link4757484773732
		// called by bootstrap - but i guess content can call it too, but i dont see it ever wanting to
		console.error('doing UNINIT_FRAMESCRIPT');
		uninit();
	},
	callInBootstrap,
	callInContent,
	callInWorker,
	// end - apart of CommAPI
	// start - devuser defined functions
	testCallFramescriptFromContent,
	testCallFramescriptFromContent_transfer,
	testCallFramescriptFromContent_justcb,
	testCallFramescriptFromContent_justcb_thattransfers,
	testCallFramescriptFromContent_cbAndFullXfer
	// functions called by bootstrap
	// ...
	// functions called by content
	// ...
	// end - devuser defined functions
};
// end - CommAPI

// end - common helper functions

init(); // needs to go after the CommApi stuff, as otherwise i get gCrossprocComms is undefined
