/**
 * SyncRun
 * @author Neekey<ni184775761@gmail.com>
 * 一个简单的异步方法队列化工具。使得改造后的异步方法将顺序执行。
 */

;(function(){

    /**
     *简单的对象扩展方法
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

    var EE = undefined;

    if( typeof this.EventEmitter == 'undefined' && exports !== 'undefined' && typeof require == 'function' ){
        EE = require('events').EventEmitter;
    }
    else {
        EE = this.EventEmitter;
    }

    /**
     * 产生新的队列.该方法将返回一个新方法，用这个新方法构造出来的异步方法都将处于一个执行队列中
     * @return {Function} SyncMethod( [methodName], fn );
     */

    var newQueue = function (){

        // Create an new `root` item.
        var QueueRoot = new QueueItem('root', function () {
        }, {}, [], true);

        // Data used internal.
//        var SyncData = {};

        var newSyncMethod = (function( root ){

            // 返回用于构造该队列中的同步方法的方法...
            // 该方法将返回封装后的方法
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

                    return function () {

                        scope = scope || {};

                        // Use the caller.queueItem as parent, if not found, then set its parent to root.
                        var currentCaller = arguments.callee.caller;
                        var parentQueueItem = ( currentCaller ? currentCaller.queueItem : undefined ) || root;
                        var addStat = ( currentCaller ? currentCaller.stat : undefined );
                        // Instant an new item.
                        var newQueueItem = new QueueItem( methodName, method, scope, arguments);

                        // Set syncQueue reference.
                        newQueueItem.syncQueue = root.syncQueue;

                        // Add this new item to its parent.
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
        // 用来标示item及其children是否都执行完毕
        this.isDone = false;
        // 异步回调是否已经被执行
        this.isCallbackDone = false;
        this.isCallbackExecuted = false;
        // 方法是否已经被执行完毕
        this.isMethodDone = false;
        this.isMethodExecuted = false;

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
                     * @event QueueItem#callbackDone
                     */

                    return function (result) {

                        // 记录当前children数量，用于检测在回调的执行中是否有新的child增加
                        var curChildrenLen = self.children.length;
                        var bakQueue = scope._sync;
                        scope._sync = self.syncQueue;

                        // Add queueItem to method,
                        // so that new queueItem which is created in method can use `arguments.callee.caller.queueItem` to indicated its parent.
                        // And we backup in case of overwrite.
                        var bakQueueItem = method.queueItem;
                        var bakMethodStat = method.stat;
                        method.queueItem = self;
                        method.stat = 'callback';

                        // 执行回调
                        method.call(scope, result);

                        method.queueItem = bakQueueItem;
                        method.stat = bakMethodStat;

                        scope._sync = bakQueue;

                        self.fire( 'callbackExecuted' );

                        // 若在回调执行后，没有新的child增加，则说明该回调的过程结束
                        if( self.children.length == curChildrenLen ){
                            self.isCallbackDone = true;
                            self.fire( 'callbackDone' );
                        }
                    };
                })(currentArg);

                this.arguments.push(proxyCallback);

            }
            else {
                this.arguments.push(currentArg);
            }
        }

        if (!hasCallback) {

            proxyCallback = (function () {
                return function () {
                    self.isCallbackDone = true;
                    self.fire( 'callbackExecuted' );
                    self.fire( 'callbackDone' );
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
         * 进行事件绑定
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
                    self.fire( 'done' );
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
                    self.fire( 'done' );
                }
                else {
                    self.getNextChildToRun();
                }
            });

            /* 某个child执行完毕 */

            this.on( 'childDone', function( child ){

                if( !self.isMethodDone && self.checkMethodDone() ){
                    self.fire( 'methodDone' );
                }
                else if( !self.isCallbackDone && self.checkCallbackDone() ){
                    self.fire( 'callbackDone' );
                }
                else {
                    self.getNextChildToRun();
                }
            });

            /* 当前节点执行完毕 */

            this.on( 'done', function(){
                self.parent.fire( 'childDone', self );
            });
        },

        /**
         * 执行节点的method
         */
        run:function () {

            var self = this;

            this.parent.isChildRunning = true;

            this.selfStat = 'methodRunning';

            if( typeof this.method === 'function' ){

                // Add queueItem to method,
                // so that new queueItem which is created in method can use `arguments.callee.caller.queueItem` to indicated its parent.
                // And we backup in case of overwrite.
                var bakQueueItem = this.method.queueItem;
                var curChildrenLen = this.children.length;
                var bakMethodStat = this.method.stat;

                this.method.stat = 'method';
                this.method.queueItem = this;
                this.method.apply(this.scope, this.arguments);

                this.method.queueItem = bakQueueItem;
                this.method.stat = bakMethodStat;

                this.fire( 'methodExecuted', self );

                if( this.children.length === curChildrenLen ){
                    this.fire( 'methodDone', self );
                }
            }
            else {
                this.fire( 'methodExecuted', self );
                this.fire( 'methodDone', self );
            }
        },

        /**
         * 检查：methodExecuted && 所有在method时被添加的child都已经执行完毕
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
         * 检查：callbackExecuted && 所有在callback中被添加的child都已经执行完毕
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
         * 检查是否执行完毕
         * @return {Boolean}
         */

        checkDone: function(){

            return this.checkMethodDone() && this.checkCallbackDone();
        },

        done: function(){

            if( this.checkDone() ){
                this.isDone = true;
                this.fire( 'done' );
            }
        },

        // 获取以当前节点为根节点，下一个需要执行的child节点
        getNextChild:function () {

            var childToRun = null;
            var child;

            for ( var i = 0; child = this.children[ i ]; i++ ) {

                if (!child.isDone() && child.selfStat === 'wait' ) {
                    childToRun = child;
                    break;
                }
            }

            return childToRun;
        },

        getNextChildToRun: function(){

            var child = this.getNextChild();
            child.run();
        },

        /**
         * 添加子节点
         * @param item
         * @param {String} addStat
         */
        addChild:function ( item, addStat ) {

            item.parent = this;
            item.root = this.root;
            item.addStat = addStat;

            // add the new item to this childrens list
            this.children.push(item);

            this.fire('childAdd', item);
        }
    });


    // Export the Underscore object for **Node.js**, with
    // backwards-compatibility for the old `require()` API.
    if (typeof exports !== 'undefined') {
        exports.newQueue = newQueue;
    } else {
        this.SyncRun = { newQueue: newQueue };
    }

})();
