// Imports
const {interfaces: Ci, utils: Cu, classes:Cc} = Components;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/CustomizableUI.jsm');

const COMMONJS_URI = 'resource://gre/modules/commonjs';
const { require } = Cu.import(COMMONJS_URI + '/toolkit/require.js', {});
var CLIPBOARD = require('sdk/clipboard');

// Globals
var core = {
	addon: {
		name: 'Screencastify',
		id: 'Screencastify@jetpack',
		path: {
			name: 'screencastify',
			//
			content: 'chrome://screencastify/content/',
			locale: 'chrome://screencastify/locale/',
			//
			modules: 'chrome://screencastify/content/modules/',
			workers: 'chrome://screencastify/content/modules/workers/',
			//
			resources: 'chrome://screencastify/content/resources/',
			images: 'chrome://screencastify/content/resources/images/',
			scripts: 'chrome://screencastify/content/resources/scripts/',
			styles: 'chrome://screencastify/content/resources/styles/',
			fonts: 'chrome://screencastify/content/resources/styles/fonts/',
			pages: 'chrome://screencastify/content/resources/pages/'
			// below are added by worker
			// storage: OS.Path.join(OS.Constants.Path.profileDir, 'jetpack', core.addon.id, 'simple-storage')
		},
		pref_branch: 'extensions.Screencastify@jetpack.',
		cache_key: Math.random() // set to version on release
	},
	os: {
		// // name: added by worker
		// // mname: added by worker
		toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version
		// channel: Services.prefs.getCharPref('app.update.channel')
	}
};

var gFsComm;
var gWkComm;

var gCuiCssUri;
var gGenCssUri;

function install() {}

function uninstall(aData, aReason) {
	if (aReason == ADDON_UNINSTALL) {}
}

function startup(aData, aReason) {

	gWkComm = new workerComm(core.addon.path.scripts + 'MainWorker.js', ()=>{return core}, function(aArg, aComm) {

		core = aArg;

		gFsComm = new crossprocComm(core.addon.id);

		Services.mm.loadFrameScript(core.addon.path.scripts + 'MainFramescript.js?' + core.addon.cache_key, true);

		// initInstallListener();

		// determine gCuiCssFilename for windowListener.register
		gCuiCssUri = Services.io.newURI(core.addon.path.styles + 'cui.css', null, null);
		gGenCssUri = Services.io.newURI(core.addon.path.styles + 'chrome.css', null, null);

		// window listener
		windowListener.register();

		// insert cui
		CustomizableUI.createWidget({
			id: 'cui_screencastify',
			defaultArea: CustomizableUI.AREA_NAVBAR,
			label: 'Record Screen', // TODO: l10n
			tooltiptext: 'extra info goes here for tooltip', // TODO: l10n
			onCommand: cuiClick
		});

	});

	gWkComm.putMessage('dummyForInstantInstantiate');

}

function shutdown(aData, aReason) {

	if (aReason == APP_SHUTDOWN) { return }

	CustomizableUI.destroyWidget('cui_screencastify');

	windowListener.unregister();

	Services.mm.removeDelayedFrameScript(core.addon.path.scripts + 'MainFramescript.js?' + core.addon.cache_key);

	crossprocComm_unregAll();

	workerComm_unregAll();
}

var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {

		// Load into any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		/*
		for (var u in unloaders) {
			unloaders[u]();
		}
		*/
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			console.log('gCuiCssUri:', gCuiCssUri);
			domWinUtils.loadSheet(gCuiCssUri, domWinUtils.AUTHOR_SHEET);
			domWinUtils.loadSheet(gGenCssUri, domWinUtils.AUTHOR_SHEET);
		}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.removeSheet(gCuiCssUri, domWinUtils.AUTHOR_SHEET);
			domWinUtils.removeSheet(gGenCssUri, domWinUtils.AUTHOR_SHEET);
		}
	}
};

// functions

var gRecord;

function cuiClick(e) {
	var gBrowser = Services.wm.getMostRecentWindow('navigator:browser').gBrowser;
	if (gBrowser.selectedBrowser.currentURI.spec == 'about:screencastify?recording/new') {
		gBrowser.selectedBrowser.loadURI('about:screencastify?recording/new'); // reload the page
	} else {
		gBrowser.loadOneTab('about:screencastify?recording/new', { inBackground:false });
	}
	// if (gRecord) {
	// 	globalRecordStop();
	// } else {
	// 	gWkComm.putMessage('globalRecordNew');
	// }
}

function quickSaveDirDefaultValue() {
	// videos/movies folder - on error gives desktopDir
	try {
		return Services.dirsvc.get('XDGVids', Ci.nsIFile).path; // works on linux
	} catch (ex) {
		try {
			return Services.dirsvc.get('Vids', Ci.nsIFile).path; // works on windows
		} catch (ex) {
			try {
				return Services.dirsvc.get('Mov', Ci.nsIFile).path; // works on mac
			} catch (ex) {
				return OS.Constants.Path.desktopDir;
			}
		}
	}
}

var gFHR = []; // holds all currently alive FHR instances. keeps track of FHR's so it destroys them on shutdown. if devuser did not handle destroying it
var gFHR_id = 0;
function FHR() {
	// my FrameHttpRequest module which loads pages into frames, and navigates by clicks
	// my play on XHR

	// must instatiate with loadPageArgs

	gFHR_id++;

	var fhrThis = this;
	this.id = gFHR_id;
	gFHR.push(this);

	var fhrFsMsgListenerId = core.addon.id + '-fhr_' + gFHR_id;

	// start - rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5
	// var fhrFsFuncs = { // can use whatever, but by default its setup to use this
	// 	FHRFrameScriptReady: function() {
	// 		console.log('mainthread', 'FHRFrameScriptReady');
	// 		fhrThis.inited = true;
	// 		if (fhrPostInitCb) {
	// 			fhrPostInitCb();
	// 		}
	// 	}
	// };
	// var fhrFsMsgListener = {
	// 	funcScope: fhrFsFuncs,
	// 	receiveMessage: function(aMsgEvent) {
	// 		var aMsgEventData = aMsgEvent.data;
	// 		console.log('fhrFsMsgListener getting aMsgEventData:', aMsgEventData, 'aMsgEvent:', aMsgEvent);
	// 		// aMsgEvent.data should be an array, with first item being the unfction name in bootstrapCallbacks
	//
	// 		var callbackPendingId;
	// 		if (typeof aMsgEventData[aMsgEventData.length-1] == 'string' && aMsgEventData[aMsgEventData.length-1].indexOf(SAM_CB_PREFIX) == 0) {
	// 			callbackPendingId = aMsgEventData.pop();
	// 		}
	//
	// 		aMsgEventData.push(aMsgEvent); // this is special for server side, so the function can do aMsgEvent.target.messageManager to send a response
	//
	// 		var funcName = aMsgEventData.shift();
	// 		if (funcName in this.funcScope) {
	// 			var rez_parentscript_call = this.funcScope[funcName].apply(null, aMsgEventData);
	//
	// 			if (callbackPendingId) {
	// 				// rez_parentscript_call must be an array or promise that resolves with an array
	// 				if (rez_parentscript_call.constructor.name == 'Promise') {
	// 					rez_parentscript_call.then(
	// 						function(aVal) {
	// 							// aVal must be an array
	// 							aMsgEvent.target.messageManager.sendAsyncMessage(fhrFsMsgListenerId, [callbackPendingId, aVal]);
	// 						},
	// 						function(aReason) {
	// 							console.error('aReject:', aReason);
	// 							aMsgEvent.target.messageManager.sendAsyncMessage(fhrFsMsgListenerId, [callbackPendingId, ['promise_rejected', aReason]]);
	// 						}
	// 					).catch(
	// 						function(aCatch) {
	// 							console.error('aCatch:', aCatch);
	// 							aMsgEvent.target.messageManager.sendAsyncMessage(fhrFsMsgListenerId, [callbackPendingId, ['promise_rejected', aCatch]]);
	// 						}
	// 					);
	// 				} else {
	// 					// assume array
	// 					aMsgEvent.target.messageManager.sendAsyncMessage(fhrFsMsgListenerId, [callbackPendingId, rez_parentscript_call]);
	// 				}
	// 			}
	// 		}
	// 		else { console.warn('funcName', funcName, 'not in scope of this.funcScope') } // else is intentionally on same line with console. so on finde replace all console. lines on release it will take this out
	//
	// 	}
	// };

	// Services.mm.addMessageListener(fhrFsMsgListenerId, fhrFsMsgListener);

	// no need to redefine - sendAsyncMessageWithCallback, i can use the globally defined sendAsyncMessageWithCallback fine with this
	// end - rev3 - https://gist.github.com/Noitidart/03c84a4fc1e566bd0fe5


	var aWindow = Services.wm.getMostRecentWindow('navigator:browser');
	var aDocument = aWindow.document;
	var fhrPostInitCb;

	var doAfterAppShellDomWinReady = function() {

			this.frame = aDocument.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'browser');

			// this.frame.setAttribute('class', core.addon.id + '_fhr-');
			// if (OS.Constants.Sys.Name.toLowerCase() != 'darwin') {
				this.frame.setAttribute('remote', 'true');
			// }
			this.frame.setAttribute('type', 'content');
			this.frame.setAttribute('style', 'height:100px;border:2px solid steelblue;');
			// this.frame.setAttribute('style', 'height:0;border:0;');

			aDocument.documentElement.appendChild(this.frame);
			// this.frame.messageManager.loadFrameScript(core.addon.path.scripts + 'FHRFrameScript.js?fhrFsMsgListenerId=' + fhrFsMsgListenerId + '&v=' + core.addon.cache_key, false);
			this.frame.setAttribute('src', core.addon.path.pages + 'hidden.html');

			this.destroy = function() {

				this.frame.messageManager.sendAsyncMessage(fhrFsMsgListenerId, ['destroySelf']); // not really needed as i remove the element

				// Services.mm.removeMessageListener(fhrFsMsgListenerId, fhrFsMsgListener);
				aDocument.documentElement.removeChild(this.frame);

				// delete this.frame; // release reference to it
				// delete this.loadPage;
				// delete this.destroy;

				for (var i=0; i<gFHR.length; i++) {
					if (gFHR[i].id == this.id) {
						gFHR.splice(i, 1);
						break;
					}
				}

				// this.destroyed = true;
				console.log('ok destroyed FHR instance with id:', this.id);
			}.bind(this);

	}.bind(this);

	if (aDocument.readyState == 'complete') {
		doAfterAppShellDomWinReady();
	} else {
		aWindow.addEventListener('load', function() {
			aWindow.removeEventListener('load', arguments.callee, false);
			doAfterAppShellDomWinReady();
		}, false);
	}

}

// start - functions called by bootstrap - that talk to worker

// end - functions called by bootstrap - that talk to worker

// start - functions called by framescript
function fetchCore(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	return core;
}
function closeSelfTab(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	var window = aBrowser.ownerDocument.defaultView;
	var tabs = window.gBrowser.tabContainer.childNodes;
	for (var tab of tabs) {
		if (tab.linkedBrowser == aBrowser) {
			window.gBrowser.removeTab(tab);
			break;
		}
	}

	var tabs = window.gBrowser.tabContainer.childNodes;
	for (var tab of tabs) {
		if (tab.linkedBrowser.currentURI.spec.includes('screencastify?recording/new')) {
			window.gBrowser.selectedTab = tab;
			break;
		}
	}
}
function copyText(aText) {
	CLIPBOARD.set(aText, 'text');
}
function launchUrl(aURL) {
	var window = Services.wm.getMostRecentWindow('navigator:browser');
	window.gBrowser.loadOneTab(aURL, { inBackground:false });
}
// end - functions called by framescript

// start - functions called by worker
function loadOneTab(aArg, aReportProgress, aComm) {
	var window = Services.wm.getMostRecentWindow('navigator:browser');
	window.gBrowser.loadOneTab(aArg.URL, aArg.params);

	/* example usage
	callInBootstrap('loadOneTab', {
		URL: 'https://www.facebook.com',
		params: {
			inBackground: false
		}
	});
	*/
}
function launchOrFocusOrReuseTab(aArg, aReportProgress, aComm) {
	var { url, reuse_criteria } = aArg;

	// search all tabs for url, if found then focus that tab
	var focused = false;
	var windows = Services.wm.getEnumerator('navigator:browser');
	while (windows.hasMoreElements()) {
		var window = windows.getNext();
		var tabs = window.gBrowser.tabContainer.childNodes;
		for (var tab of tabs) {
			var browser = tab.linkedBrowser;
			if (browser.currentURI.spec.toLowerCase() == url.toLowerCase()) {
				window.focus();
				window.gBrowser.selectedTab = tab;
				focused = true;
				return;
			}
		}
	}

	// if not found then search all tabs for reuse_criteria, on first find, use that tab and load this url (if its not already this url)
	var reused = false;
	if (!focused && reuse_criteria) {
		var windows = Services.wm.getEnumerator('navigator:browser');
		while (windows.hasMoreElements()) {
			var window = windows.getNext();
			var tabs = window.gBrowser.tabContainer.childNodes;
			for (var tab of tabs) {
				var browser = tab.linkedBrowser;
				for (var i=0; i<reuse_criteria.length; i++) {
					if (browser.currentURI.spec.toLowerCase().includes(reuse_criteria[i].toLowerCase())) {
						window.focus();
						window.gBrowser.selectedTab = tab;
						if (browser.currentURI.spec.toLowerCase() != url.toLowerCase()) {
							browser.loadURI(url);
						}
						reused = true;
						return;
					}
				}
			}
		}
	}

	// if nothing found for reuse then launch url in foreground of most recent browser
	if (!reused) {
		var window = Services.wm.getMostRecentWindow('navigator:browser');
		window.gBrowser.loadOneTab(url, { inBackground:false, relatedToCurrent:true });
	}

}
// end - functions called by worker

// testing commapi
function testCallBootstrapFromContent(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	// called by framescript
	// aReportProgress is undefined as there is no callback in content for this test
	console.error('in bootstrap, aArg:', aArg);
}
function testCallBootstrapFromContent_transfer(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	// called by framescript
	// aReportProgress is undefined as there is no callback in content for this test
	console.error('in bootstrap, aArg:', aArg);
}
function testCallBootstrapFromContent_justcb(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	// called by framescript
	console.error('in bootstrap, aArg:', aArg);
	return 1;
}
function testCallBootstrapFromContent_justcb_thattransfers(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	// called by framescript
	console.error('in bootstrap, aArg:', aArg);
	var send = {
		num: 1,
		buf: new ArrayBuffer(20),
		__XFER: ['buf']
	};
	return send;
}
function testCallBootstrapFromContent_cbAndFullXfer(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	console.error('in bootstrap, aArg:', aArg);
	var argP = {start:1, bufP:new ArrayBuffer(10), __XFER:['bufP']};
	aReportProgress(argP);
	console.log('argP.bufP:', argP.bufP);
	var argF = {end:1, bufF:new ArrayBuffer(10), __XFER:['bufF']};
	var deferred = new Deferred();
	deferred.resolve(argF);
	return deferred.promise;
}

//start - common helper functions
// rev3 - not yet comitted to gist - reports back filter ext picked
// rev2 - not yet commited to gist.github
function browseFile(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	// called by worker, or by framescript in which case it has aMessageManager and aBrowser as final params
	var { aDialogTitle, aOptions } = aArg
	if (!aOptions) { aOptions={} }

	// uses xpcom file browser and returns path to file selected
	// returns
		// filename
		// if aOptions.returnDetails is true, then it returns object with fields:
		//	{
		//		filepath: string,
		//		replace: bool, // only set if mode is modeSave
		//	}

	var cOptionsDefaults = {
		mode: 'modeOpen', // modeSave, modeGetFolder,
		filters: undefined, // else an array. in sets of two. so one filter would be ['PNG', '*.png'] or two filters woul be ['PNG', '*.png', 'All Files', '*']
		startDirPlatPath: undefined, // string - platform path to dir the dialog should start in
		returnDetails: false,
		async: false, // if set to true, then it wont block main thread while its open, and it will also return a promise
		win: undefined, // null for no parentWin, string for what you want passed to getMostRecentWindow, or a window object. NEGATIVE is special for NativeShot, it is negative iMon
		defaultString: undefined
	}

	validateOptionsObj(aOptions, cOptionsDefaults);

	var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);

	var parentWin;
	if (aOptions.win === undefined) {
		parentWin = null;
	} else if (typeof(aOptions.win) == 'number') {
		// sepcial for nativeshot
		parentWin = colMon[Math.abs(aOptions.win)].E.DOMWindow;
	} else if (aOptions.win === null || typeof(aOptions.win) == 'string') {
		parentWin = Services.wm.getMostRecentWindow(aOptions.win);
	} else {
		parentWin = aOptions.win; // they specified a window probably
	}
	fp.init(parentWin, aDialogTitle, Ci.nsIFilePicker[aOptions.mode]);

	if (aOptions.filters) {
		for (var i=0; i<aOptions.filters.length; i=i+2) {
			fp.appendFilter(aOptions.filters[i], aOptions.filters[i+1]);
		}
	}

	if (aOptions.startDirPlatPath) {
		fp.displayDirectory = new nsIFile(aOptions.startDirPlatPath);
	}

	var fpDoneCallback = function(rv) {
		var retFP;
		if (rv == Ci.nsIFilePicker.returnOK || rv == Ci.nsIFilePicker.returnReplace) {

			if (aOptions.returnDetails) {
				var cBrowsedDetails = {
					filepath: fp.file.path,
					filter: aOptions.filters ? aOptions.filters[(fp.filterIndex * 2) + 1] : undefined,
					replace: aOptions.mode == 'modeSave' ? (rv == Ci.nsIFilePicker.returnReplace) : undefined
				};

				retFP = cBrowsedDetails;
			} else {
				retFP = fp.file.path;
			}

		}// else { // cancelled	}
		if (aOptions.async) {
			console.error('async resolving');
			mainDeferred_browseFile.resolve(retFP);
		} else {
			return retFP;
		}
	}

	if (aOptions.defaultString) {
		fp.defaultString = aOptions.defaultString;
	}

	if (aOptions.async) {
		var mainDeferred_browseFile = new Deferred();
		fp.open({
			done: fpDoneCallback
		});
		return mainDeferred_browseFile.promise;
	} else {
		return fpDoneCallback(fp.show());
	}
}

function getSystemDirectory_bootstrap(type) {
	// progrmatic helper for getSystemDirectory in MainWorker - devuser should NEVER call this himself
	return Services.dirsvc.get(type, Ci.nsIFile).path;
}
function getDownloadsDir() {
	var deferredMain_getDownloadsDir = new Deferred();
	try {
		deferredMain_getDownloadsDir.resolve(Services.dirsvc.get('DfltDwnld', Ci.nsIFile).path);
	} catch(ex) {
		Downloads.getSystemDownloadsDirectory().then(
			function(path) {
				deferredMain_getDownloadsDir.resolve(path);
			}
		);
	}
	return deferredMain_getDownloadsDir.promise;
}
//rev1 - https://gist.github.com/Noitidart/c4ab4ca10ff5861c720b
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
// start - CommAPI
// common to all of these apis
	// whenever you use the message method, the method MUST not be a number, as if it is, then it is assumed it is a callback
	// if you want to do a transfer of data from a callback, if transferring is supported by the api, then you must arg must be an object and you must include the key __XFER
	// whenever you do aReprotProgress - it must be an object. The key __PROGRESS will get added to it, so in your final callback destination, you will know not to continue
var gBootstrap = this;

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

	var scope = gBootstrap;
	gCrossprocComms.push(this);

	this.unregister = function() {
		Services.mm.removeMessageListener(aChannelId, this.listener);

		var l = gCrossprocComms.length;
		for (var i=0; i<l; i++) {
			if (gCrossprocComms[i] == this) {
				gCrossprocComms.splice(i, 1);
				break;
			}
		}

		// kill framescripts
		Services.mm.broadcastAsyncMessage(aChannelId, {
			method: 'UNINIT_FRAMESCRIPT'
		});
	};

	this.listener = {
		receiveMessage: function(e) {
			var messageManager = e.target.messageManager;
			if (!messageManager) {
				console.error('bootstrap crossprocComm - ignoring this received message as no messageManager for the one i am getting message from, e.target:', e.target, 'messageManager:', messageManager);
				return;
			}
			var browser = e.target;
			var payload = e.data;
			console.log('bootstrap crossprocComm - incoming, payload:', payload); // , 'messageManager:', messageManager, 'browser:', browser, 'e:', e);
			// console.log('this in receiveMessage bootstrap:', this);

			if (payload.method) {
				if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') }  // dev line remove on prod
				var rez_bs_call__for_fs = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid, messageManager}) : undefined, this, messageManager, browser);  // only on bootstrap side, they get extra 2 args
				// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
				if (payload.cbid) {
					if (rez_bs_call__for_fs && rez_bs_call__for_fs.constructor.name == 'Promise') {
						rez_bs_call__for_fs.then(
							function(aVal) {
								console.log('Fullfilled - rez_bs_call__for_fs - ', aVal);
								this.transcribeMessage(messageManager, payload.cbid, aVal);
							}.bind(this),
							genericReject.bind(null, 'rez_bs_call__for_fs', 0)
						).catch(genericCatch.bind(null, 'rez_bs_call__for_fs', 0));
					} else {
						console.log('bootstrap crossprocComm - calling transcribeMessage for callbck with args:', payload.cbid, rez_bs_call__for_fs);
						this.transcribeMessage(messageManager, payload.cbid, rez_bs_call__for_fs);
					}
				}
			} else if (!payload.method && payload.cbid) {
				// its a cbid
				this.callbackReceptacle[payload.cbid](payload.arg, messageManager, browser, this);
				if (payload.arg && !payload.arg.__PROGRESS) {
					delete this.callbackReceptacle[payload.cbid];
				}
			} else {
				console.error('bootstrap crossprocComm - invalid combination - method:', payload.method, 'cbid:', payload.cbid, 'payload:', payload);
			}
		}.bind(this)
	};
	this.nextcbid = 1; //next callback id
	this.transcribeMessage = function(aMessageManager, aMethod, aArg, aCallback) {
		// console.log('bootstrap sending message to framescript', aMethod, aArg);
		// aMethod is a string - the method to call in framescript
		// aCallback is a function - optional - it will be triggered when aMethod is done calling
		console.log('bootstrap crossprocComm - in transcribeMessage:', aMessageManager, aMethod, aArg, aCallback)
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
		if (!aMessageManager) {
			console.error('bootstrap crossprocComm - how on earth, im in transcribeMessage but no aMessageManager? arguments:', aMessageManager, aMethod, aArg, aCallback);
		}
		aMessageManager.sendAsyncMessage(aChannelId, {
			method: aMethod,
			arg: aArg,
			cbid
		});
	};
	this.callbackReceptacle = {};
	this.reportProgress = function(aProgressArg) {
		// aProgressArg MUST be an object, devuser can set __PROGRESS:1 but doesnt have to, because i'll set it here if its not there
		// this gets passed as thrid argument to each method that is called in the scope
		// devuser MUST NEVER bind reportProgress. as it is bound to {THIS:this, cbid:cbid}
		// devuser must set up the aCallback they pass to initial putMessage to handle being called with an object with key __PROGRESS:1 so they know its not the final reply to callback, but an intermediate progress update
		aProgressArg.__PROGRESS = 1;
		this.THIS.transcribeMessage(this.messageManager, this.cbid, aProgressArg);
	};

	Services.mm.addMessageListener(aChannelId, this.listener);
}
// start - CommAPI for bootstrap-framescript - bootstrap side - cross-file-link55565665464644
// start - CommAPI for bootstrap-content - bootstrap side - cross-file-link0048958576532536411
// message method - putMessage - content is in-process-content-windows, transferring works
// there is a framescript version of this, because framescript cant get aPort1 and aPort2 so it has to create its own
function contentComm(aContentWindow, aPort1, aPort2, onHandshakeComplete) {
	// onHandshakeComplete is triggered when handshake is complete
	// when a new contentWindow creates a contentComm on contentWindow side, it requests whatever it needs on init, so i dont offer a onBeforeInit. I do offer a onHandshakeComplete which is similar to onAfterInit, but not exactly the same
	// no unregister for this really, as no listeners setup, to unregister you just need to GC everything, so just break all references to it

	var handshakeComplete = false; // indicates this.putMessage will now work i think. it might work even before though as the messages might be saved till a listener is setup? i dont know i should ask
	var scope = gBootstrap;

	this.listener = function(e) {
		var payload = e.data;
		console.log('bootstrap contentComm - incoming, payload:', payload); //, 'e:', e);

		if (payload.method) {
			if (payload.method == 'contentComm_handshake_finalized') {
				handshakeComplete = false;
				if (onHandshakeComplete) {
					onHandshakeComplete(this);
				}
				return;
			}
			if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') } // dev line remove on prod
			var rez_bs_call__for_win = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
			// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
			console.log('rez_bs_call__for_win:', rez_bs_call__for_win);
			if (payload.cbid) {
				if (rez_bs_call__for_win && rez_bs_call__for_win.constructor.name == 'Promise') {
					rez_bs_call__for_win.then(
						function(aVal) {
							console.log('Fullfilled - rez_bs_call__for_win - ', aVal);
							this.putMessage(payload.cbid, aVal);
						}.bind(this),
						genericReject.bind(null, 'rez_bs_call__for_win', 0)
					).catch(genericCatch.bind(null, 'rez_bs_call__for_win', 0));
				} else {
					console.log('calling putMessage for callback with rez_bs_call__for_win:', rez_bs_call__for_win, 'this:', this);
					this.putMessage(payload.cbid, rez_bs_call__for_win);
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

	this.nextcbid = 1; //next callback id

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

	aPort1.onmessage = this.listener;
	this.callbackReceptacle = {};
	this.reportProgress = function(aProgressArg) {
		// aProgressArg MUST be an object, devuser can set __PROGRESS:1 but doesnt have to, because i'll set it here if its not there
		// this gets passed as thrid argument to each method that is called in the scope
		// devuser MUST NEVER bind reportProgress. as it is bound to {THIS:this, cbid:cbid}
		// devuser must set up the aCallback they pass to initial putMessage to handle being called with an object with key __PROGRESS:1 so they know its not the final reply to callback, but an intermediate progress update
		aProgressArg.__PROGRESS = 1;
		this.THIS.putMessage(this.cbid, aProgressArg);
	};

	aContentWindow.postMessage({
		topic: 'contentComm_handshake',
		port2: aPort2
	}, '*', [aPort2]);

}
// end - CommAPI for bootstrap-content - bootstrap side - cross-file-link0048958576532536411
// start - CommAPI for bootstrap-worker - bootstrap side - cross-file-link5323131347
// message method - putMessage
// on unregister, workers are terminated
var gWorkerComms = [];
function workerComm_unregAll() {
	var l = gWorkerComms.length;
	for (var i=0; i<l; i++) {
		gWorkerComms[i].unregister();
	}
}
function workerComm(aWorkerPath, onBeforeInit, onAfterInit, aWebWorker) {
	// limitations:
		// the first call is guranteed
		// devuser should never putMessage from worker with method name "triggerOnAfterInit" - this is reserved for programtic use
		// devuser should never putMessage from bootstrap with method name "init" - progmaticcaly this is automatically done in this.createWorker

	// worker is lazy loaded, it is not created until the first call. if you want instant instantiation, call this.createWorker() with no args
	// creates a ChromeWorker, unless aWebWorker is true

	// if onBeforeInit is set
		// if worker has `init` function
			// it is called by bootstrap, (progrmatically, i determine this by basing the first call to the worker)
	// if onBeforeInit is NOT set
		// if worker has `init` function
			// it is called by the worker before the first call to any method in the worker
	// onAfterInit is not called if `init` function does NOT exist in the worker. it is called by worker doing putMessage to bootstrap

	// onBeforeInit - args: this - it is a function, return a single var to send to init function in worker. can return set arg to object with key __XFER if you want to transfer. it is run to build the data the worker should be inited with.
	// onAfterInit - args: aArg, this - a callback that happens after init is complete. aArg is return value of init from in worker. the first call to worker will happen after onAfterInit runs in bootstrap
	// these init features are offered because most times, workers need some data before starting off. and sometimes data is sent back to bootstrap like from init of MainWorker's
	// no featuere for prep term, as the prep term should be done in the `self.onclose = function(event) { ... }` of the worker
	gWorkerComms.push(this);

	var worker;
	var scope = gBootstrap;
	this.nextcbid = 1; //next callback id
	this.callbackReceptacle = {};
	this.reportProgress = function(aProgressArg) {
		// aProgressArg MUST be an object, devuser can set __PROGRESS:1 but doesnt have to, because i'll set it here if its not there
		// this gets passed as thrid argument to each method that is called in the scope
		// devuser MUST NEVER bind reportProgress. as it is bound to {THIS:this, cbid:cbid}
		// devuser must set up the aCallback they pass to initial putMessage to handle being called with an object with key __PROGRESS:1 so they know its not the final reply to callback, but an intermediate progress update
		aProgressArg.__PROGRESS = 1;
		this.THIS.putMessage(this.cbid, aProgressArg);
	};

	this.createWorker = function(onAfterCreate) {
		// only triggered by putMessage when `var worker` has not yet been set
		worker = aWebWorker ? new Worker(aWorkerPath) : new ChromeWorker(aWorkerPath);
		worker.addEventListener('message', this.listener);

		if (onAfterInit) {
			var oldOnAfterInit = onAfterInit;
			onAfterInit = function(aArg, aComm) {
				oldOnAfterInit(aArg, aComm);
				if (onAfterCreate) {
					onAfterCreate(); // link39399999
				}
			}
		}

		var initArg;
		if (onBeforeInit) {
			initArg = onBeforeInit(this);
			if (onAfterInit) {
				this.putMessage('init', initArg); // i dont put onAfterCreate as a callback here, because i want to gurantee that the call of onAfterCreate happens after onAfterInit is triggered link39399999
			} else {
				this.putMessage('init', initArg, onAfterCreate);
			}
		} else {
			// else, worker is responsible for calling init. worker will know because it keeps track in listener, what is the first putMessage, if it is not "init" then it will run init
			if (onAfterCreate) {
				onAfterCreate(); // as putMessage i the only one who calls this.createWorker(), onAfterCreate is the origianl putMessage intended by the devuser
			}
		}
	};
	this.putMessage = function(aMethod, aArg, aCallback) {
		// aMethod is a string - the method to call in framescript
		// aCallback is a function - optional - it will be triggered when aMethod is done calling

		if (!worker) {
			this.createWorker(this.putMessage.bind(this, aMethod, aArg, aCallback));
		} else {
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

			worker.postMessage({
				method: aMethod,
				arg: aArg,
				cbid
			}, aTransfers);
		}
	};
	this.unregister = function() {

		var l = gWorkerComms.length;
		for (var i=0; i<l; i++) {
			if (gWorkerComms[i] == this) {
				gWorkerComms.splice(i, 1);
				break;
			}
		}

		if (worker) { // because maybe it was setup, but never instantiated
			worker.terminate();
		}

	};
	this.listener = function(e) {
		var payload = e.data;
		console.log('bootstrap workerComm - incoming, payload:', payload); //, 'e:', e);

		if (payload.method) {
			if (payload.method == 'triggerOnAfterInit') {
				if (onAfterInit) {
					onAfterInit(payload.arg, this);
				}
				return;
			}
			if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in scope'); throw new Error('method of "' + payload.method + '" not in scope') } // dev line remove on prod
			var rez_bs_call__for_worker = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
			// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
			console.log('rez_bs_call__for_worker:', rez_bs_call__for_worker);
			if (payload.cbid) {
				if (rez_bs_call__for_worker && rez_bs_call__for_worker.constructor.name == 'Promise') {
					rez_bs_call__for_worker.then(
						function(aVal) {
							console.log('Fullfilled - rez_bs_call__for_worker - ', aVal);
							this.putMessage(payload.cbid, aVal);
						}.bind(this),
						genericReject.bind(null, 'rez_bs_call__for_worker', 0)
					).catch(genericCatch.bind(null, 'rez_bs_call__for_worker', 0));
				} else {
					console.log('calling putMessage for callback with rez_bs_call__for_worker:', rez_bs_call__for_worker, 'this:', this);
					this.putMessage(payload.cbid, rez_bs_call__for_worker);
				}
			}
		} else if (!payload.method && payload.cbid) {
			// its a cbid
			this.callbackReceptacle[payload.cbid](payload.arg, this);
			if (payload.arg && !payload.arg.__PROGRESS) {
				delete this.callbackReceptacle[payload.cbid];
			}
		} else {
			console.error('bootstrap workerComm - invalid combination');
			throw new Error('bootstrap workerComm - invalid combination');
		}
	}.bind(this);
}
// end - CommAPI for bootstrap-worker - bootstrap side - cross-file-link5323131347
// CommAPI Abstraction - bootstrap side
function callInFramescript(aMessageManager, aMethod, aArg, aCallback) {
	// only bootstrap calls this
	gFsComm.transcribeMessage(aMessageManager, aMethod, aArg, aCallback);
}
function callInContentOfFramescript(aMessageManager, aMethod, aArg, aCallback) {
	gFsComm.transcribeMessage(aMessageManager, 'callInContent', {
		m: aMethod,
		a: aArg
	}, aCallback);
}
function callInContent(aWinComm, aMethod, aArg, aCallback) {
	// only bootstrap call
	aWinComm.postMessage(aMethod, aArg, aCallback);
}
function callInWorker(aMethod, aArg, aCallback, aExtra1, aExtra2) {
	if (aMethod.constructor.name == 'Object') {
		// framescript or content (NOT contentOfFramescript) called this
		if (arguments.length == 3) {
			// called by content - 3 args - scope[payload.method](payload.arg, this, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined);
			var aReportProgress = aArg;
			var aComm = aCallback;
		} else if (arguments.length == 5) {
			// called by framescript - 5 args - scope[payload.method](payload.arg, messageManager, browser, this, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined);
			var aReportProgress = aArg;
			var aComm = aCallback;
			var aMessageManager = aExtra1;
			var aBrowser = aExtra2;
		}
		else { console.error('arguments.length is ' + arguments.length + ' i didnt handle who calls it with this much'); throw new Error('arguments.length is ' + arguments.length + ' i didnt handle who calls it with this much'); }
		var {m:aMethod, a:aArg} = aMethod;

		if (aReportProgress) { // if (wait) { // if it has aReportProgress then the scope has a callback waiting for reply
			var deferred = new Deferred();
			gWkComm.putMessage(aMethod, aArg, function(rez) {
				if (rez && rez.__PROGRESS) {
					aReportProgress(rez);
				} else {
					deferred.resolve(rez);
				}
			});
			return deferred.promise;
		} else {
			gWkComm.putMessage(aMethod, aArg);
		}
	} else {
		gWkComm.putMessage(aMethod, aArg, aCallback);
	}
}
// end - CommAPI

// end - common helper functions
