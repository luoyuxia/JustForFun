'use strict';

/* Controllers */



var helloWorldControllers = angular.module('helloWorldControllers', []).factory('socket',function ($rootScope) {
    var socket = io.connect('/');
    return {
        on: function (eventName, callback) {
            //如果对应的事件已经存在，直接返回，不再重复添加
            for(var listener in socket._callbacks)
            {
                if(listener == '$'+eventName)
                {
                    socket._callbacks[listener] = null;
                    break;
                }
            }
            socket.on(eventName, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args)
                })
            })

        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args)
                    }
                })
            })
        },
    }
}).run(function($rootScope,$window,socket,$http) {
    $rootScope.hasLogin = false;
    $rootScope.currentUserId = 0;
    $rootScope.joinedRoom = "";
    $rootScope.username = "";
    $rootScope.messages = [];
    $rootScope.roomusers = [];
    //当前在与谁私聊
    $rootScope.privateChatUser = null;
    //当前的私聊记录，格式一个为 privateRecord{sender_name:'string',sendTime: 'datetime',content:'string",isReceive:bool(是否是收到来自其他人的信息)}
    $rootScope.privateChatRecords = [];
    //新信息的数目
  //  $rootScope.new_message_nums = 0;
    // 信息的简要描述
    $rootScope.messages_info = [];

    $rootScope.personalImage ="default";

    //是否在聊天界面
    $rootScope.isInChatPage = false;
    //messages_info {sender_name,sender_id,send_time}
    //新信息的简要描述
    //brief_message {sender:"username",messageContent:"message"}
  //  $rootScope.brief_message = [];
    window.onbeforeunload = function(){
        if($rootScope.joinedRoom!="" && $rootScope.currentUserId != 0) {
            socket.emit('leave_room', {
                room: $rootScope.joinedRoom, user: {
                    userId: $rootScope.currentUserId,
                    username: $rootScope.username
                }
            })
        }
        if($rootScope.hasLogin)
        {
           $http.get('/api/logout', {
            headers: {'Authorization': 'Basic ' + btoa(token+":")}
        });
        }
    }
}).directive('autoScrollToBottom',function () {
    return{
        link:function (scope,element,attrs) {
            scope.$watch(
                function () {
                    return element.children().length;
                },function () {
                    element.animate({
                        scrollTop:element.prop('scrollHeight')
                    },1000);
                }
            );
        }
    };
}).directive('autoScroll', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs, ctrls) {
            var scrollToBottom = function () {
                element[0].scrollTop = element[0].scrollHeight;
            };
            scope.$watchCollection('messages', scrollToBottom);
            scope.$watchCollection('privateChatRecords',scrollToBottom);
        }
    };
});



// 登录控制器
helloWorldControllers.controller('LoginCtrl',['$scope','$http','$modal','$rootScope','socket','$location',
    function ($scope,$http,$modal,$rootScope,socket,$location) {
        $scope.login = function () {
        var modalInstance = $modal.open({
            templateUrl : 'partials/loginModal.html',
            animation:true,
            controller : 'LogModalCtrl' // specify controller for modal
        });
        $scope.new_message_nums = function () {
            return $rootScope.messages_info.length;
        };

        //根据某条提醒转移到对应的聊天界面
        $scope.gotoChat = function (warn) {
            $location.path("/privateChat/"+warn.sender_id);
        };
        // 注册私人聊天监听事件
        socket.on("receive",function (data) {
           var sender = data.sender;
           var message = data.message;
           //如果用户已经在聊天界面了，且正在与发送该消息的用户聊天
           if($rootScope.isInChatPage&&$rootScope.privateChatUser!=null && sender.id == $rootScope.privateChatUser.id)
           {
               var messageId = message.messageId;
               //直接在聊天框中加入该信息
              var privateChatRecord = {
                  sender:sender,
                  sendTime : message.sendTime,
                  content:message.message,
                  isReceive:true
              };
              $rootScope.privateChatRecords.push(privateChatRecord);
              $http.get("/api/markAsReaded/"+messageId);
           }
           else
           {
               //需要添加提醒信息
              var message_info = {
                   sender_id: sender.id,
                   sender_name:sender.username,
                   sender_image:sender.image,
                   send_time:message.sendTime
               };
               //遍历整个未读信息列表，判断该信息是否是属于未读信息中发送人发送的
               for (var i=0;i<$rootScope.messages_info.length;i++)
               {
                   if($rootScope.messages_info[i].sender_id == message_info.sender_id)
                   {
                       $rootScope.messages_info[i] = message_info;
                       return;
                   }
               }
               //否则，在未读信息列表的最后，加上这条信息
               $rootScope.messages_info.push(message_info);
           }
        });
        modalInstance.result.then(function(result){ //模态框提交后执行函数
                $rootScope.username = result.username ;
                $rootScope.currentUserId = result.userid;
                $rootScope.personalImage = result.img;
                //找到该用户的未读信息,更新提醒列表
            $http.get("/api/getUnreaded",{
                headers: {'Authorization': 'Basic ' + btoa(token+":")}
                }).success(function(unreadMessageInfo){
                    $rootScope.messages_info = unreadMessageInfo;
            });
        //为用户分配一个私人的房间
        socket.emit("join_private_room",result.userid,function (result) {
            if(result == true) {
                $rootScope.hasLogin = true;
                toastr.success("登录成功");
            }
        });

        },function (reason) {
        });
        };

        $scope.register = function () {
          var registerModal = $modal.open({
             templateUrl:'partials/register.html',
             animation:true,
              controller:'RegisterModalCtrl'
          });
          registerModal.result.then(function (result) {

          });
        };

        $scope.logout = function () {
            // 如果加入了房间的话，向服务端发送退出房间的请求
            if($rootScope.joinedRoom!="") {
                socket.emit('leave_room', {
                    room: $rootScope.joinedRoom, user: {
                        userId: $rootScope.currentUserId,
                        username: $rootScope.username
                    }
                });
            }
            $http.get('/api/logout', {
            headers: {'Authorization': 'Basic ' + btoa(token+":")}
            }).success(function (data) {
                $rootScope.joinedRoom = "";
                $rootScope.hasLogin = false;
                $rootScope.currentUserId = 0;
                token = "";
                $location.path("/");
                $rootScope.messages = [];
                toastr.success("退出登录成功");
            });

        }
}]);

helloWorldControllers.controller('RegisterModalCtrl',['$http','$scope','$modalInstance',
    function ($http,$scope,$modalInstance) {
    $scope.account = "";
    $scope.username = "";
    $scope.password = "";
    $scope.errorMessage = "";
    $scope.hasAgree = false;
    $scope.register = function () {
        if($scope.account == "")
        {
            $scope.errorMessage = "账号不能为空!";
            return;
        }
        if($scope.username==""){
            $scope.errorMessage = "用户名不能为空！";
            return;
        }
        if($scope.password==""){
            $scope.errorMessage = "密码不能为空！";
            return;
        }
        if($scope.hasAgree==false)
        {
            $scope.errorMessage = "您必须同意网站条款！";
            return;
        }
        $http.get("/user/"+$scope.account).success(function (data) {
           if(data.result==false) {
               $scope.errorMessage = "该账号已经存在!";
               return;
           }
           else
           {
               $http.post("/register",{
                    account:$scope.account,
                    username:$scope.username,
                    password:$scope.password
                }).success(function (data) {
                if(data.result = true)
                {
                    toastr.success("注册成功！");
                    $modalInstance.close();
                }
                else
                {toastr.error("注册失败！");

                }
                }).error(function (data) {
                toastr.error("注册失败！");
                });
           }
        });
    };


}]);


//登录模态对话框控制器
helloWorldControllers.controller("LogModalCtrl",['$http','$scope','$modalInstance',
    function ($http,$scope,$modalInstance) {
    $scope.errormessage = "";
    $scope.username = "";
    $scope.password = "";

    $scope.submit = function () {
        if($scope.username.length == 0)
        {
            $scope.errormessage = "用户名不能为空";
            return;
        }
        else if($scope.password.length == 0)
        {
            $scope.errormessage = "密码不能为空";
            return;
        }
        try
        {
            btoa($scope.username + ':' + $scope.password);
        }
        catch(err)
        {
            $scope.errormessage = "用户名或密码错误";
            return;
        }
        $http.get('/api/token', {
            headers: {'Authorization': 'Basic ' + btoa($scope.username + ':' + $scope.password)}
        }).success(function (data, status, headers, config) {
            token = data.token;
            $modalInstance.close({'username':data.username,'userid':data.userid,'img':data.img});
        }).error(function (data, status, headers, config) {
            $scope.errormessage = "用户名或密码错误";
        });
    };
    $scope.close = function () {
      $modalInstance.dismiss("cancel");
    };
}]);


//俄罗斯方块游戏的控制器
helloWorldControllers.controller('TetrisCtrl',function ($scope,$http,$location) {
    $scope.isPlaying = false;

    function updateGameData(score) {
        $http.post('/api/gameRecord',{
                 "score":score
             },{
             headers: {'Authorization': 'Basic '
             + btoa(token+":")
             }
        }
        ).success(function (data) {
       //     alert(data.message);

        }).error(function (data) {
       //     alert("发送游戏数据失败!");
        })
    }
    var G = initTrisGame(updateGameData);
    G.start();
    $scope.play = function () {
        G.ctrlStart();
        $scope.isPlaying = true;
    };
    $scope.pause = function () {
        G.ctrlStop();
        $scope.isPlaying = false;
    };
    $scope.reset = function () {
        angular.element(document.getElementById("tb")).html("");
       G.restart();
       $scope.isPlaying = false;
    };
});

function initTrisGame(callbackFunction) {
    var G = {
        //用16进制存储砖块数据
        //所有的砖块数据
        sData : [[0x4444,0xf00],[0x4620,0x6c0],[0x2640,0xc60],[0x6600],
        [0x6220,0x1700,0x2230,0x740],[0x6440,0xe20,0x44c0,0x8e00],
            [0x4e00,0x4640,0xe40,0x4c40]
        ],

        map:[0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,
        0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xffff
        ,0xffff],
        score: 0,
        level: 0,
        np: false,


        //当前砖块索引
        currentIndex:0,
        //当前砖块类别索引
        typeIndex:0,
        //当前正在移动的砖块
        currentData:null,
        //砖块当前的行(对应4阶正方形的左上角)
        currentRow:0,
        //砖块当前的列
        currentCol:6,
        //当前砖块对应的颜色的class
        currentColor:"c1",


        //下一个砖块的数据
        nextData:null,
        //下一个砖块的颜色
        nextColor:"c1",
        //下一个砖块的索引
        nextIndex:0,
        //下一个砖块的类别索引
        nextTypeIndex:0,


        //预览区
        pre:document.getElementById("pre_table"),

        //游戏区对应的表格
        tb:document.getElementById("tb"),

        callMethod:callbackFunction,

        init:function () {
            for(var i=0;i<22;i++)
            {
                var tr = document.createElement("tr");
                for(var j = 0;j<16;j++)
                {
                    var td = document.createElement("td");
                    if (i >19 || j<2 || j>13) td.className = "htd";
                    tr.appendChild(td);
                }
                document.getElementById("tb").appendChild(tr);
            }
            document.getElementById("pan").style.height =
                document.getElementById("tb").clientHeight+"px";
            this.score = this.level = 0;
            this.np = false;
        },

        //检查该方块是否可以移动到（r,c)位置,data 表示砖块对应的数据
        canMoveTo:function (r,c,data) {
          if(c>12)return false;
          for(var i =0;i<4;i++)
          {
              //获得砖块某一行的数据，并进行适当的左移以与游戏区
              //该行的数据对齐
              if(r+i<0)
                  continue;
              var d1 = ((data>>((3-i)<<2)&0xf)<<(12-c));
              var d2 = this.map[r+i];
              //进行位操作判断是否可以移动
              if((d1|d2)!=(d1^d2))
                  return false;
          }
          return true;
        },

        //移动到第r行c列，data 表示砖块对应的数据
        moveTo:function (r,c,data) {
          if(this.canMoveTo(r,c,data))
          {
              this.currentData = data;
              this.currentRow = r;
              this.currentCol = c;
          }
          else
          {
              //无法继续往下移动
              if (r>this.currentRow)
              {
                  //遍历砖块的4行数据
                  for(var cr = 0;cr<4;cr++)
                  {
                      var tr = this.currentRow + cr;
                      //取得该砖块对应行的数据
                      var d = (data>>((3-cr)<<2)&0xf);
                      if(tr<0 || tr>19) continue;
                      //将游戏区以及该砖块对应的行进行或操作以合并数据
                      this.map[tr] |= d <<(12-c);
                      //取得该行4列的数据，判断该列是否有值，如果
                      //有值的话需要更改颜色
                      for(var cc = 0;cc<4;cc++)
                      {
                          var m = (d>>(3-cc))&0x1;
                          var ct = this.currentCol + cc ;
                          if(m) this.tb.rows[tr].cells[ct].className =
                              this.currentColor;
                      }
                      //判断是否能够清除行
                      if(this.canClear(tr))
                      {
                          this.clearLine(tr);
                      }
                  }
                  //创建砖块
                  this.createBlock();
              }
          }
          //进行重绘
          this.render();
        },

        keyHandler:function (e) {
         switch (e.keyCode)
         {
             case 38:
                 //改变砖块类别
                 this.typeIndex = (this.typeIndex+1)%this.sData[this.currentIndex].length;
                 this.moveTo(this.currentRow,this.currentCol,this.sData[this.currentIndex][this.typeIndex]);
                 break;
             case 40:
                 this.moveTo(this.currentRow+1,this.currentCol,this.currentData);
                 break;
             case 37:
                 this.moveTo(this.currentRow,this.currentCol-1,this.currentData);
                 break;
             case 39:
                 this.moveTo(this.currentRow,this.currentCol+1,this.currentData);
                 break;
         }
        },

        canClear:function (x) {
            return x<20&&this.map[x] == 0xffff;
        },
        //消除第x行
        clearLine:function (x) {
            this.map.splice(x,1);
            this.map.splice(0,0,0xc003);
            this.score ++ ;
            this.level = this.score/20|0;
        },

        //绘制
        render:function () {
            var cs = "";
            for (var i=0;i<20;i++)
            {
                for (var j = 2;j<14;j++)
                {
                    cs = this.map[i]&(1<<(15-j));
                    if(!cs)
                        this.tb.rows[i].cells[j].className = "";
                    var tr = i - this.currentRow;
                    var tc = j - this.currentCol;

                    var rdata = this.currentData>>((3-tr)<<2)&0xf;
                    //获取砖块在该tr行，tc列是否有数据
                    var coldata = (rdata>>3-tc)&0x1;
                    //如果有数据的话，绘制该部分砖块
                    if(tr>=0&&tr<4&&tc>=0&&tc<4&&coldata)
                    {
                        this.tb.rows[i].cells[this.currentCol+tc].className = this.currentColor;
                    }
                }
            }

            // 绘制预览区
            for(var m =0;m<4;m++)
            {
                for (var n =0;n<4;n++)
                {
                    //取得行的数据
                    var r= this.nextData>>((3-m)<<2)&0xf;
                    //取得列的数据
                    var b = (r>>3-n)&0x1;
                    this.pre.rows[m].cells[n].className = b? this.nextColor:"";
                }
            }

            document.getElementById("score").innerText = this.score;
            document.getElementById("level").innerText = this.level;
        },
        randBlock:function () {
            this.currentIndex = this.nextIndex;
            this.typeIndex = this.nextTypeIndex;
            this.currentColor = this.nextColor;
            this.currentData = this.nextData;

            this.nextIndex = (Math.random()*this.sData.length|0);
            this.nextTypeIndex = (Math.random()*this.sData[this.nextIndex].length|0);
            this.nextColor = "c"+(Math.random()*7+1|0);
            this.nextData = this.sData[this.nextIndex][this.nextTypeIndex];
        },
        //产生新的砖块
        createBlock:function () {
            this.randBlock();
            var i = 0;
            while (!(this.currentData>>(i<<2)&0xf))
                i++;
            this.currentRow = i - 4;
            this.currentCol = 6 ;
            if(!this.canMoveTo(this.currentRow+1,this.currentCol,this.currentData))
            {
                toastr.warning("Game Over");
                //向数据库更新得分信息
                this.callMethod(this.score);
                this.stop();
                document.onkeydown = null;
            }
        },

        main:function () {
            if(!this.np)
                return;
            this.moveTo(this.currentRow+1,this.currentCol,this.currentData);
        },
        start:function () {
            this.init();
            this.randBlock();
            this.createBlock();
            this.hd = setInterval(function () {
               G.main();
            },60*(10-this.level));
        },

        ctrlStart:function () {
          this.np = true;
         document.onkeydown = function (e) {
             G.keyHandler(e);
         }
        },
        ctrlStop:function()
        {
            this.np = false;
            document.onkeydown = null;
        },
        stop:function () {
            clearInterval(this.hd);
        },
        restart:function () {
            //清除按键监听事件
            this.ctrlStop();
            //清除定时事件
            this.stop();
           this.map = [0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,
        0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xc003,0xffff
        ,0xffff];
            this.score = 0;
            this.level = 0;
            this.np = false;
            document.getElementById("score").innerText = this.score;
            document.getElementById("level").innerText = this.level;
            this.start();
        }
    };
    return G;
}

//俄罗斯方块游戏记录的控制器
helloWorldControllers.controller('TetrisRecordCtrl',function ($scope,$http,$rootScope) {
    $scope.select = function (page) {
        if(page<=0||page>$scope.totalPages)
            return ;
        $http.get("/api/tetrisRecord?page="+page,{
                headers: {'Authorization': 'Basic ' + btoa(token+":")}
            }).success(function (data) {
            $scope.playNums = data.playNums;
            constructPage(data);
            //构造数据记录
            $scope.gameRecords = data.gameRecords;
        })
    };

    $scope.next = function () {
      $scope.select($scope.currentPage+1);
    };

    $scope.previous = function () {
        $scope.select($scope.currentPage-1);
    };

    $rootScope.$watch('hasLogin',function (newValue,oldValue,scope) {
        if(newValue == true)
        {
             $scope.select(1);
            getStatisData();
        }
    });
    //构造分页数据
    function constructPage(data) {
        $scope.currentPage = data.pagination.currentPage;
        $scope.has_next = data.pagination.has_next;
        $scope.has_prev = data.pagination.has_prev;
        //所有的页面
        var totalPages = data.pagination.pages;
        $scope.totalPages = totalPages;
        //每个分页显示5个分页数据
        var perPage = 5;

        $scope.pageList = [];

        //大于2还要做页面转换
        if($scope.currentPage >2)
        {
            //页面终点
            var endPages = 0;
            if($scope.currentPage+2>=totalPages)
            {
                endPages = totalPages;
            }
            else {
                endPages = $scope.currentPage+2;
            }
            for(var i=$scope.currentPage-2;i<=endPages;i++)
            {
                 $scope.pageList.push(i);
            }
        }
        //如果当前页面不大于2的话，就直接显示，不必转换页面
        else {
            var showPages = 0;
            if(totalPages>perPage)
                showPages = perPage;
            else
            {
                showPages = totalPages;
            }
            //先分1...5页（最多显示5个），如果大于2还要做页面转换
            for (var m = 1; m <= showPages; m++) {
                $scope.pageList.push(m);
            }
        }
    }
    function getStatisData() {
        $http.get("/api/tetrisStatisInfo",{
                headers: {'Authorization': 'Basic ' + btoa(token+":")}
            }).success(function (data) {
           drawdata(data);
        });
    }
});



function drawdata(data) {
     var myChart = echarts.init(document.getElementById('main'));
    var years = data.date;
    var score = data.score;
    // 指定图表的配置项和数据
    var option = {
        tooltip : {
        trigger: 'axis',
        formatter: "Score : <br/>{c}"
    },
    xAxis: {
        data:years,
        axisLine: {
            lineStyle: {
            }
        }
    },
    yAxis: {
         splitLine: {show: false},
        axisLine: {
            lineStyle: {
            }
        }
    },
    dataZoom: [
        {
            type: 'slider',
            xAxisIndex: 0,
            start: 0,
            end: 100
        },
        {
            type: 'inside',
            xAxisIndex: 0,
            start: 0,
            end: 100
        },
        {
            type: 'slider',
            yAxisIndex: 0,
            start: 0,
            end: 100
        },
        {
            type: 'inside',
            yAxisIndex: 0,
            start: 0,
            end: 100
        }
    ],
    series: [
        {
            type:'line',
            data:score,
            symbol: 'emptyCircle',
            symbolSize: 10
        }
    ]
    };
        // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);
}


helloWorldControllers.controller("TopUserCtrl",function ($scope,$rootScope,$http) {
    $http.get("/api/topTen").success(function (data) {
        $scope.topUsers = data.topUser;
    });
    //判断遍历的用户是否是当前登录的用户
    $scope.isCurrentUser = function (user) {
      return user.id == $rootScope.currentUserId;
    };
});


helloWorldControllers.controller('MainCtrl', ['$scope', '$location', '$http',
    function MainCtrl($scope, $location, $http) {
        $scope.message = "Hello World";
    }]);

helloWorldControllers.controller('ChatCtrl',
    function ShowCtrl($rootScope,$scope,socket,$modal) {
  /*  var listeners_remove = ['rooms','other_join_room','receive_message',
        'other_leave_room','currentUser'];
    //首先移出所有的监听事件
    socket.removeListeners(listeners_remove);*/
    //记录当前用户加入的房间，默认没加入任何房间
        //收到房间列表更新的信息
    socket.on("rooms",function (data) {
        $scope.rooms = data['rooms'];
    });
    socket.emit("getRooms",{});
    // 要发送的信息
    $scope.messageToSend = "";
    $scope.roomEmpty = function () {
      return $scope.rooms!= undefined && $scope.rooms.length == 0
    };
    //判断某用户是否为当前登录的用户
    $scope.isCurrentUser = function (user) {
      return user.userId == $rootScope.currentUserId;
    };
    $scope.isChating = function () {
      //如果用户加入了一个房间，则认为他正在聊天
        return $rootScope.joinedRoom != "";
    };


    socket.on("other_join_room",function (data) {
        toastr.info(data['username'] + " 已经进入了房间! ");
    });

     //如果收到信息的话
     socket.on("receive_message",function (data) {
        var  received_message = data['message'];
        $rootScope.messages.push(received_message);
     });
      //如果收到有人离开的信息
      socket.on("other_leave_room",function (user) {
          toastr.info(user['username']+"  已经离开了房间了")
      });

      socket.on('currentUser',function (users) {
         $rootScope.roomusers = users;
      });

      //显示创建房间的模态对话框
    $scope.createRoom = function (){
        var modalInstance = $modal.open({
            templateUrl : 'partials/createRoom.html',
            animation:true,
            controller : 'CreateRoomModalCtrl' // specify controller for modal
        });
        //获得模态对话框创建的房间名
        modalInstance.result.then(function(roomName){ //模态框提交后执行函数
            toastr.success("房间创建成功");
            //设置加入该房间
            $scope.join(roomName);
        });
        };
    $scope.sendMessage = function () {
        if($scope.messageToSend.length == 0)
        {
            return;
        }
        var user = {
              userId: $rootScope.currentUserId,
              username:$rootScope.username,
              image:$rootScope.personalImage
          };
        socket.emit("sendMessage",{room:$rootScope.joinedRoom,user:user,message:$scope.messageToSend,sendTime:moment().format('YYYY-MM-DD HH:mm:ss') });
        $scope.messageToSend = "";
    };
    $scope.join = function (room) {

        socket.emit("join_room",{
          room:room,
          user:{
              userId: $rootScope.currentUserId,
              username:$rootScope.username
          }
      },function (result) {
            if(result == false)
            {
                toastr.error("加入房间失败，你可能已经重复登录了！");
            }
            else
            {
                $rootScope.joinedRoom = room;
            }
        });
    };
    $scope.leave = function (room) {
      socket.emit("leave_room",{
          room:room,
          user:{
              userId:$rootScope.currentUserId,
              username:$rootScope.username
          }
      });
      //加入的房间置为空
      $rootScope.joinedRoom = "";
      //收到的消息也置为空
      $rootScope.messages = [];
    };
});
helloWorldControllers.controller('CreateRoomModalCtrl',function ($scope,$modalInstance,socket) {
    $scope.roomName = "";
    $scope.errorMessage = "";
    $scope.create = function () {
        if($scope.roomName.length == 0)
        {
            $scope.errorMessage = "房间名不能为空";
            return;
        }
        socket.emit("create_room",$scope.roomName,function (result) {
            if(!result)
            {
                $scope.errormessage = "该房间已经存在了";
                return;
            }
            $modalInstance.close($scope.roomName);
        });
    };
    $scope.close = function () {
      $modalInstance.dismiss("none");
    };
});
