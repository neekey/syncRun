/**
 * SyncRun
 * @auth Neekey<ni184775761@gmail.com>
 * 一个简单的异步方法队列化工具。使得改造后的异步方法将顺序执行。
 */

(function(){

    /**
     *简单的对象扩展方法
     * @param s
     * @param t
     * @constructor
     */
    var Extend = function (s, t) {

        var name;

        for (name in t) {

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
        var SyncData = {};

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

                        // Use the caller.queueItem as parent, is not found, then set its parent to root.
                        var currentCaller = arguments.callee.caller;
                        var parentQueueItem = ( currentCaller ? currentCaller.queueItem : undefined ) || root;
                        var newQueueItem = new QueueItem( methodName, method, scope, arguments);
                        newQueueItem.syncQueue = root.syncQueue;

                        parentQueueItem.addChild(newQueueItem);

                        // 提供链式调用的可能
                        return scope;
                    };

                })( method );

            };
        })( QueueRoot );

        newSyncMethod.root = QueueRoot;
        QueueRoot.syncQueue = newSyncMethod;

        newSyncMethod.clear = function (){

            QueueRoot.clear();
        };

        // 将pause 的延时settimeout放在done中发出
        newSyncMethod.pause = function ( dur ){

            QueueRoot.pause( dur );
        };

        newSyncMethod.run = function (){

            QueueRoot.goon();
        };

        newSyncMethod.reset = function(){
            QueueRoot.clear();
            QueueRoot.goon();
        };

        newSyncMethod.get = function( key ){
            return SyncData[ key ];
        };

        newSyncMethod.set = function( key, value ){

            if( typeof key === 'string' ){
                SyncData[ key ] = value;
            }
            else if( key.constructor === Object ){
                for( var name in key ){
                    SyncData[ name ] = key[ name ];
                }
            }
        };

        return newSyncMethod;
    };

    /**
     * 每个方法执行节点
     * @param methodName 方法名（可选）
     * @param method 方法
     * @param scope 方法执行的上下文
     * @param args 方法执行时的参数 最后一个参数将被视为异步回调
     * @param ifRoot 该节点是否作为根节点
     * @constructor
     */
    var QueueItem = function ( methodName, method, scope, args, ifRoot) {

        // 继承EventEmitter
        EE.call(this);

        // 若为根节点
        if (ifRoot) {

            this.root = this;
            this.currentQueueItem = this;
            this.runningItemCount = 0;
            this.ifPause = false;
            this.pausedItem = null;
        }

        // 所有子节点
        this.children = [];
        // 是否有子节点处于运行状态
        this.isChildRunning = false;
        this.methodName = methodName;
        this.method = method;
        this.arguments = [];
        this.scope = scope;
        this.callback = undefined;
        // 用来标示item及其children是否都执行完毕
        this.isDone = false;
        // 用来标示item自身的method的执行状态
        this.selfStat = 'wait'; // wait | running | done
        // 异步回调是否已经被执行
        this.isCallbackDone = false;
        // 回调被执行的时刻（selfState的状态）（用于同步方法的激活下一个节点操作时使用）
        this.callbackTime = null;
        // 当前节点被添加的时间（selfState的状态）用于判断子节点是在回调中被添加的还是父节点的方法执行中被添加的
        this.addTime = null;

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
                    return function (result) {

                        self.callbackTime = self.selfStat;

                        var bakQueue = scope._sync;
                        scope._sync = self.syncQueue;

                        // Add queueItem to method,
                        // so that new queueItem which is created in method can use `arguments.callee.caller.queueItem` to indicated its parent.
                        // And we backup in case of overwrite.
                        var bakQueueItem = method.queueItem;
                        method.queueItem = self;

                        method.call(scope, result);

                        method.queueItem = bakQueueItem;


                        scope._sync = bakQueue;

                        self.isCallbackDone = true;
                        self.done();
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
                return function (result) {

                    self.callbackTime = self.selfStat;
                    self.isCallbackDone = true;

                    self.done();
                };
            })();

            self.arguments.push(proxyCallback);

            self.callback = proxyCallback;
        }

        // 若为根节点，还需要做一些绑定
        if (ifRoot) {

            // 当一个节点被添加
            self.on('add', function (item) {

                if( self.ifPause ){

                    return;
                }

                var child;

                // 若当前没有节点在执行，则寻找一个节点，执行它
                if (self.runningItemCount <= 0) {

                    child = self.getNextChild();
                }

                // 若一个节点是在父节点running的时候被add的，且该父节点没有其他子节点在巡行，则执行该子节点
                if (item.addTime === 'running' && item.parent.isChildRunning === false ) {

                    child = item;
                }

                if (child) {

                    // 此处是同步的emit
                    self.emit('runBegin', child);
                }
            });

            // 一个节点开始执行
            self.on('runBegin', function (item) {

                self.currentQueueItem = item;
                self.runningItemCount++;
                item.run();

            });

            // 一个节点的method执行完毕
            self.on('runFinished', function (item) {

                item.selfStat = 'done';
                self.currentQueueItem = item;

                // 若一个节点的回调函数在该节点的method执行期间被调用（这个节点应该是一个同步方法），则检查该节点是否完毕
                if( item.callbackTime === 'running' ){

                    item.done();
                }
            });

            // 一个节点执行完毕
            self.on('done', function (item) {

                // 若队列被pause
                if( self.ifPause ){
                    return;
                }

                if (item.isDone) {
                    self.runningItemCount--;
                    item.parent.isChildRunning = false;
                }

                // 检查是否当前已经有item在执行中
                // 若有节点在执行，再检查当前节点是否是在父节点method执行的时候被添加（因此该子节点完毕，其附件点未必完毕），是的话就继续找下一个可以运行的节点（比如兄弟节点）
                if (self.runningItemCount <= 0 || ( item.addTime === 'running' && item.parent.isChildRunning === false )) {


                    var child = self.getNextChild();
                    if (child) {

                        self.emit('runBegin', child);

                    }
                }
            });
        }

    };

    QueueItem.prototype = new EE();
    Extend(QueueItem.prototype, {

        /**
         *  异步的emit
         */
        fire:function () {

            var _arguments = arguments;
            var self = this;

            setTimeout(function () {
                self.root.emit.apply(self.root, _arguments);
            }, 0);
        },

        /**
         * 执行节点的method
         */
        run:function () {

            var self = this;

            this.parent.isChildRunning = true;

            this.selfStat = 'running';

            if( typeof this.method === 'function' ){

                // Add queueItem to method,
                // so that new queueItem which is created in method can use `arguments.callee.caller.queueItem` to indicated its parent.
                // And we backup in case of overwrite.
                var bakQueueItem = this.method.queueItem;

                this.method.queueItem = this;
                this.method.apply(this.scope, this.arguments);

                this.method.queueItem = bakQueueItem;
            }

            this.selfStat = 'done';

            this.fire('runFinished', self);
        },

        goon: function (){

            this.root.ifPause = false;

            if( this.pausedItem ){
                this.pausedItem.fire( 'done', this.pausedItem );
            }
        },

        pause: function ( dur ){

            this.root.ifPause = true;
            this.root.pausedItem = this.root.currentQueueItem;
            var self = this;

            dur = parseInt( dur );

            if( !isNaN( dur ) && dur > 0 ){

                setTimeout( function (){

                    self.goon();

                }, dur );
            }
        },

        /**
         * Clear all its children.
         * This method should not effect the method (include itself) that is already running.
         */
        clear: function(){
            this.children.forEach(function( child ){
                child.clear();
            });
            this.children = [];

            if( this.root === this ){
                this.currentQueueItem = this.root;
                this.runningItemCount = 0;
                this.pausedItem = null;
            }
        },

        // 获取以当前节点为根节点，下一个需要执行的child节点
        getNextChild:function () {

            var childToRun = null;
            var child;

            for (var i = 0; child = this.children[ i ]; i++) {

                if (!child.isDone && child.selfStat === 'wait' ) {
                    childToRun = child;

                    break;
                }
                else {
                    childToRun = child.getNextChild();

                    if (childToRun) {
                        break;
                    }
                }
            }

            return childToRun;
        },

        /**
         * 添加子节点
         * @param item
         */
        addChild:function (item) {

            item.parent = this;
            item.root = this.root;
            item.addTime = this.selfStat;

            // add the new item to this childrens list
            this.children.push(item);

            this.fire('add', item);
        },

        /**
         * 检查当前节点是否已经完全结束
         */
        done:function () {

            // 若已经完成，则直接跳过，防止反复检查
            if (this.isDone) {

                this.fire('done', this);
                return;
            }

            if (this.selfStat !== 'done') {

                this.isDone = false;
            }
            else this.isDone = this.isCallbackDone !== false;

            this.fire('done', this);
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
