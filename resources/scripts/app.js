var core;
var gFsComm;
var gRecorder;
var gPage;

var gTime;
var gBlob;
var gURL;

function getPage() {
	var href = location.href;
	if (href.includes('#')) {
		href = href.substr(0, href.indexOf('#'));
	}


	var match = href.match(/about\:(\w+)\??(\w+)?.?(.+)?/);
	console.log('match:', match);
	var app = match[1];
	var name = match[2] || 'index';
	name = name[0].toUpperCase() + name.substr(1).toLowerCase();
	var param = match[3]; // if page is index, there is no param, so this will be undefined
	if (param.includes('/')) {
		param = param.split('/');
	}
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
	callInBootstrap('fetchCore', undefined, function(aCore) {
		console.log('core:', aCore);
		core = aCore;

		window.addEventListener('unload', uninit, false);

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
	// triggered by uninit of framescript - if i want to do something on unload of page i should create function unload() and addEventListener('unload', unload, false)
	if (gURL) {
		URL.revokeObjectURL(gURL);
		console.error('revoked url of:', gURL);
		gURL = null;
	}
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
			var ADD_ALERT = 'ADD_ALERT';
			var UPDATE_ALERT = 'UPDATE_ALERT';
			var REMOVE_ALERT = 'REMOVE_ALERT';

			var SET_DIALOG = 'SET_DIALOG'
			var DESTROY_DIALOG = 'DESTROY_DIALOG';

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

			function changeActiveAction(group, serviceid) {
				return {
					type: CHANGE_ACTIVE_ACTION,
					group,
					serviceid
				}
			}

			function addAlert(alertid, obj) {
				// obj can contain a mix of these keys
					// acceptable keys: { body, body_prefix, body_suffix, color, dismissible, glyph, title }

				return {
					type: ADD_ALERT,
					alertid,
					obj
				}
			}

			function updateAlert(alertid, obj) {
				// see addAlert for acceptable keys to obj
				return {
					type: UPDATE_ALERT,
					alertid,
					obj
				}
			}

			function removeAlert(alertid) {
				return {
					type: REMOVE_ALERT,
					alertid
				}
			}

			function setDialog(items) {
				return {
					type: SET_DIALOG,
					items
				}
			}

			function destroyDialog() {
				return {
					type: DESTROY_DIALOG
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
				activeactions: {group:serviceid} // for valid group and serviceid see my rendering of NewRecordingPage, thats where this is decided, in each BootstrapSplitButtonDropdown
				alerts: [{ alertid:Date.now, color:string, title:string, body:string, dismissible:boolean }] // alertid should be time
				dialog: null
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

			function activeactions(state={ save:'quick', upload:'gfycatanon', share:'twitter' }, action) {
				switch (action.type) {
					case CHANGE_ACTIVE_ACTION:
						return Object.assign({}, state, {
							[action.group]: action.serviceid
						});
					default:
						return state;
				}
			}

			function alerts(state=[], action) {
				switch (action.type) {
					case REMOVE_ALERT:
						return state.filter( alert => alert.alertid !== action.alertid );
					case ADD_ALERT:
						return [
							...state,
							Object.assign(action.obj, { alertid:action.alertid })
						];
					case UPDATE_ALERT:
						return state.map( alert => alert.alertid === action.alertid ? Object.assign({}, alert, action.obj) : alert );
					default:
						return state;
				}
			}

			function dialog(state=null, action) {
				switch (action.type) {
					case SET_DIALOG:
							return { items: action.items };
						break;
					case DESTROY_DIALOG:
							return null;
						break;
					default:
						return state;
				}
			}

			pageReducers = {
				params,
				options,
				recording,
				activeactions,
				alerts,
				dialog
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
		// console.log('container of page:', page.name.replace('Page', 'Container'), gContent[page.name.replace('Page', 'Container')]);
		// console.log('page.name:', page.name, gContent[page.name], uneval(gContent[page.name]));
		var pageREl = gContent[page.name.replace('Page', 'Container')] || gContent[page.name] || InvalidPage;
		// console.log(uneval(pageREl));

		return React.createElement(pageREl, { param:page.param })
	}
});

var AuthPage = React.createClass({
	componentDidMount: function() {
		document.querySelector('title').textContent = formatStringFromNameCore('newrecording_' + gPage.param[0], 'app') + ' Authorization'; // :l10n: formatStringFromNameCore('autorized_title', 'app');
	},
	closeSelfTab: function() {
		callInBootstrap('closeSelfTab');
	},
	render: function() {
		return React.createElement('div', { id:'AuthPage', className:'container page' },
			React.createElement('div', { className:'header clearfix' },
				React.createElement('h3', { className:'pull-right' },
					formatStringFromNameCore('addon_name', 'main')
				),
				React.createElement('h1', undefined,
					React.createElement('img', { id:'page_icon', src:core.addon.path.images+gPage.param[0]+'48.png' }),
					formatStringFromNameCore('newrecording_' + gPage.param[0], 'app') + ' Authorization'// :l10n:
				)
			),
			React.createElement('div', { className:'jumbotron' },
				React.createElement('h1', undefined,
					formatStringFromNameCore('auth_' + gPage.param[1], 'app')
				),
				React.createElement('p', { className:'lead' },
					formatStringFromNameCore('auth_explain' + gPage.param[1], 'app')
				),
				React.createElement('p', { className:'lead' },
					React.createElement('a', { className:'btn btn-lg btn-' + (gPage.param[1] == 'approved' ? 'success' : 'danger'), href:'javascript:void', role:'button', onClick:this.closeSelfTab },
						formatStringFromNameCore(gPage.param[1] == 'approved' ? 'auth_returntodoing' : 'auth_closetab', 'app')
					)
				)
			)
		);
	}
});

var NewRecordingPage = React.createClass({
	componentDidMount() {
		document.querySelector('title').textContent = formatStringFromNameCore('newrecording_title', 'app');
	},
	render() {
		var { param } = this.props; // passed from parent component
		var { mic, systemaudio, webcam, fps, systemvideo, recording, activeactions, alerts, dialog } = this.props; // passed from mapStateToProps
		var { toggleMic, toggleSystemaudio, toggleWebcam, setFps, setSystemvideoWindow, setSystemvideoMonitor, setSystemvideoApplication, updateRecStateUser, updateRecStateStop, updateRecStatePause, updateRecStateRecording, updateRecStateUninit, chgActionSaveQuick, chgActionSaveBrowse, chgActionUploadGfycatAnon, chgActionUploadGfycat, chgActionUploadYoutube, chgActionShareFacebook, chgActionShareTwitter } = this.props; // passed from mapDispatchToProps // removed `chgActionUploadImgurAnon, chgActionUploadImgur` as i deprecated imgur
		// console.log('NewRecordingPage props:', this.props);
		// console.log('activations in newrecordingpage:', activeactions);

		var captureSystemVideoItems = [
			// { name:formatStringFromNameCore('newrecording_application', 'app'), desc:formatStringFromNameCore('newrecording_application_desc', 'app'), active:(systemvideo === SYSTEMVIDEO_APPLICATION), onClick:setSystemvideoApplication },
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
		pushAlternatingRepeating(controls, ' ');
		console.log('controls:', controls);

		var mainClassName = '';
		if (recording == RECSTATE_UNINIT) {
			mainClassName += ' recording_uninit';
		} else if (recording == RECSTATE_STOPPED) {
			mainClassName += ' recording_stopped'; // stopped, so show preview
		}
		return React.createElement('div', { id:'NewRecordingPage', className:'container page' + mainClassName },
			dialog ? React.createElement(ConfirmUI, dialog) : undefined,
			React.createElement('div', { className:'header clearfix' },
				React.createElement('h3', { className:'pull-right' },
					formatStringFromNameCore('addon_name', 'main')
				),
				React.createElement('h1', undefined,
					formatStringFromNameCore('newrecording_header', 'app')
				)
			),
			React.createElement('div', { id:'alerts' },
				!alerts ? undefined : alerts.map(alert =>
					React.createElement(BootstrapAlert, Object.assign({}, alert, { dismiss_dispatcher: alert.dismissible ? this.dismiss_dispatcher : undefined }))
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
								{ name:formatStringFromNameCore('newrecording_gfycatanon', 'app'), glyph:'gfycatanon', active:(activeactions.upload=='gfycatanon'), onClick:chgActionUploadGfycatAnon },
								{ name:formatStringFromNameCore('newrecording_gfycat', 'app'), glyph:'gfycat', active:(activeactions.upload=='gfycat'), onClick:chgActionUploadGfycat },
								{ name:formatStringFromNameCore('newrecording_youtube', 'app'), glyph:'youtube', active:(activeactions.upload=='youtube'), onClick:chgActionUploadYoutube }
								// { name:formatStringFromNameCore('newrecording_imguranon', 'app'), glyph:'cutlery', active:(activeactions.upload=='imguranon'), onClick:chgActionUploadImgurAnon },
								// { name:formatStringFromNameCore('newrecording_imgur', 'app'), glyph:'usd', active:(activeactions.upload=='imgur'), onClick:chgActionUploadImgur }
							]
						}
					}),
					' ',
					React.createElement(BootstrapSplitButtonDropdown, {
						item: {
							name:formatStringFromNameCore('newrecording_share', 'app'),
							onClick: this.share,
							list: [
								{ name:formatStringFromNameCore('newrecording_facebook', 'app'), glyph:'ffffff', active:(activeactions.share=='facebook'), onClick:chgActionShareFacebook },
								{ name:formatStringFromNameCore('newrecording_twitter', 'app'), glyph:'tttttt', active:(activeactions.share=='twitter'), onClick:chgActionShareTwitter }
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
			gTime = null;
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
						gTime = Date.now();
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

		processAction( { serviceid } );
	},
	upload: function() {
		var { activeactions } = this.props;
		var group = 'upload';
		var serviceid = activeactions[group];

		processAction( { serviceid } );
	},
	share: function() {
		var { activeactions } = this.props;
		var group = 'share';
		var serviceid = activeactions[group];

		if (serviceid == 'twitter') {
			store.dispatch(setDialog([
				{ label: formatStringFromNameCore('newrecording_looping_gif', 'app'), onClick:this.twitterGif },
				{ label: formatStringFromNameCore('newrecording_video', 'app'), onClick:this.twitterVideo },
				{ label: formatStringFromNameCore('cancel', 'app'), onClick:this.dialogCancel }
			]))
		} else {
			processAction( { serviceid } );
		}
	},
	// end - action handlers
	// alert box handler
	dismiss_dispatcher: function(alertid) {
		var { removeAlert } = this.props;
		removeAlert(alertid);
		callInWorker('cancelActionFlow', alertid); // NOTE: alertid is the actionid in my use case in Screencastify link5757
	},
	// dialog onClicks
	twitterGif: function() {
		store.dispatch(destroyDialog());
		processAction({
			serviceid: 'twitter',
			action_options: {
				convert_to_ext: 'gif'
			}
		});
	},
	twitterVideo: function() {
		store.dispatch(destroyDialog());
		processAction({
			serviceid: 'twitter',
			action_options: {
				convert_to_ext: 'mp4'
			}
		});
	},
	dialogCancel: function() {
		store.dispatch(destroyDialog());
	}
});


function processAction(aArg) {
	// sends to worker for processing


	var fr = new FileReader();
	fr.onload = function() {
		aArg.arrbuf = this.result;
		aArg.mimetype = gBlob.type;
		aArg.time = gTime;
		aArg.duration = document.getElementById('video').duration; // seconds
		aArg.__XFER = ['arrbuf'];
		aArg.actionid = Date.now(); // is action_time

		callInWorker('processAction', aArg, function(status, aComm) {
			console.log('back in window after calling processAction, resulting status:', status);
			if (status.__PROGRESS) {
				var updateAlertDict = {};
				// color is either info or warning

				// set color
				updateAlertDict.color = status.reason_code && status.reason_code.startsWith('HOLD_') ? 'warning' : undefined;

				// set glyph
				updateAlertDict.glyph = status.reason_code && status.reason_code.startsWith('HOLD_') ? 'exclamation-sign' : 'info-sign';

				// set dismissible
				updateAlertDict.dismissible = status.reason_code && status.reason_code.startsWith('HOLD_') ? true : false;

				// set body
				updateAlertDict.body = status.reason_code || status.reason || 'Progress for unknown reason';

				// if prefix/suffix is set then include it, if i include it to undefined, it will remove an existing prefix/suffix
				if ('body_prefix' in status) {
					updateAlertDict.body_prefix =  status.body_prefix;
				}
				if ('body_suffix' in status) {
					updateAlertDict.body_suffix =  status.body_suffix;
				}

				store.dispatch(updateAlert(aArg.actionid, updateAlertDict)); // NOTE: alertid is the actionid in my use case in Screencastify link5757
			} else {
				var updateAlertDict = { dismissible:true };
				// color is either success or danger

				// set color
				updateAlertDict.color = status.ok ? 'success' : 'danger';
				if (status.reason_code == 'CANCELLED') {
					updateAlertDict.color = 'warning';
				}

				// set glyph
				updateAlertDict.glyph = status.ok ? 'ok-sign' : 'remove-sign';

				// set body
				updateAlertDict.body = status.reason_code || status.reason || ( status.ok ? 'Success for unknown reason' : 'Failed for unknown reason' );

				// if prefix/suffix is set then include it, if i include it to undefined, it will remove an existing prefix/suffix
				if ('body_prefix' in status) {
					updateAlertDict.body_prefix =  status.body_prefix;
				}
				if ('body_suffix' in status) {
					updateAlertDict.body_suffix =  status.body_suffix;
				}

				store.dispatch(updateAlert(aArg.actionid, updateAlertDict)) // NOTE: alertid is the actionid in my use case in Screencastify link5757
			}
		});

		store.dispatch(addAlert(aArg.actionid, { // NOTE: alertid is the actionid in my use case in Screencastify link5757
			title: aArg.serviceid,
			body: formatStringFromNameCore('newrecording_alertbody_init', 'app'),
			glyph: 'info-sign'
		}));
	};
	fr.readAsArrayBuffer(gBlob);



}

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

var BootstrapAlert = React.createClass({
	dismissClick: function() {
		this.props.dismiss_dispatcher(this.props.alertid);
	},
	openAuthTabClick: function() {
		callInWorker('openAuthTab', this.props.title);
	},
	copyClick: function(e) {
		var data_copy = e.target.getAttribute('data-copy');
		callInBootstrap('copyText', data_copy);
		e.preventDefault(); // so it doesnt jump to hash
		e.stopPropagation();
	},
	launchClick: function(e) {
		var data_launch = e.target.getAttribute('data-launch');
		callInBootstrap('launchUrl', data_launch);
		e.preventDefault(); // so it doesnt jump to hash
		e.stopPropagation();
	},
	opendirClick: function(e) {
		var data_launch = e.target.getAttribute('data-opendir');
		callInBootstrap('expoloreInSystem', data_launch);
		e.preventDefault(); // so it doesnt jump to hash
		e.stopPropagation();
	},
	render: function() {
		var { alertid, glyph, dismiss_dispatcher, color='info', children, title, body, body_prefix, body_suffix } = this.props;

		var cChildren;
 		if (children) {
			cChildren = children;
		} else {
			cChildren = [];
			// setup title
			if (title) {
				if (core.addon.id == 'Screencastify@jetpack') {
					// special for Screencastify
					cChildren.push( React.createElement('strong', undefined, formatStringFromNameCore('newrecording_title_' + title, 'app')) );
				} else {
					// normal - non Screencastify specific
					cChildren.push(React.createElement('strong', undefined, title));
					cChildren.push(' ');
				}
			}

			// setup body
			var body_case = /^[A-Z_]+(?=$|-)/m.exec(body);
			console.log('body_case exec:', body_case);
 			if (core.addon.id == 'Screencastify@jetpack' && body_case) {
 				// create special for Screencastify

				var body_rest;
				if (body_case) {
					body_case = body_case[0];
					var body_rest = body.substr(body_case.length);
					if (body_rest[0] == '-') {
						body_rest = body_rest.substr(1);
					}
				}

				console.log('body_case:', body_case, 'body_rest:', body_rest);

				// non-title specific body
				switch (body_case) {
					case 'CONVERTING_WAIT':
							// CONVERTING_WAIT-gif
							// CONVERTING_WAIT-mp4
							cChildren.push( formatStringFromNameCore('newrecording_alertbody_convwait' + body_rest, 'app') );
						break;
					case 'CONVERTING_FAIL':
							// CONVERTING_FAIL-gif
							// CONVERTING_FAIL-mp4
							cChildren.push( formatStringFromNameCore('newrecording_alertbody_convfail' + body_rest, 'app') );
						break;
					case 'CONVERTING_PROGRESS':
							// CONVERTING_PROGRESS-gif_progress string here
							var body_rest_pt1 = body_rest.substr( 0, body_rest.indexOf('_') );
							var body_rest_pt2 = body_rest.substr( body_rest.indexOf('_')+1 );
							console.log('body_rest_pt1:', body_rest_pt1, 'body_rest_pt2:', body_rest_pt2);

							cChildren.push( formatStringFromNameCore('newrecording_alertbody_convprog' + body_rest_pt1, 'app', [body_rest_pt2]) );
						break;
					case 'HOLD_NEEDS_USER_AUTH':
							// HOLD_NEEDS_USER_AUTH-serviceid
							var servicename = formatStringFromNameCore('newrecording_' + body_rest, 'app');
							cChildren.push( formatStringFromNameCore('newrecording_alertbody_userauth', 'app', [servicename]) );
							cChildren.push( React.createElement( 'a', { href:'javascript:void(0)', className:'alert-link', onClick:this.openAuthTabClick }, formatStringFromNameCore('newrecording_alertbody_openauth', 'app') ) )

						break;
					case 'CANCELLED':
							cChildren.push( formatStringFromNameCore('cancelled', 'app') );
						break;
					case 'FILE_SAVE_SUCCESS_RESULTS':

							var links_json = JSON.parse(body_rest);

							cChildren.push( formatStringFromNameCore('filesave_success', 'app') );
							cChildren.push( React.createElement( 'a', { href:'#', className:'alert-link', onClick:this.launchClick, 'data-launch':links_json.link }, formatStringFromNameCore('newrecording_alertlink_opentab', 'app') ) );
							cChildren.push( React.createElement( 'a', { href:'#', className:'alert-link', onClick:this.opendirClick, 'data-opendir':links_json.link }, formatStringFromNameCore('newrecording_alertlink_opensystem', 'app') ) );
							cChildren.push( React.createElement( 'a', { href:'#', className:'alert-link', onClick:this.copyClick, 'data-copy':links_json.link }, formatStringFromNameCore('newrecording_alertlink_copylink', 'app') ) );
						break;
					case 'UPLOAD_SUCCESS_RESULTS':
							cChildren.push( formatStringFromNameCore('upload_success', 'app') );

							var links_json = JSON.parse(body_rest);

							if (title == 'gfycat' || title == 'gfycatanon') {
								cChildren.push( React.createElement('br') );
								cChildren.push( React.createElement('br') );

								var linkChildren = [];
								for (var p in links_json) {
									cChildren.push( formatStringFromNameCore('newrecording_alert' + p, 'app') );
									cChildren.push( '-' );
									cChildren.push( React.createElement( 'a', { href:'#', className:'alert-link', onClick:this.launchClick, 'data-launch':links_json[p] }, formatStringFromNameCore('newrecording_alertlink_opentab', 'app') ) );
									cChildren.push( '-' );
									cChildren.push( React.createElement( 'a', { href:'#', className:'alert-link', onClick:this.copyClick, 'data-copy':links_json[p] }, formatStringFromNameCore('newrecording_alertlink_copylink', 'app') ) );
									cChildren.push( React.createElement('br') );
								}
							} else {
								cChildren.push( React.createElement( 'a', { href:'#', className:'alert-link', onClick:this.launchClick, 'data-launch':links_json.link }, formatStringFromNameCore('newrecording_alertlink_opentab', 'app') ) );
								cChildren.push( React.createElement( 'a', { href:'#', className:'alert-link', onClick:this.copyClick, 'data-copy':links_json.link }, formatStringFromNameCore('newrecording_alertlink_copylink', 'app') ) );
							}

							if (links_json.link_edit) {
								cChildren.push( React.createElement( 'a', { href:'#', className:'alert-link', onClick:this.launchClick, 'data-launch':links_json.link_edit }, formatStringFromNameCore('newrecording_alertlink_openedit', 'app') ) );
							}

						break;
				}

				// title specific body
				switch (title) {
					case 'gfycatanon':
					case 'gfycat':
							switch (body_case) {
								// case 'UPLOAD_SUCCESS_RESULTS':
								//
								// 	break;
							}
						break;
				}

				if (cChildren.length === 1) {
					// meaning only title inserted, so body was not, so just show the constant
					cChildren.push(body);
				}

 			} else {
				if (body) {
 					cChildren.push( body );
				}
 			}

			// add in body_prefix / body_suffix if there is one
			if (body_prefix) {
				if (title) {
					cChildren.splice( 1, 0, body_prefix ); // acount for `<strong>` title
				} else {
					cChildren.splice( 0, 0, body_prefix );
				}
			}
			if (body_suffix) {
				cChildren.push( body_suffix );
			}

			// put a space between all things
			pushAlternatingRepeating(cChildren, ' ');
 		}

	 	return React.createElement('div', { className: 'alert alert-' + color + (dismiss_dispatcher ? ' alert-dismissible' : ''), role: 'alert' },
			!dismiss_dispatcher ? undefined : React.createElement('button', { className:'close', type:'button', 'data-dismiss':'alert', 'aria-label':formatStringFromNameCore('close', 'app'), onClick:this.dismissClick },
				'\u00D7'
			),
			!glyph ? undefined : React.createElement('span', { className:'glyphicon glyphicon-' + glyph, 'aria-hidden':'true' }),
			!glyph ? undefined : ' ',
			cChildren
		);
	}
});

var ConfirmUI = React.createClass({
	// inspired by https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPromptService#confirmEx_example
	// and https://react-bootstrap.github.io/components.html#buttons-sizes block buttons in well
	componentDidMount: function() {
		setTimeout(function() {
			document.getElementById('confirmui_dialog').style.bottom = '';
		}, 100);
	},
	render: function() {
		var { caption, items } = this.props;
		/*
		caption: string
		items: array[objects]
			{
				label: string
				onClick: function
			}
		*/
		return React.createElement('div', { id:'confirmui_cover' },
			React.createElement('div', { id:'confirmui_dialog', className:'well', style:{bottom:'100vh'} },
				// React.createElement('h3', undefined,
				// 	caption
				// ),
				items.map(item => React.createElement('button', { className:'btn-block btn btn-lg btn-default', onClick:item.onClick },
					item.label
				))
			)
		)
	}
})

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
	// chgActionUploadImgurAnon: () => store.dispatch(changeActiveAction('upload', 'imguranon')),
	// chgActionUploadImgur: () => store.dispatch(changeActiveAction('upload', 'imgur')),
	chgActionUploadGfycatAnon: () => store.dispatch(changeActiveAction('upload', 'gfycatanon')),
	chgActionUploadGfycat: () => store.dispatch(changeActiveAction('upload', 'gfycat')),
	chgActionUploadYoutube: () => store.dispatch(changeActiveAction('upload', 'youtube')),
	chgActionShareFacebook: () => store.dispatch(changeActiveAction('share', 'facebook')),
	chgActionShareTwitter: () => store.dispatch(changeActiveAction('share', 'twitter')),
	//
	removeAlert: alertid => store.dispatch(removeAlert(alertid)),
	addAlert: (alertid, color, title, body) => store.dispatch(addAlert(alertid, color, title, body)),
	updateAlert: (alertid, obj) => store.dispatch(updateAlert(alertid, obj))
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
			activeactions: state.activeactions,
			alerts: state.alerts,
			dialog: state.dialog
		}
	},
	function mapDispatchToProps(dispatch, ownProps) {
		return NewRecordingMemo
	}
)(NewRecordingPage);

// end - react-redux

// testing commapi
// no callback (so obviously no progress), no transfer
function doTestCallBootstrap() {
	callInBootstrap('testCallBootstrapFromContent', 'hi');
}
function doTestCallFramescript() {
	callInFramescript('testCallFramescriptFromContent', 'hi');
}
function doTestCallWorker() {
	callInWorker('testCallWorkerFromContent', 'hi');
}
// no callback (so obviously no progress), just transfer
function doTestCallBootstrap_transfer() {
	var arg = {str:'hi',buf:new ArrayBuffer(10),__XFER:['buf']};
	callInBootstrap('testCallBootstrapFromContent_transfer', arg);
	console.log('arg.buf:', arg.buf);
}
function doTestCallFramescript_transfer() {
	var arg = {str:'hi',buf:new ArrayBuffer(10),__XFER:['buf']};
	callInFramescript('testCallFramescriptFromContent_transfer', arg);
	console.log('arg.buf:', arg.buf);
}
function doTestCallWorker_transfer() {
	var arg = {str:'hi',buf:new ArrayBuffer(10),__XFER:['buf']};
	callInWorker('testCallWorkerFromContent_transfer', arg);
	console.log('arg.buf:', arg.buf);
}

// with callback (no progress), no transfer
function doTestCallBootstrap_justcb() {
	var arg = 'hi';
	callInBootstrap('testCallBootstrapFromContent_justcb', arg, function(aArg, aComm) {
		console.log('back in content, aArg:', aArg, 'arguments:', arguments);
	});
}
function doTestCallFramescript_justcb() {
	var arg = 'hi';
	callInFramescript('testCallFramescriptFromContent_justcb', arg, function(aArg, aComm) {
		console.log('back in content, aArg:', aArg, 'arguments:', arguments);
	});
}
function doTestCallWorker_justcb() {
	var arg = 'hi';
	callInWorker('testCallWorkerFromContent_justcb', arg, function(aArg, aComm) {
		console.log('back in content, aArg:', aArg, 'arguments:', arguments);
	});
}

// with callback (no progress), no transfer, but callback transfers
function doTestCallBootstrap_justcb_thattransfers() {
	var arg = 'hi';
	callInBootstrap('testCallBootstrapFromContent_justcb_thattransfers', arg, function(aArg, aComm) {
		console.log('back in content, aArg:', aArg, 'arguments:', arguments);
	});
}
function doTestCallFramescript_justcb_thattransfers() {
	var arg = 'hi';
	callInFramescript('testCallFramescriptFromContent_justcb_thattransfers', arg, function(aArg, aComm) {
		console.log('back in content, aArg:', aArg, 'arguments:', arguments);
	});
}
function doTestCallWorker_justcb_thattransfers() {
	var arg = 'hi';
	callInWorker('testCallWorkerFromContent_justcb_thattransfers', arg, function(aArg, aComm) {
		console.log('back in content, aArg:', aArg, 'arguments:', arguments);
	});
}
// with callback with progress, transfer to, progress transfers back, and final transfers back to callback
function doTestCallFramescript_cbAndFullXfer() {
	var arg = {str:'hi',bufA:new ArrayBuffer(20),__XFER:['bufA']};
	callInFramescript('testCallFramescriptFromContent_cbAndFullXfer', arg, function(aArg, aComm) {
		if (aArg.__PROGRESS) {
			console.log('PROGRESS back in content, aArg:', aArg, 'arguments:', arguments);
		} else {
			console.log('FINALIZED back in content, aArg:', aArg, 'arguments:', arguments);
		}
	});
	console.log('arg.bufA:', arg.bufA);
}
function doTestCallBootstrap_cbAndFullXfer() {
	var arg = {str:'hi',bufA:new ArrayBuffer(10),__XFER:['bufA']};
	callInBootstrap('testCallBootstrapFromContent_cbAndFullXfer', arg, function(aArg, aComm) {
		if (aArg.__PROGRESS) {
			console.log('PROGRESS back in content, aArg:', aArg, 'arguments:', arguments);
		} else {
			console.log('FINALIZED back in content, aArg:', aArg, 'arguments:', arguments);
		}
	});
	console.log('arg.bufA:', arg.bufA);
}
function doTestCallWorker_cbAndFullXfer() {
	var arg = {str:'hi',bufA:new ArrayBuffer(30),__XFER:['bufA']};
	callInWorker('testCallWorkerFromContent_cbAndFullXfer', arg, function(aArg, aComm) {
		if (aArg.__PROGRESS) {
			console.log('PROGRESS back in content, aArg:', aArg, 'arguments:', arguments);
		} else {
			console.log('FINALIZED back in content, aArg:', aArg, 'arguments:', arguments);
		}
	});
	console.log('arg.bufA:', arg.bufA);
}
// start - common helper functions
function pushAlternatingRepeating(aTargetArr, aEntry) {
	// pushes into an array aEntry, every alternating
		// so if aEntry 0
			// [1, 2] becomes [1, 0, 2]
			// [1] statys [1]
			// [1, 2, 3] becomes [1, 0, 2, 0, 3]
	var l = aTargetArr.length;
	for (var i=l-1; i>0; i--) {
		aTargetArr.splice(i, 0, aEntry);
	}
}
function formatStringFromNameCore(aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements) {
	// 051916 update - made it core.addon.l10n based
    // formatStringFromNameCore is formating only version of the worker version of formatStringFromName, it is based on core.addon.l10n cache

	try { var cLocalizedStr = core.addon.l10n[aLoalizedKeyInCoreAddonL10n][aLocalizableStr]; if (!cLocalizedStr) { throw new Error('localized is undefined'); } } catch (ex) { console.error('formatStringFromNameCore error:', ex, 'args:', aLocalizableStr, aLoalizedKeyInCoreAddonL10n, aReplacements); } // remove on production

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
	// onHandshakeComplete is triggerd when handshake completed and this.putMessage becomes usable
	var scope = gContent;
	var handshakeComplete = false; // indicates this.putMessage will now work
	var port;
	this.nextcbid = 1; // next callback id // its important that min be 1, because lots of places i do a test if (cbid). and if min is 0, then if (cbid) will report a false negative, because indeed it has a cbid. basically i didnt do if ('cbid' in payload).
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
		console.log('content contentComm - incoming, payload:', payload); // , 'e:', e, 'this:', this);

		if (payload.method) {
			if (!(payload.method in scope)) { console.error('method of "' + payload.method + '" not in WINDOW'); throw new Error('method of "' + payload.method + '" not in WINDOW') } // dev line remove on prod
			var rez_win_call__for_fs = scope[payload.method](payload.arg, payload.cbid ? this.reportProgress.bind({THIS:this, cbid:payload.cbid}) : undefined, this);
			// in the return/resolve value of this method call in scope, (the rez_blah_call_for_blah = ) MUST NEVER return/resolve an object with __PROGRESS:1 in it
			console.log('content contentComm - rez_win_call__for_fs:', rez_win_call__for_fs);
			if (payload.cbid) {
				if (rez_win_call__for_fs && rez_win_call__for_fs.constructor.name == 'Promise') {
					rez_win_call__for_fs.then(
						function(aVal) {
							console.log('Fullfilled - rez_win_call__for_fs - ', aVal);
							this.putMessage(payload.cbid, aVal);
						}.bind(this),
						genericReject.bind(null, 'rez_win_call__for_fs', 0)
					).catch(genericCatch.bind(null, 'rez_win_call__for_fs', 0));
				} else {
					this.putMessage(payload.cbid, rez_win_call__for_fs);
				}
			}
		} else if (!payload.method && payload.cbid) {
			// its a cbid
			this.callbackReceptacle[payload.cbid](payload.arg, this);
			if (payload.arg && !payload.arg.__PROGRESS) {
				delete this.callbackReceptacle[payload.cbid];
			}
		} else {
			console.error('contentComm - invalid combination');
			throw new Error('contentComm - invalid combination');
		}
	}.bind(this);
	this.putMessage = function(aMethod, aArg, aCallback) {
		// aMethod is a string - the method to call in framescript
		// aCallback is a function - optional - it will be triggered when aMethod is done calling

		// determine aTransfers
		var aTransfers;
		var xferScope;
		var xferIterable;
		if (aArg) {
			if (aArg.__XFER) {
				xferIterable = aArg.__XFER;
				xferScope = aArg;
			} else if (aArg.a && aArg.m && aArg.a.__XFER) { // special handle for callIn***
				xferIterable = aArg.a.__XFER;
				xferScope = aArg.a;
			}
		}
		if (xferScope) {
			// if want to transfer stuff aArg MUST be an object, with a key __XFER holding the keys that should be transferred
			// __XFER is either array or object. if array it is strings of the keys that should be transferred. if object, the keys should be names of the keys to transfer and values can be anything
			aTransfers = [];
			if (Array.isArray(xferIterable)) {
				for (var p of xferIterable) {
					aTransfers.push(xferScope[p]);
				}
			} else {
				// assume its an object
				for (var p in xferIterable) {
					aTransfers.push(xferScope[p]);
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
		port.postMessage({
			method: aMethod,
			arg: aArg,
			cbid
		}, aTransfers);
	};

	var winMsgListener = function(e) {
		var data = e.data;
		console.log('content contentComm - incoming window message, data:', uneval(data)); //, 'source:', e.source, 'ports:', e.ports);
		switch (data.topic) {
			case 'contentComm_handshake':

					window.removeEventListener('message', winMsgListener, false);
					port = data.port2;
					port.onmessage = this.listener;
					this.putMessage('contentComm_handshake_finalized');
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
// CommAPI Abstraction - content side
function callInFramescript(aMethod, aArg, aCallback) {
	gFsComm.putMessage(aMethod, aArg, aCallback);
}
function callInBootstrap(aMethod, aArg, aCallback) {
	gFsComm.putMessage('callInBootstrap', {
		m: aMethod,
		a: aArg
	},
	aCallback);
}
function callInWorker(aMethod, aArg, aCallback) {
	gFsComm.putMessage('callInWorker', {
		m: aMethod,
		a: aArg
	},
	aCallback);
}
// end - CommAPI
// end - common helper functions

gFsComm = new contentComm(init); // the onHandshakeComplete of initPage will trigger AFTER DOMContentLoaded because MainFramescript only does aContentWindow.putMessage for its new contentComm after DOMContentLoaded see cross-file-link884757009. so i didnt test, but i by doing this here i am registering the contentWindow.addEventListener('message', ...) before it posts. :TODO: i should test what happens if i send message to content first, and then setup listener after, i should see if the content gets that message (liek if it was waiting for a message listener to be setup, would be wonky if its like this but cool) // i have to do this after `var gContent = window` otherwise gContent is undefined
