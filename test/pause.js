var SyncMethod = require( '../SyncRun').newQueue();

var fn1 = SyncMethod(function ( next ){

    console.log( 'fn1' );
    setTimeout( next, 100 );
});

fn1(function (){



});

SyncMethod.pause( 2000 );

fn1();