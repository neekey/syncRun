var SyncMethod = require( './index').SyncMethod;

var sleep = SyncMethod( function ( s, fn ){

    setTimeout( fn, s );
});

var sleep2 = SyncMethod( function ( s, fn ){

    setTimeout( fn, s );
});


var sleep3 = SyncMethod( function ( next ){

    sleep( 2000, function (){

        next();
    });
});

var sleep4 = SyncMethod( function ( next ){

    sleep( 2000, function (){

        console.log( 'sleep 4 1');
//        next();
        sleep5(function (){
            console.log( 'sleep 4 1 1');
        });
    });

    sleep( 2000, function (){

        console.log( 'sleep 4 2');


        next();
    });
});

var sleep5 = SyncMethod( function ( next ){

    sleep( 2000, function (){

        console.log( 'sleep 5 1');
    });

    sleep( 2000, function (){

        console.log( 'sleep 5 2');


        next();
    });
});


console.log( sleep3.toString() );


sleep( 5000, function (){

    console.log( 'sleep 1' );

    sleep2( 3000, function (){

        console.log( 'sleep 1.1' );
    });

    sleep3(function (){
        console.log( 'sleep 1.2');
    });

    sleep4(function (){
        console.log( 'sleep 1.2.1');
    });

    sleep2( 2000, function (){

        console.log( 'sleep 1.3' );

        sleep( 2000, function (){

            console.log( 'sleep 1.3.1' );
        });
    });
});

sleep3(function (){
    console.log( 'sleep 2')
});

sleep( 1000, function (){
    console.log( 'sleep 3');

    sleep2( 2000, function (){

        console.log( 'sleep 3.1' );
    });
});

sleep( 1000, function (){
    console.log( 'sleep 4');
});

