var expect = require( 'expect.js' );
var SyncMethod = require( '../SyncRun').newQueue();

/**
 * 同步方法
 * @param next
 */
var syncFunc = SyncMethod(function( next ){
    next();
});

/**
 * 一般的异步回调
 */

var asyncFunc = SyncMethod(function ( dur, next ){

    if( typeof dur === 'function' ){
        next = dur;
        dur = 100;
    }
    setTimeout( next, dur );
});

/**
 * 嵌套一个被改装过的方法
 */

var compositedFunc = SyncMethod(function(next){
    asyncFunc( 10, next );
});

var complexFunc = SyncMethod(function( next ){

    var queue = [];

    asyncFunc( 10, function(){
        queue.push( 'a' );
    });
    syncFunc(function(){
        queue.push( 'b' );
    });

    asyncFunc(10,function(){
        queue.push( 'c' );
        syncFunc(function(){
            queue.push( 'd' );
        });
    });

    syncFunc(function(){
        queue.push( 'e' );
        asyncFunc(10, function(){
            queue.push( 'f' );
        });
    });

    compositedFunc(function(){
        queue.push( 'g' );

        asyncFunc( 10, function(){
            queue.push( 'h' );
        });
        syncFunc(function(){
            queue.push( 'i' );
        });

        compositedFunc(function(){
            queue.push( 'j' );
        });

        compositedFunc(function(){
            queue.push( 'k' );

            asyncFunc( 10, function(){
                queue.push( 'm' );

                compositedFunc(function(){
                    queue.push( 'n' );
                    compositedFunc(function(){
                        queue.push( 'o' );
                    });
                });
            });
            syncFunc(function(){
                queue.push( 'p' );
                compositedFunc(function(){
                    queue.push( 'q' );
                });
                compositedFunc(function(){
                    queue.push( 'r' );
                });
            });
        });
    });

    syncFunc(function(){
        queue.push( 's' );
        syncFunc(function(){
            queue.push( 't' );

            compositedFunc(function(){
                queue.push( 'u' );
            });

            compositedFunc(function(){
                queue.push( 'v' );
                compositedFunc(function(){
                    queue.push( 'w' );

                    asyncFunc( 10, function(){
                        queue.push( 'x' );
                    });
                    syncFunc(function(){
                        queue.push( 'y' );
                    });
                });
            });
        });
    });

    asyncFunc(function(){
        queue.push( 'z' );
        next( queue.join('') );
    });
});



describe('Order Test', function(){

    describe( 'Order Test', function(){

        it( 'sync function', function( done ){

            var queue = [];
            syncFunc(function(){
                queue.push( 'a' );
            });

            syncFunc(function(){
                queue.push( 'b' );
            });

            syncFunc(function(){
                queue.push( 'c' );
                expect( [ 'a', 'b', 'c' ]).eql( queue );
                done();
            });
        });

        it( 'Async function', function( done ){

            var queue = [];
            asyncFunc(function(){
                queue.push( 'a' );
            });

            asyncFunc(function(){
                queue.push( 'b' );
            });

            asyncFunc(function(){
                queue.push( 'c' );
                expect( [ 'a', 'b', 'c' ]).eql( queue );
                done();
            });
        });
        
        it( 'mix Sync and Async', function( done ){

            var queue = [];
            asyncFunc(function(){
                queue.push( 'a' );
            });

            syncFunc(function(){
                queue.push( 'b' );
            });

            asyncFunc(function(){
                queue.push( 'c' )
            });

            syncFunc(function(){
                queue.push( 'd' );
                expect( [ 'a', 'b', 'c', 'd' ]).eql( queue );
                done();
            })
        });

        it( 'nested call', function( done ){

            var queue = [];

            asyncFunc(function(){

                queue.push( 'a' );
                asyncFunc(function(){
                    queue.push( 'b' );
                });
            });

            asyncFunc(function(){

                queue.push( 'c' );
                syncFunc(function(){
                    queue.push( 'd' );
                });
            });

            asyncFunc(function(){

                queue.push( 'e' );
                syncFunc(function(){
                    queue.push( 'f' );
                })
            });

            syncFunc(function(){

                queue.push( 'g' );
                asyncFunc(function(){
                    queue.push( 'h' );
                })
            });

            asyncFunc(function(){

                queue.push( 'i' );
                syncFunc(function(){
                    queue.push( 'j' );
                    asyncFunc(function(){
                        queue.push( 'k');
                    });
                });

                asyncFunc(function(){
                    queue.push( 'm' );
                    syncFunc(function(){
                        queue.push( 'n' );
                    });
                });
            });

            syncFunc(function(){

                queue.push( 'o' );
                asyncFunc(function(){
                    queue.push( 'p' );
                    syncFunc(function(){
                        queue.push( 'q');
                    });
                });

                syncFunc(function(){
                    queue.push( 'r' );
                    asyncFunc(function(){
                        queue.push( 's' );

                        syncFunc(function(){
                            queue.push( 't' );
                            expect('abcdefghijkmnopqrst'.split( '')).eql( queue );
                            done();
                        });
                    });
                });
            });
        });

        it( 'setTimeout', function( done ){

            var queue = [];
            asyncFunc(function(){
                queue.push( 'a' );
            });

            setTimeout(function(){
                asyncFunc(function(){
                    queue.push( 'c' );
                });
            }, 100);

            setTimeout(function(){
                syncFunc(function(){
                    queue.push( 'e' );
                    expect( [ 'a', 'b', 'c', 'd', 'e' ]).eql( queue );
                    done();
                });
            }, 1000);

            asyncFunc(function(){
                queue.push( 'b' );
                setTimeout(function(){
                    syncFunc(function(){
                        queue.push( 'd' );
                    })
                }, 500);
            });
        });

        it( 'composition', function( done ){

            var queue = [];
            var vocabularyList = [];
            var queue2 = [];
            compositedFunc(function(){
                queue.push( 'a' );

                asyncFunc(function(){
                    queue.push( 'b' );
                });

                syncFunc(function(){
                    queue.push( 'c' );
                });

                compositedFunc(function(){
                    queue.push( 'd' );

                    asyncFunc(function(){
                        queue.push( 'e' );
                    });

                    syncFunc(function(){
                        queue.push( 'f' );
                    });
                });

                compositedFunc(function(){
                    queue.push( 'g' );
                    expect( 'abcdefg'.split('')).eql( queue );
                });
            });

            complexFunc(function( v ){
                queue2.push( 'a' );
                vocabularyList.push( v );

                asyncFunc(10, function(){
                    queue2.push( 'b' );

                    complexFunc(function( v ){
                        queue2.push( 'c' );
                        vocabularyList.push( v );

                        syncFunc(function(){
                            queue2.push( 'd' );
                            complexFunc(function( v ){
                                vocabularyList.push( v );
                            });
                        });
                    });

                    complexFunc(function( v ){
                        queue2.push( 'e' );
                        vocabularyList.push( v );
                        expect( 'abcde'.split('') ).eql( queue2 );
                        expect( vocabularyList.join( '' )).eql( [ v, v, v, v ].join(''));
                        done();
                    });
                });
            });
        });
    });
});
