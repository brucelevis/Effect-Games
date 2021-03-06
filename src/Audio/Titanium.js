// Effect Games Engine v1.0
// Copyright (c) 2005 - 2011 Joseph Huckaby
// Source Code released under the MIT License: 
// http://www.opensource.org/licenses/mit-license.php

////
// Titanium.js
// Provides native audio services through Titanium
// http://www.codestrong.com/titanium/
// DHTML Game Engine 1.0 (EffectGames.com)
////

function _TitaniumAudioHandler() {
	// partial class definition that is merged in with _AudioHandler
	// if native audio is to be used
};

_TitaniumAudioHandler.prototype._getLoadProgress = function() {
	// get progress of tracks still loading
	// result will be between 0.0 and 1.0
	if (!this.enabled) return 1.0;
	
	var _total = 0;
	var _count = 0;
	
	for (var _key in this._tracks) {
		var _track = this._tracks[_key];
		if (!_track.ignore) {
			_total += _track._get_load_progress();
			_count++;
		}
	}
	
	return (_count > 0) ? (_total / _count) : 1.0;
};

_TitaniumAudioHandler.prototype._resetProgress = function() {
	// set current state as zero progress, for subsequent
	// loads of additional content
	for (var _key in this._tracks) {
		var _track = this._tracks[_key];
		_track.ignore = true;
	}
};

_TitaniumAudioHandler.prototype._setup = function(_callback) {
	// setup audio
	if (!this.enabled) return;
	
	this.setHandler('onLoad', _callback);
	this.fireHandler('onLoad');
};

//
// _TitaniumAudioTrack Class
//

function _TitaniumAudioTrack() {
	// partial class definition that is merged in with _AudioTrack
	// if flash is to be used
};

_TitaniumAudioTrack.prototype = new _EventHandlerBase();

_TitaniumAudioTrack.prototype._init = function() {
	// initialize sound settings
	if (!this._handler.enabled) return;
	assert(this._movies[0] && this._movies[0].play, "Audio object not loaded");
	
	for (var idx = 0, len = this._numMovies; idx < len; idx++) {
		this._movies[idx].volume = this._getAdjVolume();
	}
};

_TitaniumAudioTrack.prototype.playSound = function() {
	// play sound as effect
	// cycles through multiplex sounds round-robin style
	if (!this._handler.enabled || !this._getCategorySettings().enabled) return this;
	
	var _movie = this._movies[this._movieIdx];
	this._movieIdx++;
	if (this._movieIdx >= this._numMovies) this._movieIdx = 0;
	
	// movie.pause();
	if (_movie.isPlaying()) _movie.stop();
	// if (ua.ff && (_movie.readyState != 4)) _movie.load(); 
	_movie.play();
	
	return this; // for chaining commands
};

_TitaniumAudioTrack.prototype.play = function() {
	// send Play command to current audio track
	// does not support multiplex, this is for single track sounds (music)
	if (!this._handler.enabled || !this._getCategorySettings().enabled) return this;
	
	if (!this._movies[0].isPlaying()) this._movies[0].play();
	return this; // for chaining commands
};

_TitaniumAudioTrack.prototype.stop = function() {
	// send Stop command to current audio track
	// stops all multiplexed sounds for track
	if (!this._handler.enabled) return this;
	
	for (var _idx = 0, _len = this._numMovies; _idx < _len; _idx++) {
		if (this._movies[_idx].isPlaying()) this._movies[_idx].pause();
	}
	
	this._playing = false;
	
	return this; // for chaining commands
};

_TitaniumAudioTrack.prototype.rewind = function() {
	// send Rewind command to current audio track
	// does not support mulitplex, is only for single track sounds (music)
	if (!this._handler.enabled) return this;
	if (this._movies[0].isPlaying()) this._movies[0].stop();
	return this; // for chaining commands
};

_TitaniumAudioTrack.prototype.setVolume = function(_newVolume) {
	// set volume for this track
	// sets for all multiplex sounds
	if (!this._handler.enabled) return this;
	
	if (_newVolume < 0) _newVolume = 0;
	else if (_newVolume > 1.0) _newVolume = 1.0;
	
	this.volume = _newVolume;
	
	for (var idx = 0, len = this._numMovies; idx < len; idx++) {
		this._movies[idx].setVolume( this._getAdjVolume() );
	}
	
	return this; // for chaining commands
};

_TitaniumAudioTrack.prototype.setBalance = function(_newBalance) {
	// set balance for this track
	if (!this._handler.enabled) return this;
	
	if (_newBalance < -1.0) _newBalance = -1.0;
	else if (_newBalance > 1.0) _newBalance = 1.0;
	
	this.balance = _newBalance;
	var adjBalance = this._getAdjBalance();
	
	// UNSUPPORTED IN NATIVE AUDIO
	
	return this; // for chaining commands
};

_TitaniumAudioTrack.prototype.isPlaying = function() {
	// return true if track is playing, false if stopped
	return !!this._playing; 
};

_TitaniumAudioTrack.prototype.getPosition = function() {
	// return current time offset into track (hi-res seconds)
	// Titanium does not support this.
	return -1;
};

_TitaniumAudioTrack.prototype.setPosition = function(_pos) {
	// set the time offset into track (hi-res seconds)
	// Titanium does not support this.
	return this;
};

_TitaniumAudioTrack.prototype.load = function() {
	// load track
	if (!this._handler.enabled) return '';
		
	this._mediaURL = this.url.match(/^\w+\:\/\//) ? this.url : (gGame.getGamePath() + this.url);
	debugstr("Loading audio track: " + this._id + " (" + this._mediaURL + ")");
	
	this._loadStart = _now_epoch();
	this.progress = 0;
	this.loading = true;
	this._playing = false;
	this._numMovies = this.multiplex ? 4 : 1;
	this._movieIdx = 0;
	this._movies = [];
	
	for (var idx = 0, len = this._numMovies; idx < len; idx++) {
		var _movie = this._movies[idx] = Titanium.Media.createSound( 'app://assets' + this.url );
		_movie.setVolume( this._getAdjVolume() );
		_movie.setLooping( this.loop ? true : false );
	}
	
	var _movie = this._movies[0];
	var _clip = this;
	
	_movie.onComplete( function() {
		// sound has reached its end, check for loop
		Debug.trace('audio', _clip._id + ": Sound reached end");
		_clip._playing = false;
		_clip.fireHandler( 'ended' );
	} );
	
	_clip.progress = 1.0;
	_clip.loading = false;
};

_TitaniumAudioTrack.prototype._get_load_progress = function() {
	// get load progress (0.0 to 1.0)
	return this.progress || 0;
};
