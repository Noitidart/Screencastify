alert('hi from hidden contentscript');
var Stream;
alert('hi');
var param = {
	video: true
};
navigator.mediaDevices.getUserMedia(param).then(function(stream) {
	console.log('success');
	Stream = stream;
	console.log('Stream:', Stream);
})
.catch(function(err) {
	console.error('err:', err)
});
