var SyncMethod = require( '../SyncRun').newQueue();
var log = function(){ console.log.apply( console, arguments ); };

var fn1 = SyncMethod(function ( next ){

    console.log( 'fn1' );
    setTimeout( next, 100 );
});

fn1(function (){
    log( 'a' );
    this._sync.set({ name: 'a' });
});

fn1(function(){
    log( this._sync.get( 'name' ) );
});

fn1(function (){

    if( this._sync.get( 'name' ) === 'a' ){
        this._sync.set( 'name', 'c' );
    }
    else {
        this._sync.set( 'name', 'd' );
    }
});

fn1(function(){
    log( this._sync.get( 'name' ) );
});