/**
 * SyncRun
 */

/**
 *
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

/**
 *
 * @constructor
 */
var EventEmitter = require('events').EventEmitter;
var Util = require('util');

var QueueItemMethod = function ( methodName, method) {

    if( typeof methodName === 'function' ){

        method = methodName;
        methodName = '';
    }
    return (function (method) {

        return function () {

            var newQueueItem = new QueueItem( methodName, method, this, arguments);
            var currentQueueItem = QueueRoot.currentQueueItem;

            currentQueueItem.addChild(newQueueItem);
        };

    })(method);

};

var QueueItem = function ( methodName, method, scope, args, ifRoot) {

    EventEmitter.call(this);
    if (ifRoot) {

        this.root = ifRoot;
        this.currentQueueItem = this;
        this.runningItemCount = 0;

    }
    this.children = [];
    this.isChildRunning = false;
    this.methodName = methodName;
    this.method = method;
    this.arguments = [];
    this.scope = scope;
    this.callback = undefined;
    // 当前子节点执行的索引
//    this.currentChildIndex = 0;
    // 用来标示item及其children是否都执行完毕
    this.isDone = false;
    // 用来标示item自身的method的执行状态
    this.selfStat = 'wait'; // wait | running | done
    this.isCallbackDone = false;
    this.addTime = null;
//    this.dependItem = null;
//    this.commandResult = {};
//    this.customLog = [];

    var self = this;
    var hasCallback = false;
    var proxyCallback;
    var currentArg;

    // 对函数调用时的参数重新进行组装, 添加回调
    for (var i = 0; currentArg = args[i]; i++) {

        // 若最后一个参数为function，则被当做回调函数
        if (typeof currentArg == "function" && i == (args.length - 1)) {

            hasCallback = true;
            this.callback = currentArg;

            // 对回调函数进行封装
            proxyCallback = (function (method) {
                return function (result) {

                    method.call(scope, result);

                    self.isCallbackDone = true;
//                    self.next();
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

                self.isCallbackDone = true;

                self.done();
            };
        })();

        this.arguments.push(proxyCallback);

        this.callback = proxyCallback;
    }

    if (ifRoot) {

        self.on('add', function (item) {

//            console.log('add');
            var child;

            // 检查是否当前已经有item在执行中
            if (self.runningItemCount <= 0) {

                child = self.getNextChild();
            }

            if (item.addTime === 'running' && item.parent.isChildRunning === false ) {

                console.log( 'running add' );
                child = item;
            }

            if (child) {
//                    console.log( 'next child', child.callback.toString() );
                self.emit('runBegin', child);

            }


        });

        self.on('runBegin', function (item) {

//            console.log('run begin');
            self.currentQueueItem = item;
            self.runningItemCount++;
            item.run();

        });

        self.on('runFinished', function (item) {

            item.selfStat = 'done';
            self.currentQueueItem = item;
        });

        self.on('done', function (item) {

//            console.log('done');

            if (item.isDone) {
                self.runningItemCount--;
                item.parent.isChildRunning = false;
            }

            // 检查是否当前已经有item在执行中
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


/**
 *  异步的emit
 */
Extend(QueueItem.prototype, {

    fire:function () {

        var _arguments = arguments;
        var self = this;

        setTimeout(function () {
            QueueRoot.emit.apply(QueueRoot, _arguments);
        }, 0);
    },

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

    addChild:function (item) {

//        console.log('add!');
        // make a reference to its parent so we can travel back
        item.parent = this;

        // 决定addTime
        item.addTime = this.selfStat;

        console.log( this.methodName, ' add child ', item.methodName );

//        item.rootItem = this.rootItem;
//        item.dependItem = this.children[ this.children.length - 1 ] || this.dependItem;

        // add the new item to this childrens list
        this.children.push(item);

        this.fire('add', item);

    },

    done:function () {

        // 若已经完成，则直接跳过，防止反复检查，导致this.parent.next被多次调用
        if (this.isDone) {

            this.fire('done', this);
            return;
        }

        // 递归检查是否所有子节点都已经执行完毕
//        var checkDoneChildren = this.getNextChild();

        // 若还存在子节点，则执行
//        if( checkDoneChildren ){
//
//            console.log( 'children exist: ' );
//            this.isDone = false;
//        }
        // 若节点本身尚未执行，则执行

        if (this.selfStat !== 'done') {

            console.log('self not finished: ', this.commandName);
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


var QueueRoot = new QueueItem('root', function () {
}, {}, [], true);

exports.SyncMethod = QueueItemMethod;