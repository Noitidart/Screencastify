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
	name += 'Page';

	// special page name/param combos
	switch (name) {
		case 'RecordingPage':
				if (param == 'new') {
					name = 'NewRecordingPage';
				} else if (!isNaN(param)) {
					name = 'ManageRecordingPage';
				}
			break;
	}

	gPage = {
		name,
		param
	};

	return gPage;
}
getPage();

function init() {
	gFsComm.postMessage('callInBootstrap', {method:'fetchCore',wait:true}, null, function(aCore) {
		console.log('core:', aCore);
		core = aCore;

		// // update favicon as the setCurrentURI and pushState trick ruins it
		// var link = document.createElement('link');
	    // link.type = 'image/x-icon';
	    // link.rel = 'shortcut icon';
	    // link.href = core.addon.path.images + 'icon-color16.png';
	    // document.getElementsByTagName('head')[0].appendChild(link);

		console.log('ok rendering react');

		var page = gPage;

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
switch (gPage.name) {
	case 'NewRecordingPage':
			var SET_PARAM = 'SET_PARAM';
			var TOGGLE_OPT = 'TOGGLE_OPT';

			// non-action - SET_PARAM systemvideo
			var SYSTEMVIDEO_MONITOR = 'SYSTEMVIDEO_MONITOR';
			var SYSTEMVIDEO_WINDOW = 'SYSTEMVIDEO_WINDOW';
			var SYSTEMVIDEO_APPLICATION = 'SYSTEMVIDEO_APPLICATION';

		break;
}

// const REPLACE_ALERT = 'REPLACE_ALERT';

// ACTION CREATORS
switch (gPage.name) {
	case 'NewRecordingPage':

			function setParam(param, value) {
				return {
					type: SET_PARAM,
					param,
					value
				}
			}

			function toggleOpt(opt) {
				return {
					type: TOGGLE_OPT,
					opt
				}
			}

		break;
}

// REDUCERS
var pageReducers = {};
switch (gPage.name) {
	case 'NewRecordingPage':

			/* state shape
			const initialState = {
				options: {
					mic: bool - default:false
					webcam: bool - default:false
					systemaudio: bool - default:false
				},
				params: {
					systemvideo: enum[SYSTEMVIDEO_MONITOR, SYSTEMVIDEO_WINDOW, SYSTEMVIDEO_APPLICATION] - default:SYSTEMVIDEO_MONITOR
					fps: int - default:10
				}
			};
			*/

			function params(state={systemvideo:SYSTEMVIDEO_MONITOR, fps:10}, action) {
				switch (action.type) {
					case SET_PARAM:
						return Object.assign({}, state, {
							[action.param]: action.value
						});
					default:
						return state;
				}
			}

			function options(state={mic:false, webcam:false, systemaudio:false}, action) {
				switch (action.type) {
					case TOGGLE_OPT:
						return Object.assign({}, state, {
							[action.opt]: !state[action.opt]
						});
					default:
						return state;
				}
			}

			pageReducers = {
				params,
				options
			};

		break;
}

// function alert(state='', action) {
// 	switch (action.type) {
// 		case REPLACE_ALERT:
// 			return action.str;
// 		default:
// 			return state;
// 	}
// }

const app = Redux.combineReducers(
	Object.assign(pageReducers, {
		// alert
	})
);

// STORE
var store = Redux.createStore(app);

var unsubscribe = store.subscribe(() => console.log(store.getState()) );

// REACT COMPONENTS - PRESENTATIONAL
var App = React.createClass({
	render() {
		var { page } = this.props;
		console.log('App props:', this.props);
		console.log('container of page:', page.name.replace('Page', 'Container'));
		var pageREl = gContent[page.name.replace('Page', 'Container')] || gContent[page.name] || InvalidPage;

		return React.createElement(pageREl, { param:page.param })
	}
});

var NewRecordingPage = React.createClass({
	componentDidMount() {
		document.querySelector('title').textContent = formatStringFromNameCore('newrecording_title', 'app');
	},
	render() {
		var { param } = this.props; // passed from parent component
		var { mic, systemaudio, webcam, fps, systemvideo } = this.props; // passed from mapStateToProps
		var { toggleMic, toggleSystemaudio, toggleWebcam, setFps, setSystemvideoWindow, setSystemvideoMonitor, setSystemvideoApplication } = this.props; // passed from mapDispatchToProps
		// console.log('NewRecordingPage props:', this.props);

		var captureSystemVideoItems = [
			{ name:formatStringFromNameCore('newrecording_application', 'app'), desc:formatStringFromNameCore('newrecording_application_desc', 'app'), active:(systemvideo === SYSTEMVIDEO_APPLICATION), onClick:setSystemvideoApplication },
			{ name:formatStringFromNameCore('newrecording_monitor', 'app'), desc:formatStringFromNameCore('newrecording_monitor_desc', 'app'), active:(systemvideo === SYSTEMVIDEO_MONITOR), onClick:setSystemvideoMonitor },
			{ name:formatStringFromNameCore('newrecording_window', 'app'), desc:formatStringFromNameCore('newrecording_window_desc', 'app'), active:(systemvideo === SYSTEMVIDEO_WINDOW), onClick:setSystemvideoWindow }
		];

		var captureAudioItems = [
			{ name:formatStringFromNameCore('newrecording_mic', 'app'), active:mic, onClick:toggleMic },
			{ name:formatStringFromNameCore('newrecording_systemaudio', 'app'), active:systemaudio, onClick:toggleSystemaudio, unsupported:true }
		];

		var captureOtherVideoItems = [
			{ name:formatStringFromNameCore('newrecording_webcam', 'app'), active:webcam, onClick:toggleWebcam, unsupported:true }
		];

		return React.createElement('div', { id:'NewRecordingPage', className:'container page' },
			React.createElement('div', { className:'header clearfix' },
				React.createElement('h3', { className:'pull-right' },
					formatStringFromNameCore('addon_name', 'main')
				),
				React.createElement('h1', undefined,
					formatStringFromNameCore('newrecording_header', 'app')
				)
			),
			React.createElement('div', { id:'controls' },
				React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_start', 'app'), color:'success', glyph:'play' })
			),
			React.createElement(BootstrapListGroup, { items:captureSystemVideoItems }),
			React.createElement('div', { id:'options' },
				React.createElement(BootstrapButtonGroup, { items:captureAudioItems }),
				React.createElement(BootstrapButtonGroup, { items:captureOtherVideoItems }),
				React.createElement('div', undefined,
					React.createElement('div', { className:'input-group input-group-lg' },
						React.createElement('label', { className:'input-group-addon', htmlFor:'fps' },
							formatStringFromNameCore('newrecording_fps', 'app')
						),
						React.createElement(InputNumber, { id:'fps', className:'form-control', placeholder:10, defaultValue:fps, min:1, max:60, dispatcher:setFps })
					)
				)
			)
		);

		//
	}
});

var ManageRecordingPage = React.createClass({
	componentDidMount() {
		document.querySelector('title').textContent = formatStringFromNameCore('newrecording_title', 'app');
	},
	render() {
		var { param } = this.props;

		return React.createElement('div', { id:'ManageRecordingPage', className:'container page' },
			'Manage Recording (ID:' + param + ')'
		);

		//
	}
});

const BootstrapButton = ({ color='default', glyph, name, disabled, active, unsupported, onClick }) => (
	// active,disabled,unsupported is optional, can be undefined, else bool
	// color, glyph, name are str
	// name is also optional, can be undefined
	// onClick is a function, optional
	React.createElement('button', { type:'button', className:'btn btn-'+color+' btn-lg' + (active ? ' active' : ''), title:(unsupported ? formatStringFromNameCore('newrecording_unsupported_tooltip', 'app') : undefined), disabled:(unsupported || disabled ? true : undefined), onClick },
		!glyph ? undefined : React.createElement('span', { className:'glyphicon glyphicon-'+glyph, 'aria-hidden':'true' }),
		(glyph && name) ? ' ' : undefined,
		name // can be undefined
	)
);

const BootstrapListGroup = ({ items }) => (
	// items should be array of objects like this:
	// { name:str, desc:str, active:bool, disabled:bool, onClick:func } // active is optional, can be undefined // desc is optional, can be undefined // disabled is optional, can be undefined
	React.createElement('div', { className:'list-group' },
		items.map(item => React.createElement('a', { href:'#', onClick:item.onClick, className:'list-group-item' + (!item.active ? '' : ' active'), disabled:item.disabled },
			React.createElement('h4', {},
				item.name
			),
			!item.desc ? undefined : React.createElement('p', { className:'list-group-item-text' },
				item.desc
			)
		))
	)
);

const BootstrapButtonGroup = ({ items }) => (
	// items should be array of objects like this:
	// each object should like like the arg to BootstarpButton
	React.createElement('div', { className:'btn-group btn-group-lg', role:'group' },
		items.map(item => BootstrapButton(item))
	)
);

var IndexPage = React.createClass({
	render() {
		var { param } = this.props;

		return React.createElement('div', { id:'IndexPage', className:'container page' },
			'Index'
		);
	}
});

var InvalidPage = React.createClass({
	render() {
		return React.createElement('div', { id:'InvalidPage', className:'container page' },
			'INVALID PAGE'
		);
	}
});

var gInputNumberId = 1;
var InputNumber = React.createClass({
	componentDidMount: function() {
		this.refs.input.parentNode.addEventListener('wheel', this.wheel, false);

		// set up local globals
		// this.value is the physically value that is currently showing in the input, NOT necessarily what is in the state object
		if (!('defaultValue' in this.props)) { console.error('deverror'); throw new Error('in my design i expect for a defaultValue to be there') }
		this.value = this.props.defaultValue; // this.value must always be a js number
		this.valid = true; // needed otherwise, if this.setValid finds this.value to be valid, it will try to remove from classList, its an unnecessary dom action
		this.setValid(); // this will set this.valid for me
		console.log('ok mounted');
	},
	comonentWillUnmount: function() {
		// TODO: figure out if on reconcile, if this wheel event is still on it
	    this.refs.input.parentNode.removeEventListener('wheel', this.wheel, false);
	},
	render: function() {
		// fetch all props as domProps
		var domProps = Object.assign({}, this.props);

		// remove progrmatically used props from domProps, and put them into here
		var progProps = {}; // holds values
		this.progProps = progProps;
		var progPropDefaults = {
			crement: 1, // must be min of 1
			sensitivty: 10, // must be min of 1 - while dragging mouse this many pixels will result in change of crement
			cursor: 'ew-resize',
			min: undefined, // optional
			max: undefined, // optional
			dispatcher: undefined // not optional, must be provided by parent component // dispatcher is a function that takes one argument. and will pass this argment to dispatch(actionCreator(...))
		};

		for (var name in progPropDefaults) {
			if (name in domProps) {
				progProps[name] = domProps[name];
				delete domProps[name];
			} else {
				progProps[name] = progPropDefaults[name];
			}
		}

		if (!progProps.dispatcher) { console.error('deverror'); throw new Error('dispatcher is required in this.props!') }

		// validate domProps and add the progrmatic ones
		domProps.className = domProps.className ? domProps.className + ' inputnumber' : 'inputnumber';
		if (!('id' in domProps)) { domProps.id = gInputNumberId++ }
		if (!domProps.maxLength && progProps.max) { domProps.maxLength = (progProps.max+'').length }
		domProps.ref = 'input';
		domProps.onWheel = this.wheel;
		domProps.onKeyDown = this.keydown;
		domProps.onChange = this.change;

		return React.createElement('input', domProps)
	},
	setValid: function() {
		// updates dom, based on physical value in dom - this.value
			// this.valid states if this.value is valid. and this.value is what is physically in the dom field
		// return value tells you that the dom is currently valid or not
		var valid = this.testValid(this.value);
		if (valid !== this.valid) {
			this.valid = valid;
			console.log('this.valid updated to:', valid);
			if (!valid) {
				this.refs.input.parentNode.classList.add('has-error');
			} else {
				this.refs.input.parentNode.classList.remove('has-error');
			}
		}
		return valid;
	},
	testValid: function(value) {
		// acts on virtual value. NOT what is physically in dom. thus a value must be passed in as argument
		// returns false if invalid, returns true if valid
		if (isNaN(value)) {
			console.error('value is isNaN', value);
			return false;
		} else if (value == '') {
			console.error('value is blank', value);
			return false;
		} else if ('min' in this.progProps && this.progProps.min !== undefined && value < this.progProps.min) {
			console.error('value is less then min', value);
			return false;
		} else if ('max' in this.progProps && this.progProps.max !== undefined && value > this.progProps.max) {
			console.error('value is greater then max', value);
			return false;
		} else {
			return true;
		}
	},
	testThenDispatch: function(value) {
		// tests if value is within min and max, then calls dispatcher with it
		if (this.testValid(value)) {
			if (this.value !== value) {
				this.refs.input.value = value;
				this.value = value;
			}
			this.progProps.dispatcher(value);
		}
	},
	change: function(e) {
		// TODO: i hope this only triggers when user changes - verify
		console.log('user changed field value in dom! this.value:', this.value, 'dom value:', this.refs.input.value);
		// update this.value, as this.value is to always be kept in sync with dom
		this.value = isNaN(this.value) ? this.refs.input.value : parseInt(this.refs.input.value);
		if (this.setValid()) {
			// update state
			this.progProps.dispatcher(this.value);
		}
	},
	wheel: function(e) {
		var newValue;
		console.log('e:', e.deltaMode, e.deltaY);
		if (e.deltaY < 0) {
			newValue = this.value + this.progProps.crement;
		} else {
			newValue = this.value - this.progProps.crement;
		}

		if (this.testValid(newValue)) {
			// update dom
			this.value = newValue;
			this.refs.input.value = this.value;
			// update state
			this.progProps.dispatcher(this.value);
			// update dom error class
			this.setValid();
		} else {
			// if (!this.testValid(this.value)) {
			// 	console.log('wheel calculated invalid value, but dom value (' + this.value + ') is also invald, so set the dom value, newValue:', newValue);
			// 	this.value = newValue;
			// 	this.refs.input.value = newValue;
			// } else {
			//	console.log('wheel calculated invalid value, and dom value (' + this.value + ') is valid, so dont do anything, newValue:', newValue);
			// }
			console.log('wheel calculated invalid value, so dont do anything, value:', newValue);
		}

		e.stopPropagation();
		e.preventDefault();
	},
	keydown: function(e) {
		var newValue;

		switch (e.key) {
			case 'ArrowUp':
					newValue = this.value + this.crement;
					this.testThenDispatch(newValue);
				break;
			case 'ArrowDown':
					newValue = this.value - this.crement;
					this.testThenDispatch(newValue);
				break;
			default:
				// if its not a number then block it
				if (e.key.length == 1) { // length test, so we allow special keys like Delete, Backspace, etc
					if (isNaN(e.key) || e.key == ' ') {
						console.log('blocked key:', '"' + e.key + '"');
						e.preventDefault();
					}
				}
		}
	}
});

// REACT COMPONENTS - CONTAINER
var NewRecordingMemo = {
	toggleMic: () => store.dispatch(toggleOpt('mic')),
	toggleWebcam: () => store.dispatch(toggleOpt('webcam')),
	toggleSystemaudio: () => store.dispatch(toggleOpt('systemaudio')),
	setFps: (value) => store.dispatch(setParam('fps', value)),
	setSystemvideoWindow: () => store.dispatch(setParam('systemvideo', SYSTEMVIDEO_WINDOW)),
	setSystemvideoApplication: () => store.dispatch(setParam('systemvideo', SYSTEMVIDEO_APPLICATION)),
	setSystemvideoMonitor: () => store.dispatch(setParam('systemvideo', SYSTEMVIDEO_MONITOR))
};
var NewRecordingContainer = ReactRedux.connect(
	function mapStateToProps(state, ownProps) {
		return {
			mic: state.options.mic,
			systemaudio: state.options.systemaudio,
			webcam: state.options.webcam,
			fps: state.params.fps,
			systemvideo: state.params.systemvideo
		}
	},
	function mapDispatchToProps(dispatch, ownProps) {
		return NewRecordingMemo
	}
)(NewRecordingPage);

// end - react-redux


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
