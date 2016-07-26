// Imports
var {interfaces: Ci, manager: Cm, results: Cr, utils:Cu} = Components;
Cm.QueryInterface(Ci.nsIComponentRegistrar);
Cu.importGlobalProperties(['Blob', 'URL']);
var { callInBootstrap, callInMainworker, callInContent } = CommHelper.framescript;

// Globals
var core;
var gBsComm;
var gWinComm;
var gAppAboutFactory;
var MATCH_APP = 1;

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
				var url_lower = url.toLowerCase();
				var window = webProgress.DOMWindow;
				// console.log('progressListener :: onStateChange, DOMWindow:', window);

				if (url_lower.startsWith('https://screencastify')) {
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
						// console.log('progressListener :: onStateChange, DOMWindow:', window);
						if (window) {
							window.location.href = url.replace(/https\:\/\/screencastify\/?/, 'about:screencastify');
							console.log('progressListener :: onStateChange, ok replaced');
						}
					}
				} else if (url_lower.startsWith('http://127.0.0.1/screencastify')) {
					if (flags & Ci.nsIWebProgressListener.STATE_START) {
						aRequest.cancel(Cr.NS_BINDING_ABORTED);
					} else if (flags & Ci.nsIWebProgressListener.STATE_STOP) {
						if (window) {
							var access_denied = url_lower.includes('error=access_denied') || url_lower.includes('denied='); // `denied=` is for twitter, `error=access_denied` is for everything else
							var authorized = !access_denied;
							var serviceid = url_lower.match(/screencastify_([a-z]+)/)[1];
							if (authorized) {
								callInMainworker('oauthAuthorized', {
									serviceid,
									href: url
								})
							}
							window.location.href = 'about:screencastify?auth/' + serviceid + '/' + (authorized ? 'approved' : 'denied');
							console.log('progressListener :: onStateChange, ok replaced');
						}
					}
				} else if (url_lower == 'https://api.twitter.com/oauth/authorize' && (flags & Ci.nsIWebProgressListener.STATE_STOP) && window && window.document.documentElement.innerHTML.includes('screencastify_twitter?denied=')) {
					// console.log('twitter auth innerHTML:', window.document.body.innerHTML);
					window.location.href = 'about:screencastify?auth/twitter/denied';
				}
			}
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

		var href_lower = contentWindow.location.href.toLowerCase();
		switch (pageLoader.matches(contentWindow.location.href, contentWindow.location)) {
			case MATCH_APP:
					// about:screencastify app

					if (href_lower.includes('recording/new')) {
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
						contentWindow.history.pushState(null, null, docURI.replace(/about\:screencastify/i, 'https://screencastify')); // note: for mediaSource:'screen' it MUST be https://screencastify/SOMETHING_HERE otherwise it wont work
						webNav.setCurrentURI(Services.io.newURI(docURI, null, null)); // make it look like about uri again
					}

					gWinComm = new Comm.server.content(contentWindow); // cross-file-link884757009

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
	gBsComm = new Comm.client.framescript('Screencastify@jetpack');

	callInBootstrap('fetchCore', null, function(aArg, aComm) {
		core = aArg.core;
		console.log('ok updated core to:', core);

		addEventListener('unload', shutdown, true);

		try {
			gAppAboutFactory = registerAbout('screencastify', formatStringFromNameCore('about_desc', 'main'), '{b95ad6bd-3865-40ac-8f87-f78fb0cb240e}', aURI=>core.addon.path.pages + 'app.xhtml');
		} catch(ignore) {} // its non-e10s so it will throw saying already registered

		pageLoader.register(); // pageLoader boilerpate
		progressListener.register();

		// var webNav = content.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation);
		// var docURI = webNav.document.documentURI;
		// console.error('testing matches', content.window.location.href, 'docURI:', docURI);
		var href_lower = content.window.location.href.toLowerCase();
		switch (pageLoader.matches(href_lower, content.window.location)) {
			case MATCH_APP:
					// for about pages, need to reload it, as it it loaded before i registered it
					content.window.location.reload(); //href = content.window.location.href.replace(/https\:\/\/screencastify\/?/i, 'about:screencastify'); // cannot use .reload() as the webNav.document.documentURI is now https://screencastify/
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

var gMM = this;
function shutdown(e) {
	if (e.target == gMM) {
		// ok this content frame message manager is shutting down
		uninit();
	}
}

function uninit() { // link4757484773732
	// an issue with this unload is that framescripts are left over, i want to destory them eventually

	console.error('DOING UNINIT');

	pageLoader.unregister(); // pageLoader boilerpate
	progressListener.unregister();

	if (gWinComm) {
		callInContent('uninit');
	}

	Comm.server.unregAll('content');
	Comm.client.unregAll('framescript');

	if (gAppAboutFactory) {
		gAppAboutFactory.unregister();
	}

	removeEventListener('unload', shutdown, false);
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
// start - about module
function AboutPage() {}

function registerAbout(aWhat, aDesc, aUuid, aRedirectorizer) {
	console.log('in registerAbout');
	AboutPage.prototype = Object.freeze({
		classDescription: aDesc,
		contractID: '@mozilla.org/network/protocol/about;1?what=' + aWhat,
		classID: Components.ID(aUuid),
		QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

		getURIFlags: function(aURI) {
			return Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT | Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.URI_MUST_LOAD_IN_CHILD;
		},

		newChannel: function(aURI, aSecurity_or_aLoadInfo) {
			var redirUrl = aRedirectorizer(aURI)

			var channel;
			if (Services.vc.compare(Services.appinfo.version, '47.*') > 0) {
				var redirURI = Services.io.newURI(redirUrl, 'UTF-8', Services.io.newURI('about:' + aWhat, null, null));
				channel = Services.io.newChannelFromURIWithLoadInfo(redirURI, aSecurity_or_aLoadInfo);
			} else {
				console.log('doing old way');
				channel = Services.io.newChannel(redirUrl, null, null);
			}
			channel.originalURI = aURI;

			return channel;
		}
	});

	console.log('about to return registerAbout');
	// register it
	return new AboutFactory(AboutPage);
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
	console.log('registered about');
}
// end - about module
// end - common helper functions

// startup
init();
