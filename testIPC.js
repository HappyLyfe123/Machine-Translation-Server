var ipc = require('node-ipc');

ipc.connectTo( 'MonitorServer', () => {
        ipc.of.MonitorServer.on( 'connect', function(){
                ipc.log('## connected to world ##'.rainbow, ipc.config.delay);
                ipc.of.MonitorServer.emit('message', 'hello');
            }
        );
    }
);