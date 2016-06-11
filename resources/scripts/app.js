var core;
var gFsComm;
const BASE_PATH = ''

function getPage() {
	var href = location.href;


	var match = href.match(/about\:(\w+)\??(\w+)?.?(.+)?/);
	console.log('match:', match);
	var app = match[1];
	var name = match[2] || 'index';
	name = name[0].toUpperCase() + name.substr(1).toLowerCase();
	var param = match[3]; // if page is index, there is no param, so this will be undefined
	return {
		name,
		param
	};
}

function init() {
	gFsComm.postMessage('callInBootstrap', {method:'fetchCore',wait:true}, null, function(aCore) {
		console.log('core:', aCore);
		core = aCore;

		// update favicon as the setCurrentURI and pushState trick ruins it
		var link = document.createElement('link');
	    link.type = 'image/x-icon';
	    link.rel = 'shortcut icon';
	    link.href = core.addon.path.images + 'icon-color16.png';
	    document.getElementsByTagName('head')[0].appendChild(link);

		console.log('ok rendering react');

		var page = getPage();

		ReactDOM.render(
			React.createElement(ReactRedux.Provider, { store },
				React.createElement(App, {page})
			),
			document.getElementById('root')
		);
		console.log('ok RENDERED react');
	});
}

function uninit() {

}

// start - functions called by framescript

// end - functions called by framescript

// start - react-redux


// ACTIONS
const REPLACE_ALERT = 'REPLACE_ALERT';

// non-action constants

// ACTION CREATORS
function replace_alert(str) {
	return {
		type: REPLACE_ALERT,
		str
	};
}
// REDUCERS
/*
const initialState = {
	alert: ''
};
*/
function alert(state='', action) {
	switch (action.type) {
		case REPLACE_ALERT:
			return action.str;
		default:
			return state;
	}
}

const app = Redux.combineReducers({
	alert
});

// STORE
var store = Redux.createStore(app);

var unsubscribe = store.subscribe(() => console.log(store.getState()) );

// REACT COMPONENTS - PRESENTATIONAL
var App = React.createClass({
	render() {
		var { page } = this.props;
		console.log('this.props:', this.props);

		var cProps = {
			id: 'page',
			className: 'page'
		};

		console.log(page.name + 'Page')
		var rElPage = gContent[page.name + 'Page'] || InvalidPage;

		return React.createElement('div', cProps,
			'App',
			React.createElement(rElPage, { page })
		);
	}
});

var RecordingPage = React.createClass({
	render() {
		return React.createElement('div', null,
			'Recording'
		);
	}
});

var IndexPage = React.createClass({
	render() {
		return React.createElement('div', null,
			'Index'
		);
	}
});

var InvalidPage = React.createClass({
	render() {
		return React.createElement('div', null,
			'INVALID PAGE'
		);
	}
});

// REACT COMPONENTS - CONTAINER

// end - react-redux


// start - common helper functions

function formatStringFromNameCore(aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements) {
	// 051916 update - made it core.addon.l10n based
    // formatStringFromNameCore is formating only version of the worker version of formatStringFromName, it is based on core.addon.l10n cache

	// try {
	// 	var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n];
	// } catch (ex) {
	// 	console.error('formatStringFromNameCore error:', ex, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements);
	// }
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
