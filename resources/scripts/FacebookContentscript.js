var core;
var gFsComm;
var gCover;

function init() {
	alert($);
	gFsComm.postMessage('callInBootstrap', {method:'fetchCore',wait:true}, null, function(aCore) {
		core = aCore;

		gCover = document.createElement('div');
		gCover.setAttribute('id', 'screencastify_cover');
		gCover.setAttribute('style', `
			position: fixed;
			z-index: 999999;
			background-color: rgba(255, 255, 255, 0.9);
			display: flex;
			justify-content: center;
			align-items: center;
			border-radius: 0px 0px 10px 10px;
			transition: top 200ms;
			font-weight: bold;
			width: 76vw;
			height: 50px;
			top: -50px;
			left: 12vw;
			font-size: 16px;
			color: #000;
		`);
		gCover.textContent = 'Screencastify - This tab is in the process of attaching screecast to a New Message'; // :l10n:
		document.documentElement.insertBefore(gCover, document.documentElement.firstChild);
		setTimeout(function() {
			gCover.style.top = '0';
		}, 100);

		// var jqdoc = $(document);
		// // jqdoc.on('uiComposerResetAndFocus', handleDialogOpened); // this fires before uiTweetBoxOpened
		// jqdoc.on('uiTweetBoxOpened', handleDialogOpened);
		// jqdoc.on('uiTweetDialogClosed', handleDialogClosed);
		// jqdoc.on('dataTweetSuccess', handleTweetSuccess);
		// jqdoc.on('dataTweetError', handleTweetError);

		manage();
	});
}

function uninit() {
	// triggered by uninit of framescript - if i want to do something on unload of page i should create function unload() and addEventListener('unload', unload, false)
	alert('uninit');
	if (gCover) { gCover.parentNode.removeChild(gCover) }
}

function makeCoverClickable() {
	gCover.addEventListener('click', manage, false);
	gCover.style.cursor = 'pointer';
}

function manage() {

	gCover.style.cursor = '';
	gCover.removeEventListener('click', manage, false);
	gCover.textContent = 'Screencastify - New Tweet dialog opened. Attaching screencast...';

	var btnNewTweet = document.getElementById('global-new-tweet-button');
	if (!btnNewTweet) {
		gCover.textContent = 'Screencastify - You are not logged in. Please login by clicking here.';
		var btnLogin = document.querySelector('.js-login');
		btnLogin.click();
	} else {
		btnNewTweet.click();
	}
}

var setTextForWait = false;
function waitForFocus() {
	if (document.hasFocus()) {
		setTextForWait = false;
		handleDialogOpened();
	} else {
		if (!setTextForWait) {
			gCover.textContent = 'Screencastify - Cannot attach while document is not focused. Please click/focus document.';
			setTextForWait = true;
		}
		setTimeout(waitForFocus, 100);
	}
}

function handleDialogOpened() {

	if (!document.hasFocus()) {
		waitForFocus();
	} else {
		var tweetDialogDialog = document.getElementById('global-tweet-dialog-dialog'); // :maintain: with twitter updates
		if (!tweetDialogDialog) {
			gCover.textContent = 'Screencastify - Error: Could not find #global-tweet-dialog-dialog - please file bug report.';
		} else {
			var countPreview = tweetDialogDialog.querySelectorAll('img[src^=blob]').length;
			if (countPreview.length) {
				gCover.textContent = 'Screencastify - Twitter one attachment, if it is GIF/video. Your Tweet currently has other images attached. Remove them then click here to attach screencast.';
			} else {
				var richInputTweetMsg = document.getElementById('tweet-box-global'); // :maintain: with twitter updates
				if (!richInputTweetMsg) {
					gCover.textContent = 'Screencastify - Error: Could not find #tweet-box-global - please file bug report.';
				} else {
					gFsComm.postMessage('getCopyOfTwitterRec', undefined, undefined, function(aArg, aComm) {
						var twitter_rec = aArg;
						// this works for gif, but not for mp4
						var blob = new Blob([twitter_rec.arrbuf], { type:twitter_rec.mimetype })
						var fr = new FileReader();
						fr.addEventListener('load', function() {
							var img = document.createElement('img');
							img.setAttribute('src', fr.result);
							richInputTweetMsg.appendChild(img);
							console.error('datauri:', fr.result);
							gCover.textContent = 'Screencastify - Screencast was succesfully attached! Type a message then Tweet!';
						}, false);
						fr.readAsDataURL(blob);
					});
				}
			}
		}
	}
}

function handleDialogClosed() {
	gCover.textContent = 'Screencastify - You have closed the Tweet dialog. Click here to re-attach screencast.';
	makeCoverClickable();
}

function handleTweetSuccess() {
	gFsComm.postMessage('finalizeTwitterRec');
}

function handleTweetError() {
	gCover.textContent = 'Screencastify - Tweet failed. Click here to re-attach screencast to Tweet.';
	makeCoverClickable();
}

// start - common helper functions

function formatStringFromNameCore(aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements) {
	// 051916 update - made it core.addon.l10n based
    // formatStringFromNameCore is formating only version of the worker version of formatStringFromName, it is based on core.addon.l10n cache

	try {
		var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr];
	} catch (ex) {
		console.error('formatStringFromNameCore error:', ex, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements);
	}
	var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr];
	// console.log('cLocalizedStr:', cLocalizedStr, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements);
    if (aReplacements) {
        for (var i=0; i<aReplacements.length; i++) {
            cLocalizedStr = cLocalizedStr.replace('%S', aReplacements[i]);
        }
    }

    return cLocalizedStr;
}
// start - CommAPI
var gContent = this;

// start - CommAPI for bootstrap-content - loadSubScript-sandbox side - cross-file-link0048958576532536411
function contentComm(onHandshakeComplete) {
	// onHandshakeComplete is triggerd when handshake completed and this.postMessage becomes usable
	var scope = gContent;
	var handshakeComplete = false; // indicates this.postMessage will now work
	var port;
	this.nextcbid = 1; // next callback id
	this.callbackReceptacle = {};

	this.CallbackTransferReturn = function(aArg, aTransfers) {
		// aTransfers should be an array
		this.arg = aArg;
		this.xfer = aTransfers
	};
	this.listener = function(e) {
		var payload = e.data;
		console.log('content contentComm - incoming, payload:', payload); // , 'e:', e, 'this:', this);

		if (payload.method) {
			if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in WINDOW'); throw new Error('method of "' + payload.method + '" not in WINDOW') } // dev line remove on prod
			var rez_win_call = scope[payload.method](payload.arg, this);
			console.log('content contentComm - rez_win_call:', rez_win_call);
			if (payload.cbid) {
				if (rez_win_call && rez_win_call.constructor.name == 'Promise') {
					rez_win_call.then(
						function(aVal) {
							console.log('Fullfilled - rez_win_call - ', aVal);
							this.postMessage(payload.cbid, aVal);
						}.bind(this),
						genericReject.bind(null, 'rez_win_call', 0)
					).catch(genericCatch.bind(null, 'rez_win_call', 0));
				} else {
					this.postMessage(payload.cbid, rez_win_call);
				}
			}
		} else if (!payload.method && payload.cbid) {
			// its a cbid
			this.callbackReceptacle[payload.cbid](payload.arg, this);
			delete this.callbackReceptacle[payload.cbid];
		} else {
			console.error('contentComm - invalid combination');
			throw new Error('contentComm - invalid combination');
		}
	}.bind(this);
	this.postMessage = function(aMethod, aArg, aTransfers, aCallback) {

		// aMethod is a string - the method to call in framescript
		// aCallback is a function - optional - it will be triggered when aMethod is done calling
		if (aArg && aArg.constructor == this.CallbackTransferReturn) {
			// aTransfers is undefined - this is the assumption as i use it prorgramtic
			// i needed to create CallbackTransferReturn so that callbacks can transfer data back
			aTransfers = aArg.xfer;
			aArg = aArg.arg;
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
		port.postMessage({
			method: aMethod,
			arg: aArg,
			cbid
		}, aTransfers ? aTransfers : undefined);
	};

	var winMsgListener = function(e) {
		var data = e.data;
		console.log('content contentComm - incoming window message, data:', uneval(data)); //, 'source:', e.source, 'ports:', e.ports);
		switch (data.topic) {
			case 'contentComm_handshake':

					window.removeEventListener('message', winMsgListener, false);
					port = data.port2;
					port.onmessage = this.listener;
					this.postMessage('contentComm_handshake_finalized');
					handshakeComplete = true;
					if (onHandshakeComplete) {
						onHandshakeComplete(true);
					}

				break;
			default:
				console.error('content contentComm - unknown topic, data:', data);
		}
	}.bind(this);
	window.addEventListener('message', winMsgListener, false);

}
// end - CommAPI for bootstrap-content - content side - cross-file-link0048958576532536411
// end - CommAPI
// end - common helper functions

gFsComm = new contentComm(init); // the onHandshakeComplete of initPage will trigger AFTER DOMContentLoaded because MainFramescript only does aContentWindow.postMessage for its new contentComm after DOMContentLoaded see cross-file-link884757009. so i didnt test, but i by doing this here i am registering the contentWindow.addEventListener('message', ...) before it posts. :TODO: i should test what happens if i send message to content first, and then setup listener after, i should see if the content gets that message (liek if it was waiting for a message listener to be setup, would be wonky if its like this but cool) // i have to do this after `var gContent = window` otherwise gContent is undefined
