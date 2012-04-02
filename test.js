// 队列1
var SyncMethod = require( './SyncRun').newQueue();
// 队列2
var SyncMethod2 = require( './SyncRun').newQueue();

// 这是一个同步方法，需要在定义的时候执行next，但是在调用的时候不必制定next
var syncTest = SyncMethod( function ( next ){

    console.log( 'sync method!' );
    next();
});

// sleep 典型的异步
var sleep = SyncMethod( 'sleep', function ( s, fn ){

    setTimeout( fn, s );
});

// 我们还可以进行嵌套
var sleep2 = SyncMethod( 'sleep2', function ( next ){

    sleep( 2000, function (){

        next();
    });
});

// 多层嵌套并同时有多个
var sleep3 = SyncMethod( 'sleep3', function ( next ){

    sleep( 2000, function (){

        sleep2(function (){
            console.log( 'sleep 3');
        });
    });

    sleep( 2000, function (){

        next();
    });
});

// 这个是队列2的一个简单的异步方法
var sleep4 = SyncMethod2( 'sleep4', function ( s, fn ){

    setTimeout( fn, s );
});

sleep4( 5000, function (){

    console.log( 'queue two 1');

    sleep4( 1000, function (){

        console.log( 'queue two 1.1');
    });
});

sleep( 5000, function (){

    console.log( 'queue one 1' );

    sleep2( function (){

        console.log( 'queue one 1.1' );
    });

    syncTest();

    sleep3(function (){
        console.log( 'queue one 1.2');
    });

    sleep4( 1000, function (){
        console.log( 'queue two 2');
    });

    sleep2( function (){

        console.log( 'queue one 1.3' );

        sleep( 2000, function (){

            console.log( 'queue one 1.3.1' );
        });
    });
});

sleep3(function (){
    console.log( 'queue one 2')
});

sleep( 1000, function (){
    console.log( 'queue one 3');

    sleep2( function (){

        console.log( 'queue one 3.1' );
    });
});

sleep( 1000, function (){
    console.log( 'queue one 4');
});

sleep4( 5000, function (){

    console.log( 'queue two 3');
});

