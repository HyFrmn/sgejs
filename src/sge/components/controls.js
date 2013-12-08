define(['sge/component'], function(Component){
    var ControlsComponent = Component.extend({
        init: function(entity, data){
            this._super(entity, data);
            this.data.speed = data.speed || 128;
        },
        register: function(state){
            this.input = state.input;
        },
        deregister: function(state){
            this.input = undefined;
        },
        tick : function(delta){
            if (this.input===undefined){
                return;
            }
            var dpad = this.input.dpad();
            var xaxis = dpad[0];
            var yaxis = dpad[1];

            vx = this.entity.set('xform.vx', xaxis * this.data.speed);
            vy = this.entity.set('xform.vy', yaxis * this.data.speed);
            //this.entity.set('xform.tx', vx * delta, 'add');
            //this.entity.set('xform.ty', vy * delta, 'add');
        }
    });
    Component.register('controls', ControlsComponent);
    return ControlsComponent;
});
