var expect = require( 'expect.js' );

var SyncMethod = require( '../SyncRun').newQueue();
var fn = SyncMethod(function ( next ){
    setTimeout( next, 100 );
});

describe('Additional method for syncRun', function(){

    describe( '#pause(), #run(), #clear() --> #reset()', function(){

        it( 'normal', function( done ){

            var name = undefined;
            var lastName = undefined;

            fn(function(){
                name = 'a';
            });

            fn(function(){
                lastName = name;
                name = 'b';
                this._sync.pause();
            });

            fn(function(){
                lastName = name;
                name = 'c';
            });

            setTimeout(function(){

                expect( lastName ).equal( 'a' );
                expect( name ).equal( 'b' );
                SyncMethod.reset();
                done();

            }, 1000 );

        });

        it( '#pause() with duration', function( done ){

            var name = undefined;
            var lastName = undefined;
            var pauseDuration = 1000;
            var pauseBegin;
            var pauseEnd;
            this.timeout(10000);

            fn(function(){
                name = 'a';
            });

            fn(function(){
                lastName = name;
                name = 'b';
                pauseBegin = Date.now();
                this._sync.pause( pauseDuration );
            });

            fn(function(){
                pauseEnd = Date.now();
                lastName = name;
                name = 'c';
            });

            setTimeout(function(){

                expect( lastName ).equal( 'b' );
                expect( name ).equal( 'c' );
                expect( ( pauseEnd - pauseBegin ) > pauseDuration ).equal( true );
                SyncMethod.reset();
                done();
            }, pauseDuration + 1000 );

        });

        it( 'use #run()', function( done ){

            var name = undefined;
            var lastName = undefined;
            var pauseDuration = 1000;
            var pauseBegin;
            var pauseEnd;
            this.timeout(10000);

            fn(function(){
                name = 'a';
            });

            fn(function(){
                lastName = name;
                name = 'b';
                pauseBegin = Date.now();
                this._sync.pause();

                // The `_sync` will diaper when fn is finish.
                var sync = this._sync;

                setTimeout(function(){
                    sync.run();
                }, pauseDuration );
            });

            fn(function(){
                pauseEnd = Date.now();
                lastName = name;
                name = 'c';
            });

            setTimeout(function(){

                expect( lastName ).equal( 'b' );
                expect( name ).equal( 'c' );
                expect( ( pauseEnd - pauseBegin ) > pauseDuration ).equal( true );
                SyncMethod.reset();
                done();
            }, pauseDuration + 1000 );
        });

        it( '#clear()', function( done ){

            var name = undefined;
            var lastName = undefined;
            var pauseDuration = 1000;
            var pauseBegin;
            var pauseEnd;
            this.timeout(10000);

            fn(function(){
                name = 'a';
            });

            fn(function(){
                lastName = name;
                name = 'b';
                pauseBegin = Date.now();
                this._sync.clear();

                // The `_sync` will diaper when fn is finish.
                var sync = this._sync;

                setTimeout(function(){
                    sync.run();
                    pauseEnd = Date.now();
                }, pauseDuration );
            });

            // Below will not be executed.
            fn(function(){
                lastName = name;
                name = 'c';
            });

            setTimeout(function(){

                expect( lastName ).equal( 'a' );
                expect( name ).equal( 'b' );
                expect( ( pauseEnd - pauseBegin ) >= pauseDuration ).equal( true );
                SyncMethod.reset();
                done();
            }, pauseDuration + 1000 );
        });
    });

    describe( '#get(), #set()', function(){
        
        it( '#set() Using string', function( done ){

            fn(function(){

                this._sync.set( 'name', 'a' );
            });

            fn(function(){

                expect(  'a' ).equal( this._sync.get( 'name' ) );
                this._sync.reset();
                done();
            });
        });

        it( '#set() Using object', function( done ){

            fn(function(){

                this._sync.set( {
                    'name': 'a',
                    'sex': 'female'
                });
            });

            fn(function(){

                expect( 'a' ).equal( this._sync.get( 'name' ) );
                expect( 'female' ).equal( this._sync.get( 'sex' ) );
                this._sync.reset();
                done();
            });
        });
    });
});
