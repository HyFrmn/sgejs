define(['sge/renderer','sge/vendor/when', 'sge/lib/class', 'sge/lib/util'], function(Renderer, when, Class, util){
	function loadImage (src) {
		var deferred = when.defer(),
			img = document.createElement('img');
		img.onload = function () { 
			deferred.resolve(img); 
		};
		img.onerror = function () { 
			deferred.reject(new Error('Image not found: ' + src));
		};
		img.src = src;

		// Return only the promise, so that the caller cannot
		// resolve, reject, or otherwise muck with the original deferred.
		return deferred.promise;
	}

	var Loader = Class.extend({
		init: function(game){
			this.game = game;
		},
		loadImage: function(url, data){
			data = data || {};
			var _loadImage = function(img){
				spriteHeight = 32;
				spriteWidth = 32;

				if (data.size){
					if (data.size[1]!==undefined){
						spriteWidth = data.size[0];
						spriteHeight = data.size[1]
					} else {
						spriteWidth = spriteHeight = data.size;
					}
				}
				if (data.name==undefined){
					var subpath = url.split('/');
            		data.name = subpath[subpath.length-1].split('.')[0];
				}
	            Renderer.SPRITESHEETS[data.name] = new CAAT.SpriteImage().initialize(img, img.height / spriteHeight, img.width / spriteWidth);
			}
            return loadImage(url).then(_loadImage);
		},
		loadJSON: function(url){
			var deferred = new when.defer();
			util.ajax(url, function(raw){
				try {
					data = JSON.parse(raw);
				} catch(err) {
					console.log('JSON Error:', url);
					deferred.reject();
					return
				}
				
				deferred.resolve(data);
			})
			return deferred.promise;
		},
		parseConfig: function(config){

		},

		loadAssets: function(url){
			return this.loadJSON(url).then(this.parseConfig.bind(this));
		},

		updateProgress: function(){
			this._count++;
			this.game._states.loading.updateProgress((this._count/this._countTotal));
		}
	});

	return Loader;
})