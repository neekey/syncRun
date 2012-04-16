/**
 * SyncRun
 * @auth Neekey<ni184775761@gmail.com>
 * 一个简单的异步方法队列化工具。使得改造后的异步方法将顺序执行。
 */

//todo 关于同步方法还需要再思考
/* todo 需要一个方法在不同的异步方法之间传递变量,比如

    getA = SyncRun(function ( next ){

        setTimeout(function (){
            SyncRun.save({ a: 'neekey' });
            next();
        }, 5000 );
    });

    getA();

    a = SyncRun.get( 'a', function ( a ){

        console.log( 'a is', a );  // neekey
    });

    console.log( a ); // undefined

 */
// todo 队列的退出 或者暂停 或者继续

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

var EventEmitter = require('events').EventEmitter;
var Util = require('util');

/**
 * 产生新的队列.该方法将返回一个新方法，用这个新方法构造出来的异步方法都将处于一个执行队列中
 * @return {Function} SyncMethod( [methodName], fn );
 */
var newQueue = function (){

    // 新建队列根节点
    var QueueRoot = new QueueItem('root', function () {
    }, {}, [], true);

    return (function( root ){

        // 返回用于构造该队列中的同步方法的方法...
        // 该方法将返回封装后的方法
        return function ( methodName, method, scope ) {

            if( typeof methodName === 'function' ){

                var temp = method;
                method = methodName;
                methodName = '';
                scope = method;
            }

            methodName = typeof methodName === 'string' ? methodName : '';
            method = typeof method === 'function' ? method : function(){};

            return (function (method) {

                return function () {

                    scope = scope || this;

                    var newQueueItem = new QueueItem( methodName, method, scope, arguments);
                    var currentQueueItem = root.currentQueueItem;

                    currentQueueItem.addChild(newQueueItem);

                    // 提供链式调用的可能
                    return scope;
                };

            })( method );

        };
    })( QueueRoot );
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
    EventEmitter.call(this);

    // 若为根节点
    if (ifRoot) {

        this.root = this;
        this.currentQueueItem = this;
        this.runningItemCount = 0;
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
        if (typeof currentArg == "function" && i == (args.length - 1)) {

            hasCallback = true;
            self.callback = currentArg;

            // 对回调函数进行封装
            proxyCallback = (function (method) {
                return function (result) {

                    self.callbackTime = self.selfStat;

                    method.call(scope, result);

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

//            console.log('add');
            var child;

            // 若当前没有节点在执行，则寻找一个节点，执行它
            if (self.runningItemCount <= 0) {

                child = self.getNextChild();
            }

            // 若一个节点是在父节点running的时候被add的，且该父节点没有其他子节点在巡行，则执行该子节点
            if (item.addTime === 'running' && item.parent.isChildRunning === false ) {

//                console.log( 'running add' );
                child = item;
            }

            if (child) {
//                    console.log( 'next child', child.callback.toString() );

                // 此处是同步的emit
                self.emit('runBegin', child);
            }
        });

        // 一个节点开始执行
        self.on('runBegin', function (item) {

//            console.log('run begin');
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

//            console.log('done');

            if (item.isDone) {
                self.runningItemCount--;
                item.parent.isChildRunning = false;
            }

            // 检查是否当前已经有item在执行中
            // 若有节点在执行，再检查当前节点是否是在父节点method执行的时候被添加（因此该子节点完毕，其附件点未必完毕），是的话就继续找下一个可以运行的节点（比如兄弟节点）
            if (self.runningItemCount <= 0 || ( item.addTime === 'running' && item.parent.isChildRunning === false )) {


                var child = self.getNextChild();
                if (child) {

//                    console.log('next child');
                    self.emit('runBegin', child);

                }
            }
        });
    }

};

Util.inherits(QueueItem, EventEmitter);


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
        typeof this.method === 'function' && this.method.apply(this.scope, this.arguments);
        this.selfStat = 'done';

        this.fire('runFinished', self);
    },

    // 获取以当前节点为根节点，下一个需要执行的child节点
    getNextChild:function () {

        var childToRun = null;
        var child;

        for (var i = 0; child = this.children[ i ]; i++) {

//            console.log( child.callback.toString());

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

//        console.log('add!');
        item.parent = this;
        item.root = this.root;
        item.addTime = this.selfStat;

//        console.log( this.methodName, ' add child ', item.methodName );

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

//            console.log('self not finished: ', this.methodName);
            this.isDone = false;
        }
        else if (this.isCallbackDone === false) {

            this.isDone = false;
        }
        else {

            this.isDone = true;
        }

        this.fire('done', this);

    }
});

exports.newQueue = newQueue;