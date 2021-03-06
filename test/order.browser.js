var SyncMethod = SyncRun.newQueue();
var fn = SyncMethod(function ( dur, next ){

    if( typeof dur === 'function' ){
        next = dur;
        dur = 100;
    }
    setTimeout( next, dur );
});

var fn2 = SyncMethod(function(next){
    fn( 1000, next );
});

describe('Order Test', function(){

    describe( 'Order Test', function(){

        it( 'normal', function( done ){

            var queue = [];
            fn(function(){
                queue.push( 'a' );
            });

            fn(function(){
                queue.push( 'b' );
            });

            fn(function(){
                queue.push( 'c' );

                expect( [ 'a', 'b', 'c' ]).eql( queue );
                done();
            });
        });

        it( 'setTimeout', function( done ){

            var queue = [];
            fn(function(){
                queue.push( 'a' );
            });

            setTimeout(function(){
                fn(function(){
                    queue.push( 'b' );
                });

                fn(function(){
                    queue.push( 'c' );

                    expect( [ 'a', 'b', 'c' ]).eql( queue );
                    done();
                });
            }, 100);
        });

        it( 'nest', function( done ){

            var queue = [];
            fn2(function(){
                queue.push( 'a' );
            });

            fn(function(){
                queue.push( 'b' );
            });
            setTimeout(function(){

                fn(function(){
                    queue.push( 'c' );

                    expect( [ 'a', 'b', 'c' ]).eql( queue );
                    done();
                });
            }, 100);
        });
    });
});
