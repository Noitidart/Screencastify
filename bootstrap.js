// Imports
const {interfaces: Ci, utils: Cu, classes:Cc, Constructor: CC} = Components;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/CustomizableUI.jsm');

const COMMONJS_URI = 'resource://gre/modules/commonjs';
const { require } = Cu.import(COMMONJS_URI + '/toolkit/require.js', {});
var CLIPBOARD = require('sdk/clipboard');

var nsIFile = CC('@mozilla.org/file/local;1', Ci.nsILocalFile, 'initWithPath');

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
	if (aReason == ADDON_UNINSTALL) {
		Cu.import('resource://gre/modules/osfile.jsm');
		OS.File.removeDir(OS.Path.join(OS.Constants.Path.profileDir, 'jetpack', core.addon.id), {ignorePermissions:true, ignoreAbsent:true});
	}
}

var gBootstrap = this;
function startup(aData, aReason) {
	Services.scriptloader.loadSubScript(core.addon.path.scripts + 'comm/Comm.js', gBootstrap);
    ({ callInMainworker, callInContentinframescript, callInFramescript } = CommHelper.bootstrap);

	gWkComm = new Comm.server.worker(core.addon.path.scripts + 'MainWorker.js', ()=>{return core}, function(aArg, aComm) {

		core = aArg;

		gFsComm = new Comm.server.framescript(core.addon.id);

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

	callInMainworker('dummyForInstantInstantiate');

}

function shutdown(aData, aReason) {

	if (aReason == APP_SHUTDOWN) { return }

	CustomizableUI.destroyWidget('cui_screencastify');

	windowListener.unregister();

	Services.mm.removeDelayedFrameScript(core.addon.path.scripts + 'MainFramescript.js?' + core.addon.cache_key);

	Comm.server.unregAll('framescript');
    Comm.server.unregAll('worker');

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
	// 	callInMainworker('globalRecordNew');
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

// start - functions called by content
var recordings_inprog_cnt = 0;
const PREF_ALLOWED_DOMAINS = 'media.getusermedia.screensharing.allowed_domains';
const PREF_SCREENSHARING_ENABLED = 'media.getusermedia.screensharing.enabled';
var revert_prefs = {}; // key is pref to revert, value is pref to set it to
function ensurePrefs() {
	var allowed_domains = Services.prefs.getCharPref(PREF_ALLOWED_DOMAINS);
	var screensharing_enabled = Services.prefs.getBoolPref(PREF_SCREENSHARING_ENABLED);

	if (screensharing_enabled != true) {
		revert_prefs[PREF_SCREENSHARING_ENABLED] = {
			value: screensharing_enabled,
			type: 'Bool'
		};
		Services.prefs.setBoolPref(PREF_SCREENSHARING_ENABLED, true);
	}
	if (!allowed_domains.split(',').includes('screencastify')) {
		revert_prefs[PREF_ALLOWED_DOMAINS] = {
			value: allowed_domains,
			type: 'Char'
		};
		Services.prefs.setCharPref(PREF_ALLOWED_DOMAINS, allowed_domains + ',screencastify');
	}

	recordings_inprog_cnt++;
}

function revertPrefs() {
	recordings_inprog_cnt--;
	if (!recordings_inprog_cnt) {

		for (var p in revert_prefs) {
			var pref = revert_prefs[p];
			console.log(p, 'set' + pref.type + 'Pref', Services.prefs['set' + pref.type + 'Pref']);
			Services.prefs['set' + pref.type + 'Pref'](p, pref.value);
		}

		revert_prefs = {};
	} // else another recording is in progress
}
// end - functions called by content

// start - functions called by framescript
function fetchCore(aArg, aReportProgress, aComm, aMessageManager, aBrowser) {
	return {core};
}
function fetchCoreAndHydrant(head, aReportProgress, aComm, aMessageManager, aBrowser) {
	var deferredMain_fetchCoreAndHydrant = new Deferred();
	callInMainworker('fetchHydrant', head, function(hydrant, aComm) {
		deferredMain_fetchCoreAndHydrant.resolve({
			hydrant,
			core
		});
	});
	return deferredMain_fetchCoreAndHydrant.promise;
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
function expoloreInSystem(aOSPath) {
	showFileInOSExplorer(new nsIFile(aOSPath));
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

//start - common helper functions
// rev3 - https://gist.github.com/Noitidart/feeec1776c6ee4254a34
function showFileInOSExplorer(aNsiFile, aDirPlatPath, aFileName) {
	// can pass in aNsiFile
	if (aNsiFile) {
		//http://mxr.mozilla.org/mozilla-release/source/browser/components/downloads/src/DownloadsCommon.jsm#533
		// opens the directory of the aNsiFile

		if (aNsiFile.isDirectory()) {
			aNsiFile.launch();
		} else {
			aNsiFile.reveal();
		}
	} else {
		var cNsiFile = new nsIFile(aDirPlatPath);

		if (!aFileName) {
			// its a directory
			cNsiFile.launch();
		} else {
			cNsiFile.append(aFileName);
			cNsiFile.reveal();
		}
	}
}

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
// end - common helper functions
