#SyncRun
syncRun是一个简单的小工具。它通过对异步方法进行简单的封装，来实现异步方法，同步执行的目的。

##例子

	var SyncRun = require( 'syncRun' ).newQueue();

    var sleep = SyncRun(function(s,fn){
    
        setTimeout( fn, s );
    });
    
    var doSth = SyncRun(function(next){
    
        console.log( 'do something here!' );
        next();
    });
    
    var doElseTh = SyncRun(function(){
    
        sleep( 3000, function (){
    
            console.log( 'after 3s, do something else!' );
        });
    });
    
    sleep( 5000, function(){
    
        console.log( '5s passed' );
    } );
    
    doSth();
    
    doElseTh();
    
上面将输出：

	5s passed
	do something here!
	after 3s, do something else!
	
##使用

###安装
 `npm install SyncRun`

###步骤

* 创建一个队列：`var SyncRun = require( 'syncRun' ).newQueue();`
* 创建用于该队列中的方法：`SyncRun（fn）` 其中`fn`为需要封装的方法，SyncRun将返回一个封装好的函数对象
* 按照**同步**执行的思路，以此调用这些方法。
* 支持封装后方法的多重嵌套（比如例子中`doEleseTh`内部使用了封装过的`sleep`）

##说明(重要！)

###所谓的同步

在syncRun中的同步，在外观上并非如同步代码那样的同步。syncRun的同步是这样的：

* 所有在同一个队列中的封装好的方法根据调用顺序，依次执行。一个方法完成后，下一个方法才能执行
* 一个封装过的方法，它所谓的“完成”，包括：方法本身执行完毕，其回调函数执行完毕，所有在其方法执行中或者回调函数执行中被调用的子方法（必须是经过syncRun封装过的方法）执行完毕才被认定为**完成**
* 不同队列中的方法互不影响。

###回调

syncRun的实现中，默认将一个函数的所有参数的最后一个参数（如果这个参数是一个函数对象的话）作为回调，若最后一个参数不是函数对象，则会默认添加一个回调函数。

因此，激活你的队列继续执行的动力之一，便是回调函数的被执行。这一点在使用中需要注意。

对于同步方法（本身没有任何封装的意义，但是如果你一定要封装的话…），由于一般我们不需要给定回调，因此最后一个参数多半也不会是函数，因此在实现中，默认会添加一个空的回调。比如上面的例子中：

	var doSth = SyncRun(function(next){
    
        console.log( 'do something here!' );
        next();
    });
    
这个`doSth`本身是一个同步方法，没有任何异步的操作，我们可以直接通过`doSth()`,来调用。但是为了在它执行后，队列能继续执行，我们需要在函数中执行`next()`