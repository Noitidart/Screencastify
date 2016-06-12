var core;
var gFsComm;
var gRecorder;

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
		var link = document.querySelector('link');
		link.setAttribute('href', 'blah');
		link.setAttribute('href', core.addon.path.images + 'icon-color16.png');

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
			var UPDATE_RECSTATE = 'UPDATE_RECSTATE';
			var CHANGE_ACTIVE_ACTION = 'CHANGE_ACTIVE_ACTION';

			// non-action - SET_PARAM systemvideo
			var SYSTEMVIDEO_MONITOR = 'SYSTEMVIDEO_MONITOR';
			var SYSTEMVIDEO_WINDOW = 'SYSTEMVIDEO_WINDOW';
			var SYSTEMVIDEO_APPLICATION = 'SYSTEMVIDEO_APPLICATION';

			// non-action - UPDATE_RECORDING
			var RECSTATE_UNINIT = 'RECSTATE_UNINIT';
			var RECSTATE_WAITING_USER = 'RECSTATE_WAITING_USER';
			var RECSTATE_RECORDING = 'RECSTATE_RECORDING';
			var RECSTATE_STOPPED = 'RECSTATE_STOPPED';
			var RECSTATE_PAUSED = 'RECSTATE_PAUSED';

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

			function updateRecState(state) {
				return {
					type: UPDATE_RECSTATE,
					state
				}
			}

			function changeActiveAction(group, dataid) {
				return {
					type: CHANGE_ACTIVE_ACTION,
					group,
					dataid
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
				},
				recording: enum[RECSTATE_UNINIT, RECSTATE_WAITING_USER, RECSTATE_RECORDING, RECSTATE_STOPPED, RECSTATE_PAUSED],
				activeactions: {group:dataid} // for valid group and dataid see my rendering of NewRecordingPage, thats where this is decided, in each BootstrapSplitButtonDropdown
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

			function recording(state=RECSTATE_UNINIT, action) {
				switch (action.type) {
					case UPDATE_RECSTATE:
						return action.state;
					default:
						return state;
				}
			}

			function activeactions(state={ save:'quick', upload:'imguranon', share:'twitter' }, action) {
				switch (action.type) {
					case CHANGE_ACTIVE_ACTION:
						return Object.assign({}, state, {
							[action.group]: action.dataid
						});
					default:
						return state;
				}
			}

			pageReducers = {
				params,
				options,
				recording,
				activeactions
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
		var { mic, systemaudio, webcam, fps, systemvideo, recording, activeactions } = this.props; // passed from mapStateToProps
		var { toggleMic, toggleSystemaudio, toggleWebcam, setFps, setSystemvideoWindow, setSystemvideoMonitor, setSystemvideoApplication, updateRecStateUser, updateRecStateStop, updateRecStatePause, updateRecStateRecording, updateRecStateUninit, chgActionSaveQuick, chgActionSaveBrowse, chgActionUploadImgurAnon, chgActionUploadImgur, chgActionUploadGfycat, chgActionUploadYoutube, chgActionShareFacebook, chgActionShareTwitter } = this.props; // passed from mapDispatchToProps
		// console.log('NewRecordingPage props:', this.props);
		// console.log('activations in newrecordingpage:', activeactions);

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

		var controls = [];
		switch (recording) {
			case RECSTATE_WAITING_USER:
					controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_waitinguser', 'app'), color:'default', glyph:'hourglass', disabled:true }) );
				break;
			case RECSTATE_RECORDING:
					controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_pause', 'app'), color:'warning', glyph:'pause', onClick:this.pauseRecording }) ); // unsupported
					controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_stop', 'app'), color:'danger', glyph:'stop', onClick:this.stopRecording }) );
				break;
			case RECSTATE_PAUSED:
					controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_resume', 'app'), color:'success', glyph:'play', onClick:this.resumeRecording }) );
					controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_stop', 'app'), color:'danger', glyph:'stop', onClick:this.stopRecording }) );
				break;
			case RECSTATE_STOPPED:
					controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_discard', 'app'), color:'default', glyph:'trash', onClick:updateRecStateUninit }) );
					// controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_preview', 'app'), color:'primary', glyph:'eye-open' }) );
					// controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_rerecord', 'app'), color:'success', glyph:'play', onClick:updateRecStateRecording }) );
				break;
			case RECSTATE_UNINIT:
					controls.push( React.createElement(BootstrapButton, { name:formatStringFromNameCore('newrecording_start', 'app'), color:'success', glyph:'play', onClick:this.startRecording }) ); // updateRecStateRecording
				break;
		}
		var l = controls.length;
		for (var i=l-1; i>0; i--) {
			controls.splice(i, 0, ' ');
		}
		console.log('controls:', controls);

		var mainClassName = '';
		if (recording == RECSTATE_UNINIT) {
			mainClassName += ' recording_uninit';
		} else if (recording == RECSTATE_STOPPED) {
			mainClassName += ' recording_stopped'; // stopped, so show preview
		}
		return React.createElement('div', { id:'NewRecordingPage', className:'container page' + mainClassName },
			React.createElement('div', { className:'header clearfix' },
				React.createElement('h3', { className:'pull-right' },
					formatStringFromNameCore('addon_name', 'main')
				),
				React.createElement('h1', undefined,
					formatStringFromNameCore('newrecording_header', 'app')
				)
			),
			React.createElement('div', { id:'controls' },
				controls
			),
			recording != RECSTATE_STOPPED ? undefined : React.createElement('div', { id:'preview' },
				React.createElement('div', { id:'actions' },
					React.createElement(BootstrapSplitButtonDropdown, {
						item: {
							name:formatStringFromNameCore('newrecording_save', 'app'),
							onClick: this.save,
							list: [
								{ name:formatStringFromNameCore('newrecording_savequick', 'app'), glyph:'floppy-disk', active:(activeactions.save=='quick'), onClick:chgActionSaveQuick },
								{ name:formatStringFromNameCore('newrecording_savebrowse', 'app'), glyph:'folder-open', active:(activeactions.save=='browse'), onClick:chgActionSaveBrowse }
							]
						}
					}),
					' ',
					React.createElement(BootstrapSplitButtonDropdown, {
						item: {
							name:formatStringFromNameCore('newrecording_upload', 'app'),
							onClick: this.upload,
							list: [
								{ name:formatStringFromNameCore('newrecording_gfycat', 'app'), glyph:'flash', active:(activeactions.upload=='gfycat'), onClick:chgActionUploadGfycat },
								{ name:formatStringFromNameCore('newrecording_youtube', 'app'), glyph:'globe', active:(activeactions.upload=='youtube'), onClick:chgActionUploadYoutube },
								{ name:formatStringFromNameCore('newrecording_imguranon', 'app'), glyph:'cutlery', active:(activeactions.upload=='imguranon'), onClick:chgActionUploadImgurAnon },
								{ name:formatStringFromNameCore('newrecording_imgur', 'app'), glyph:'usd', active:(activeactions.upload=='imgur'), onClick:chgActionUploadImgur },
							]
						}
					}),
					' ',
					React.createElement(BootstrapSplitButtonDropdown, {
						item: {
							name:formatStringFromNameCore('newrecording_share', 'app'),
							onClick: this.share,
							list: [
								{ name:formatStringFromNameCore('newrecording_facebook', 'app'), glyph:'tower', active:(activeactions.share=='facebook'), onClick:chgActionShareFacebook },
								{ name:formatStringFromNameCore('newrecording_twitter', 'app'), glyph:'phone-alt', active:(activeactions.share=='twitter'), onClick:chgActionShareTwitter }
							]
						}
					})
				),
				React.createElement('video', { id:'video', controls:'true' },
					React.createElement('source', { src:gURL, type:'video/ogg' })
				)
			),
			recording == RECSTATE_STOPPED ? undefined : React.createElement('div', { id:'settings' },
				React.createElement('div', { id:'settings_content' },
					React.createElement(BootstrapListGroup, { items:captureSystemVideoItems }),
					React.createElement('div', { id:'options' },
						React.createElement(BootstrapButtonGroup, { items:captureAudioItems }),
						React.createElement(BootstrapButtonGroup, { items:captureOtherVideoItems }),
						React.createElement('div', undefined,
							React.createElement('div', { className:'input-group input-group-lg' },
								React.createElement('label', { className:'input-group-addon', htmlFor:'fps' },
									formatStringFromNameCore('newrecording_fps', 'app')
								),
								React.createElement(InputNumber, { id:'fps', className:'form-control', defaultValue:fps, min:1, max:60, dispatcher:setFps })
							)
						)
					)
				)
			)
		);

		//
	},
	pauseRecording: function() {
		var { updateRecStatePause } = this.props
		if (gRecorder) {
			gRecorder.pause();
			updateRecStatePause();
		}
	},
	discardRecording: function() {
		var { updateRecStateUninit } = this.props;
		if (gRecorder) {
			URL.revokeObjectURL(gURL);
			gURL = null;
			gBlob = null;
			updateRecStateUninit();
		}
	},
	resumeRecording: function() {
		var { updateRecStateRecording } = this.props;
		if (gRecorder) {
			gRecorder.resume();
			updateRecStateRecording();
		}
	},
	stopRecording: function() {
		if (gRecorder) {
			gRecorder.stop();
		}
		else { console.warn('gRecorder is null') }
	},
	startRecording: function() {
		var { mic, systemvideo, fps } = this.props; // vars
		var { updateRecStateUser, updateRecStateUninit, updateRecStateRecording, updateRecStateStop } = this.props; // functions

		updateRecStateUser();

		// start async-proc12
		var requestRtc = function() {

			var videoConstraint;
			switch (systemvideo) {
				case SYSTEMVIDEO_WINDOW:
						videoConstraint = { mediaSource:'window' };
					break;
				case SYSTEMVIDEO_APPLICATION:
						videoConstraint = { mediaSource:'application' };
					break;
				case SYSTEMVIDEO_MONITOR:
						videoConstraint = { mediaSource:'screen' };
					break;
			}
			videoConstraint.frameRate = { ideal:fps, max:fps }

			// alert(JSON.stringify(videoConstraint));

			navigator.mediaDevices.getUserMedia({ audio:mic, video:videoConstraint }).then(
				function(stream) {
					console.log('success');
					gRecorder = new MediaRecorder(stream);

					gRecorder.addEventListener('dataavailable', function(e) {
						console.log('in dataavailable!');
						gBlob = e.data;
						gURL = URL.createObjectURL(gBlob);
						gRecorder = null;
						gStream = null;
						updateRecStateStop();
						console.log('done dataavailable!');
					}, false);

					gRecorder.start();

					updateRecStateRecording();
				},
				function(reason) {
					console.error('rtc request failed, reason:', reason);
					alert('You disallowed permission. ' + reason.name);
					updateRecStateUninit();
				}
			)
		};

		requestRtc();
		// end async-proc12

	},
	// start - action handlers
	// it figures out the service from the store
	save: function() {
		var { activeactions } = this.props;
		var group = 'save';
		var serviceid = activeactions[group];
		alert(serviceid);
	},
	upload: function() {
		var { activeactions } = this.props;
		var group = 'upload';
		var serviceid = activeactions[group];
		alert(serviceid);
	},
	share: function() {
		var { activeactions } = this.props;
		var group = 'share';
		var serviceid = activeactions[group];
		alert(serviceid);
	}
	// end - action handlers
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

const BootstrapButton = ({ children, className, color='default', glyph, name, disabled, active, unsupported, onClick, aria, data }) => {
	// active,disabled,unsupported is optional, can be undefined, else bool
	// color, glyph, name are str
	// name is also optional, can be undefined
	// onClick is a function, optional
	// aria and data are objects
	// console.error('bootstrapbutton children:', children);
	var cProps = { type:'button', className:'btn btn-'+color+' btn-lg' + (active ? ' active' : '') + (className ? ' ' + className : ''), title:(unsupported ? formatStringFromNameCore('newrecording_unsupported_tooltip', 'app') : undefined), disabled:(unsupported || disabled ? true : undefined), onClick };
	if (aria) {
		for (var attr in aria) {
			cProps['aria-' + attr] = aria[attr];
		}
	}
	if (data) {
		for (var attr in data) {
			cProps['data-' + attr] = data[attr];
		}
	}
	return React.createElement('button', cProps,
		!glyph ? undefined : React.createElement('span', { className:'glyphicon glyphicon-'+glyph, 'aria-hidden':'true' }),
		(glyph && name) ? ' ' : undefined,
		name, // can be undefined
		children
	)
};

const BootstrapListGroup = ({ items }) => (
	// items should be array of objects like this:
	// { name:str, desc:str, active:bool, disabled:bool, onClick:func } // active is optional, can be undefined // desc is optional, can be undefined // disabled is optional, can be undefined
	React.createElement('div', { className:'list-group' },
		items.map(item => React.createElement('a', { href:'javascript:void(0)', onClick:item.onClick, className:'list-group-item' + (!item.active ? '' : ' active'), disabled:item.disabled },
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

var BootstrapSplitButtonDropdown = React.createClass({
	render: function() {
		var { item } = this.props;

		// an item in the list MUST be active

		// figure out the defaultGlyph, which is the glyph of the button. it will be of the active item
		var glyph;
		for (var el of item.list) {
			if (el.active) {
				glyph = el.glyph;
				break;
			}
		}

		return React.createElement('div', { className:'btn-group btn-group-lg', role:'group' },
			BootstrapButton(Object.assign({ glyph }, item)),
			React.createElement(BootstrapButton, Object.assign({}, item, { onClick:this.toggle, name:undefined, className:'dropdown-toggle', aria:{haspopup:true, expanded:false}, data:{toggle:'dropdown'} }),
				React.createElement('span', { className:'caret' }),
				React.createElement('span', { className:'sr-only' },
					'Toggle Dropdown'
				)
			),
			React.createElement('ul', { ref:'ul', className:'dropdown-menu' },
				item.list.map( el =>
					React.createElement('li', { className:(el.active ? 'active' : undefined), onClick:el.onClick },
						React.createElement('a', { href:'javascript:void(0)' },
							!el.glyph ? undefined : React.createElement('span', { className:'glyphicon glyphicon-'+el.glyph, 'aria-hidden':'true' }),
							(el.glyph && el.name) ? ' ' : undefined,
							el.name
						)
					)
				)
			)
		)
	},
	open: false,
	toggle: function() {
		console.log('this.refs:', this.refs);
		var domEl = this.refs.ul.parentNode;
		console.log('domEl:', domEl);
		if (!this.open) {
			// open it
			domEl.classList.add('open');
			domEl.setAttribute('aria-expanded', true);
			window.addEventListener('click', this.blurClick, false);
			window.addEventListener('keydown', this.blurKey, false);
		} else {
			// close it
			domEl.classList.remove('open');
			domEl.setAttribute('aria-expanded', false);
			window.removeEventListener('click', this.blurClick, false);
			window.removeEventListener('keydown', this.blurKey, false);
		}
		this.open = !this.open;
	},
	// no need for this liClick, as blurClick will handle it, it makes sure to not close if the ul element is clicked, but on li/a/glyph click it will close
	// liClick: function() {
	// 	// this.toggle();
	// },
	blurKey: function(e) {
		// i am assuming this.open is true when this is called
		if (e.key == 'Escape') {
			this.toggle();
		}
	},
	blurClick: function(e) {
		// i am assuming this.open is true when this is called
		if (e.target == this.refs.ul.previousSibling) {
			console.log('blurClick, exit as caret');
			return;
		}
		if (e.target == this.refs.ul) {
			console.log('blurClick, exit as ul');
			return;
		}
		// if (e.target.parentNode == this.refs.ul) {
		// 	console.log('blurClick, exit as li');
		// 	return;
		// }
		// if (e.target.parentNode.parentNode == this.refs.ul) {
		// 	console.log('blurClick, exit as a');
		// 	return;
		// }
		// if (e.target.parentNode.parentNode.parentNode == this.refs.ul) {
		// 	console.log('blurClick, exit as glyph');
		// 	return;
		// }
		this.toggle();
	}
});

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

		// set up parent node mouse drag stuff
		this.refs.input.parentNode.classList.add('inputnumber-parent');
		this.refs.input.parentNode.addEventListener('mousedown', this.mousedown, false);
	},
	comonentWillUnmount: function() {
		// TODO: figure out if on reconcile, if this wheel event is still on it
	    this.refs.input.parentNode.removeEventListener('wheel', this.wheel, false);

		this.refs.input.parentNode.classList.remove('inputnumber-parent');
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
		} else if (value === '') {
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
			console.log('wheel calculated invalid value, so dont do anything, value:', newValue);
		}

		e.stopPropagation();
		e.preventDefault();
	},
	keydown: function(e) {
		var newValue;

		switch (e.key) {
			case 'ArrowUp':
					newValue = this.value + this.progProps.crement;
				break;
			case 'ArrowDown':
					newValue = this.value - this.progProps.crement;
				break;
			default:
				// if its not a number then block it
				if (e.key.length == 1) { // length test, so we allow special keys like Delete, Backspace, etc
					if (isNaN(e.key) || e.key == ' ') {
						console.log('blocked key:', '"' + e.key + '"');
						e.preventDefault();
					}
				}
				return;
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
			console.log('keydown calculated invalid value, so dont do anything, value:', newValue);
		}
	},
	mousedown: function(e) {
		if (e.button != 0) { return }

		if (e.target == this.refs.input) { return } // as user is doing selection

		if (!this.testValid(this.value)) {
			console.log('dom value is currently invalid, so mousedown/mousemove will do nothing')
			return
		}

		this.down_allowed = true;

		this.downx = e.clientX;
		this.downval = this.value;

		this.downcover = document.createElement('div');
		this.downcover.setAttribute('id', 'inputnumber_cover');
		document.documentElement.appendChild(this.downcover);

		window.addEventListener('mouseup', this.mouseup, false);
		window.addEventListener('mousemove', this.mousemove, false);
	},
	mouseup: function(e) {
		if (e.button != 0) { return }

		window.removeEventListener('mouseup', this.mouseup, false);
		window.removeEventListener('mousemove', this.mousemove, false);

		this.downcover.parentNode.removeChild(this.downcover);

		delete this.downx;
		delete this.downval;
		delete this.downcover;
	},
	mousemove: function(e) {
		var delX = e.clientX - this.downx;

		var delSensitivity = delX / this.progProps.sensitivty;

		var newValue = this.downval + Math.round(delSensitivity * this.progProps.crement);

		// this block makes it hit min/max in case user moved mouse so fast the calc is less then the min/max
		if ('min' in this.progProps && this.progProps.min !== undefined && newValue < this.progProps.min) {
			if (this.value !== this.progProps.min) {
				newValue = this.progProps.min;
			}
		} else if ('max' in this.progProps && this.progProps.max !== undefined && newValue > this.progProps.max) {
			if (this.value !== this.progProps.max) {
				newValue = this.progProps.max;
			}
		}
		if (this.testValid(newValue)) {
			// update dom
			this.value = newValue;
			this.refs.input.value = this.value;
			// update state
			this.progProps.dispatcher(this.value);
			// update dom error class
			this.setValid();
			// update cover cursor
			if (!this.down_allowed) {
				this.down_allowed = true;
				this.downcover.classList.remove('not-allowed');
			}
		} else {
			// update cover cursor
			if (this.down_allowed) {
				this.down_allowed = false;
				this.downcover.classList.add('not-allowed');
			}
			console.log('mousemove calculated invalid value, so dont do anything, value:', newValue);
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
	setSystemvideoMonitor: () => store.dispatch(setParam('systemvideo', SYSTEMVIDEO_MONITOR)),
	updateRecStateUser: () => store.dispatch(updateRecState(RECSTATE_WAITING_USER)),
	updateRecStateStop: () => store.dispatch(updateRecState(RECSTATE_STOPPED)),
	updateRecStatePause: () => store.dispatch(updateRecState(RECSTATE_PAUSED)),
	updateRecStateRecording: () => store.dispatch(updateRecState(RECSTATE_RECORDING)),
	updateRecStateUninit: () => store.dispatch(updateRecState(RECSTATE_UNINIT)),
	chgActionSaveQuick: () => store.dispatch(changeActiveAction('save', 'quick')),
	chgActionSaveBrowse: () => store.dispatch(changeActiveAction('save', 'browse')),
	chgActionUploadImgurAnon: () => store.dispatch(changeActiveAction('upload', 'imguranon')),
	chgActionUploadImgur: () => store.dispatch(changeActiveAction('upload', 'imgur')),
	chgActionUploadGfycat: () => store.dispatch(changeActiveAction('upload', 'gfycat')),
	chgActionUploadYoutube: () => store.dispatch(changeActiveAction('upload', 'youtube')),
	chgActionShareFacebook: () => store.dispatch(changeActiveAction('share', 'facebook')),
	chgActionShareTwitter: () => store.dispatch(changeActiveAction('share', 'twitter'))
};
var NewRecordingContainer = ReactRedux.connect(
	function mapStateToProps(state, ownProps) {
		return {
			mic: state.options.mic,
			systemaudio: state.options.systemaudio,
			webcam: state.options.webcam,
			fps: state.params.fps,
			systemvideo: state.params.systemvideo,
			recording: state.recording,
			activeactions: state.activeactions
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
