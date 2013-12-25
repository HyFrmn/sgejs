define(['sge/lib/class', 'sge/vendor/underscore'],
	function(Class, _){

	var Timeout = Class.extend({
		init: function(length, callback){
			this._length = length;
			this.callback = callback;
		},
		tick : function(delta){
			this._length = this._length - delta;
			if (this._length<=0){
				this.callback()
				return false;
			}
			return true;
		}
	})


	var GameState = Class.extend({
		init: function(game, name, options){
			this.game = game;
			this._next_id = 0;
			
			//Elapsed time for this game state. 
			this._time = 0;

			//Keep rendering the main game state beneath this state. (Useful for transparent menus, dialogs etc...)
            this._keepScene = false; 

			this._sceneIndex = game.renderer.scenes.length;

			//Root container for this game state.
			var scene = game.renderer.createScene();
			this.scene = new CAAT.ActorContainer();

			//Padding for scene boundaries.
			var padding = 0;	
			this.scene.setBounds(-padding,-padding,game.renderer.width+padding, game.renderer.height+padding);
			scene.addChild(this.scene);
			
			//Setup input proxies.
			this.input = game.input.createProxy();
			
			//Setup Entity System
			this.entities = {};
			this._entity_ids = [];

            //Setup Spatial Hash
            this._spatialHash = {};
            this._spatialHashReverse = {};
            this._spatialHashWidth = 32; //((this.map.width * 32) / 4);
            this._spatialHashHeight = 32; //((this.map.height * 32) / 4);

			this._name = name;
			
			this.initState(options);
			this._timeouts = [];
			this._killList = [];
		},

		/*
		*  State Based Timeout Controls
		*/
        getTime: function(){
        	return this._time;
        },
		createTimeout : function(length, callback){
			var timeout = new Timeout(length, callback);
			this._timeouts.push(timeout);
			return timeout;
		},
		tickTimeouts : function(delta){
			_.map(this._timeouts, function(t){return t.tick(delta)});
			this._timeouts = _.filter(this._timeouts, function(t){return t._length>0});
		},
		removeTimeout : function(timeout){
			this._timeouts = _.without(this._timeouts, timeout);
			return timeout;
		},

		/*
		*	Lifecycle State Callbacks.
		*
		*	Basic life cycle. A state is created, start-stop cycle, destroyed.
		*/
		initState: function(){

        },
        startState : function(){
        	//console.log('Start:', this._name);
        	this.input.enable = true;
            if (!this._keepScene){
            	this.game.renderer.setScene(this._sceneIndex);
            }
        },
        endState : function(){
        	//console.log('End:', this._name);
        	this.input.enable = false;
        },
        destroyState : function(){
        	
        },



        tick : function(delta){
        	this.tickTimeouts(delta);
        	_.each(this._entity_ids, function(id){
        		var entity = this.entities[id];
        		entity.tick(delta);
        	}.bind(this))
        	_.each(this._entity_ids, function(id){
        		var entity = this.entities[id];
        		entity.componentCall('render', this.game.renderer, 'main');
        	}.bind(this))
        },

        /**
        *	Entity Controls:
        *      Includes creation, deletion, searching.
        */
		getNextId: function(){
			var id = 0;
			while (this._entity_ids.indexOf(id) > -1){
				id++;
			}
			return id;
		},
		addEntity: function(entity){
			var id = this.getNextId();
			entity.id = id;
			this._entity_ids.push(id);
			this.entities[id] = entity;
			entity.state = this;
			entity.register(this);
			this.updateSpatialHash(entity);
			entity.addListener('xform.update', function(){
				this.updateSpatialHash(entity);
			}.bind(this))
			entity.addListener('entity.kill', function(){
                entity.active = false;
                this._killList.push(entity);
                this._removeFromHash(entity);
            }.bind(this))
			return entity;
		},

		getEntity: function(id){
			if (this.entities[id] && this.entities[id].active){
				return this.entities[id];
			}
		},

		getEntities : function(){
			var entities = []
			_.each(this._entity_ids, function(id){
        		entities.push(this.entities[id]);
        	}.bind(this));
        	return entities;
		},

		getEntitiesWithTag: function(tag){
			return _.filter(this.getEntities(), function(e){
				return _.include(e.tags, tag);
			});
		},
		getEntityWithTag: function(tag){
			return _.filter(this.getEntities(), function(e){
				return _.include(e.tags, tag);
			})[0];
		},

		getEntitiesWithComponent: function(comp){
			return _.filter(this.getEntities(), function(e){
				return (e.components[comp]!==undefined);
			});
		},

		removeEntity: function(entity){
			var id = entity.id;
			this._entity_ids = _.without(this._entity_ids, id);
			this.entities[id] = undefined;
			entity.deregister(this);
			entity.id = null;
			entity.state = null;
			return entity;
		},

		updateSpatialHash : function(entity){
            var cx = Math.floor(entity.get('xform.tx') / this._spatialHashWidth);
            var cy = Math.floor(entity.get('xform.ty') / this._spatialHashHeight);
            var hash = cx + '.' + cy;
            if (this._spatialHashReverse[entity.id]!=hash){
                if (this._spatialHashReverse[entity.id]!==undefined){
                    this._removeFromHash(entity);
                }
                if (this._spatialHash[hash]==undefined){
                    this._spatialHash[hash]=[];
                }
                this._spatialHash[hash].push(entity.id);
                this._spatialHashReverse[entity.id] = hash;
    
            } 
        },

        _removeFromHash : function(entity){
            var hash = this._spatialHashReverse[entity.id];
            if (this._spatialHash[hash]){
	            var idx = this._spatialHash[hash].indexOf(entity.id);
				this._spatialHash[hash] = this._spatialHash[hash].splice(1, idx);
	        }
            this._spatialHashReverse[entity.id]=undefined;
        },

        findEntities : function(tx, ty, radius){
            var entities = [];
            var cx = Math.floor(tx / this._spatialHashWidth);
            var cy = Math.floor(ty / this._spatialHashHeight);
            var rad = Math.ceil(radius / 32);
            delta = [[-1, -1], [0, -1], [1, -1],[-1, 0], [0, 0], [1, 0],[-1, 1], [0, 1], [1, 1]];
            for (var j = -rad; j<=rad; j++)
                for (var i = -rad; i <= rad; i++) {
                    var hash = ((cx + i) + '.' + (cy + j));
                    var ids = this._spatialHash[hash];
                     _.each(ids, function(id){
                        var entity = this.getEntity(id);
                        if (!entity){
                        	return;
                        }
                        var ex = entity.get('xform.tx') - tx;
                        var ey = entity.get('xform.ty') - ty;
                        if (((ex*ex)+(ey*ey)) <= (radius*radius)){
                            entities.push(entity);
                        }
                    }.bind(this));
                };
            return entities;
        },
          
	});
	return GameState;
});
