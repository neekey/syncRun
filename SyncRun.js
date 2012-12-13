/**
 * SyncRun 一个简单的异步方法队列化工具。使得改造后的异步方法将顺序执行。
 * @author Neekey<ni184775761@gmail.com>
 * @depends EventEmitter.js ( browser )
 *
 * MIT license
 */

;(function(){

    /**
     * 简单的对象扩展方法
     *
     * @param s
     * @param t
     * @constructor
     */

    var Extend = function (s, t) {

        var name;
        for ( name in t) {
            s[ name ] = t[ name ];
        }
    };

    /**
     * 获取EventEmitter
     *
     * @type {undefined}
     */

    var EE = undefined;
    if( typeof this.EventEmitter == 'undefined' && exports !== 'undefined' && typeof require == 'function' ){
        EE = require( 'events' ).EventEmitter;
    }
    else {
        EE = this.EventEmitter;
    }

    /**
     * 产生新的队列.该方法将返回一个新方法，用这个新方法构造出来的异步方法都将处于一个执行队列中
     *
     * @return {Function} SyncMethod( [methodName], fn );
     */

    var newQueue = function (){

        // 创建一个新的`root`节点.
        var QueueRoot = new QueueItem('root', function () {
        }, {}, [], true);

        var newSyncMethod = (function( root ){

            /**
             * 返回用于构造该队列中的同步方法的方法...
             * 该方法将返回封装后的方法
             *
             * @param {String} [methodName]
             * @param {Function} method
             * @param {Object} 方法执行的上下文
             */

            return function ( methodName, method, scope ) {

                if( typeof methodName === 'function' ){

                    var temp = method;
                    method = methodName;
                    methodName = '';
                    scope = temp;
                }

                methodName = typeof methodName === 'string' ? methodName : '';
                method = typeof method === 'function' ? method : function(){};

                return (function (method) {

                    /**
                     * 此处为实际方法调用时的执行代码
                     */

                    return function () {

                        scope = scope || {};

                        // 从arguments.callee.caller 中获取 `queueItem` 对象，将该对象作为父节点，否则父节点为 `root`
                        var currentCaller = arguments.callee.caller;
                        var parentQueueItem = ( currentCaller ? currentCaller.queueItem : undefined ) || root;

                        /**
                         * 方法被调用的位置，比如是在一个方法的`function body`里面，还是在其回调里面
                         * 若其parent为root，则默认状态为`method`
                         * @type {String} 'method' || 'callback'
                         */

                        var addStat = ( parentQueueItem === root ? 'method' :
                            ( currentCaller ? currentCaller.stat : undefined ) );

                        // 创建一个新的实例化节点.
                        var newQueueItem = new QueueItem( methodName, method, scope, arguments);

                        // 作为子节点添加到父节点中.
                        parentQueueItem.addChild( newQueueItem, addStat );

                        // 提供链式调用的可能
                        return scope;
                    };

                })( method );

            };
        })( QueueRoot );

        newSyncMethod.root = QueueRoot;
        QueueRoot.syncQueue = newSyncMethod;

        return newSyncMethod;
    };

    /**
     * 每个方法执行节点
     *
     * @param methodName 方法名（可选）
     * @param method 方法
     * @param scope 方法执行的上下文
     * @param args 方法执行时的参数 最后一个参数将被视为异步回调
     * @param [ifRoot] 该节点是否作为根节点
     * @constructor
     */

    var QueueItem = function ( methodName, method, scope, args, ifRoot) {

        // 继承EventEmitter
        EE.call(this);

        // 所有子节点
        this.children = [];
        // 记录方法名称
        this.methodName = methodName;
        this.method = method;
        this.arguments = [];
        this.scope = scope;
        this.callback = undefined;
        // 异步回调是否已经被执行
        this.isCallbackDone = false;
        this.isCallbackExecuted = false;
        // 方法是否已经被执行完毕
        this.isMethodDone = false;
        this.isMethodExecuted = false;
        // 节点当前状态 'wait' | 'running' | 'done'
        this.selfStat = 'wait';

        var self = this;
        var hasCallback = false;
        var proxyCallback;
        var currentArg;

        // 直接视最后一个参数为异步回调（如果最后一个参数是函数的话，如果不是则构造一个）
        // 对函数调用时的参数重新进行组装, 添加回调
        for (var i = 0; i < args.length; i++) {

            currentArg = args[ i ];

            // 若最后一个参数为function，则被当做回调函数
            if (typeof currentArg == 'function' && i == (args.length - 1)) {

                hasCallback = true;
                self.callback = currentArg;

                // 对回调函数进行封装
                proxyCallback = (function (method) {

                    /**
                     * QueueItem的回调实际执行方法
                     *
                     * @event QueueItem#callbackExecuted
                     * @event QueueItem#callbackDone
                     */

                    return function (result) {

                        /**
                         * 记录当前children数量，用于检测在回调的执行中是否有新的child增加.
                         * 注意这样只能判断同步执行过去添加的子节点，对于异步添加的则不予考虑，比如：
                         * `command(function(){ var self = this; setTimeout(function(){ self.command2() }, 1000); }`
                         */

                        var curChildrenLen = self.children.length;

                        /**
                         * 将 `queueItem` 添加到method中，这样在method调用中产生的节点可以通过`arguments.callee.caller.queueItem`来获取其parent节点.
                         * 同时备份原有的（如果有的话）`queueItem` 防止覆盖.
                         */

                        var bakQueueItem = method.queueItem;
                        method.queueItem = self;

                        /**
                         * 设置当前节点状态，方便子节点知道自己在什么时候被添加
                         * @type {string}
                         */
                        var bakMethodStat = method.stat;
                        method.stat = 'callback';

                        // 执行回调
                        method.call(scope, result);

                        // 还原
                        method.queueItem = bakQueueItem;
                        method.stat = bakMethodStat;

                        self.emit( 'callbackExecuted' );

                        // 若在回调执行后，没有新的child增加，则说明该回调的过程结束
                        if( self.children.length == curChildrenLen ){
                            self.isCallbackDone = true;
                            self.emit( 'callbackDone' );
                        }

                        /**
                         * 若在回调中出现了子节点，则做一次检查回调是否已经完成的检查:
                         *      因为考虑到如果子节点为纯粹的同步方法的情况，则该方法执行完毕到向当前节点抛出`childDone`事件，
                         *      这些过程都直接同步执行了，但是还没有执行到self.emit( 'callbackExecuted' )这一句，因此当前节点
                         *      的checkDone()将检验失败，也不会继续触发之后的行为。因此当这些都结束执行到这里的时候，发现在回调中
                         *      子节点数量发生了变化，因此也不会到上面的if中去，也就再也不会触发`callbackDone`，因此这边防止这种
                         *      情况的发生，做一次检查。
                         *      注意及时是重复检查也不要紧，因此getNextChildToRun()这个方法只有在有子节点，且没有其他子节点在执行的时候才会运行.
                         */

                        else {
                            if( self.checkCallbackDone() ){
                                self.emit( 'callbackDone' );
                            }
                        }
                    };

                })(currentArg);

                this.arguments.push(proxyCallback);

            }
            else {
                this.arguments.push(currentArg);
            }
        }

        // 若没有给定回调，则创建一个空的回调
        if (!hasCallback) {

            proxyCallback = (function () {
                return function () {
                    self.isCallbackDone = true;
                    self.emit( 'callbackExecuted' );
                    self.emit( 'callbackDone' );
                };
            })();

            self.arguments.push(proxyCallback);
            self.callback = proxyCallback;
        }

        // 绑定事件
        this.attach();
    };

    QueueItem.prototype = new EE();
    Extend(QueueItem.prototype, {

        /**
         * 进行事件绑定.
         */

        attach: function(){

            var self = this;

            /* method被执行过 */

            this.on( 'methodExecuted', function(){
                self.isMethodExecuted = true;
            });

            /* method执行完毕（在method中添加的所有children都执行完毕）*/

            this.on( 'methodDone', function(){
                self.isMethodDone = true;
                if( self.checkDone() ){
                    self.emit( 'done' );
                }
                else {
                    self.getNextChildToRun();
                }
            });

            /* 回调被执行过 */

            this.on( 'callbackExecuted', function(){
                self.isCallbackExecuted = true;
            });

            /* 回调执行完毕（包括所有在回调中添加的children都执行完毕）*/

            this.on( 'callbackDone', function(){
                self.isCallbackDone = true;
                if( self.checkDone() ){
                    self.emit( 'done' );
                }
                else {
                    self.getNextChildToRun();
                }
            });

            /* 某个child执行完毕 */

            this.on( 'childDone', function(){
                if( !self.isMethodDone && self.checkMethodDone() ){
                    self.emit( 'methodDone' );
                }
                else if( !self.isCallbackDone && self.checkCallbackDone() ){
                    self.emit( 'callbackDone' );
                }
                else {
                    self.getNextChildToRun();
                }
            });

            /* 一个新节点被添加到队列 */
            this.on( 'childAdd', function(){
                self.getNextChildToRun();
            });

            /* 当前节点执行完毕 */

            this.on( 'done', function(){
                self.selfStat = 'done';
                // 向父节点发送`childDone`事件
                self.parent.emit( 'childDone', self );
            });
        },

        /**
         * 执行节点的method.
         */
        run:function () {

            var self = this;
            this.selfStat = 'running';

            if( typeof this.method === 'function' ){

                /**
                 * 记录当前children数量，用于检测在回调的执行中是否有新的child增加.
                 * 注意这样只能判断同步执行过去添加的子节点，对于异步添加的则不予考虑，比如：
                 * `command(function( next ){
                 *      var self = this;
                 *      setTimeout(function(){
                 *          self.command2(function(){
                 *              next();
                 *          });
                 *      }, 1000);
                 *  }`
                 *
                 *  实际上，上面的写法，由于是在setTimeout中发起的command2，因此其讲被视为root的child，
                 *  只有其他的root的孩子被执行完毕，它才会被执行，但是command又是依赖next的回调才能结束，因此其实这里构成了死锁.
                 */

                var curChildrenLen = this.children.length;

                /**
                 * 将 `queueItem` 添加到method中，这样在method调用中产生的节点可以通过`arguments.callee.caller.queueItem`来获取其parent节点.
                 * 同时备份原有的（如果有的话）`queueItem` 防止覆盖.
                 */

                var bakQueueItem = this.method.queueItem;
                this.method.queueItem = this;

                /**
                 * 设置当前节点状态，方便子节点知道自己在什么时候被添加.
                 * @type {string}
                 */

                var bakMethodStat = this.method.stat;
                this.method.stat = 'method';

                // 执行方法
                this.method.apply(this.scope, this.arguments);

                // 还原
                this.method.queueItem = bakQueueItem;
                this.method.stat = bakMethodStat;

                this.emit( 'methodExecuted', self );

                if( this.children.length === curChildrenLen ){
                    this.emit( 'methodDone', self );
                }

                /**
                 * 此处的处理和callback的重复检查道理一致
                 */

                else {
                    if( this.checkMethodDone()){
                        this.emit( 'methodDone', self );
                    }
                }
            }
            else {
                this.emit( 'methodExecuted', self );
                this.emit( 'methodDone', self );
            }
        },

        /**
         * 检查：methodExecuted && 所有在method时被添加的child都已经执行完毕.
         *
         * @return {Boolean}
         */

        checkMethodDone: function(){

            var child;
            var index;

            if( !this.isMethodExecuted ){
                return false;
            }

            for( index = 0; child = this.children[ index ]; index++ ){
                if( child.addStat == 'method' && child.checkDone() == false ){
                    return false;
                }
            }

            return true;
        },

        /**
         * 检查：callbackExecuted && 所有在callback中被添加的child都已经执行完毕.
         * @return {Boolean}
         */

        checkCallbackDone: function(){

            var child;
            var index;

            if( !this.isCallbackExecuted ){
                return false;
            }

            for( index = 0; child = this.children[ index ]; index++ ){
                if( child.addStat == 'callback' && child.checkDone() == false ){
                    return false;
                }
            }

            return true;
        },

        /**
         * 检查是否执行完毕.
         * @return {Boolean}
         */

        checkDone: function(){
            return this.selfStat === 'done' || this.checkMethodDone() && this.checkCallbackDone();
        },

        /**
         * 表明一个节点已经执行完毕.
         *
         * @event queueItem#done
         */

        done: function(){

            if( this.checkDone() ){
                this.emit( 'done' );
            }
        },

        /**
         * 获取以当前节点为根节点，下一个需要执行的child节点
         */

        getNextChild:function () {

            var childToRun = null;
            var child;

            for ( var i = 0; child = this.children[ i ]; i++ ) {

                // 若发现有还在执行的没有完成的节点，则返回undefined
                if( !child.checkDone() && child.selfStat === 'running' ){
                    return undefined;
                }
                else if (!child.checkDone() && child.selfStat === 'wait' ) {
                    childToRun = child;
                    break;
                }
            }

            return childToRun;
        },

        /**
         * 让下一个节点执行（在当前还有其他节点，且其他节点都没有在执行的情况下）
         */

        getNextChildToRun: function(){

            var child = this.getNextChild();
            child && child.run();
        },

        /**
         * 添加子节点
         *
         * @event queueItem#childAdd
         * @param item
         * @param {String} addStat
         */

        addChild:function ( item, addStat ) {

            item.parent = this;
            item.root = this.root;
            item.addStat = addStat;
            item.syncQueue = this.syncQueue;
            this.children.push(item);

            this.emit('childAdd', item);
        }
    });

    if (typeof exports !== 'undefined') {
        exports.newQueue = newQueue;
    } else {
        this.SyncRun = { newQueue: newQueue };
    }

})();
