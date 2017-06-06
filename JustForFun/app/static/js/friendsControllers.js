/**
 * Created by qi on 2017/5/10.
 */
helloWorldControllers.controller("searchFriendsCtrl",function ($scope,$rootScope,$http) {
    $scope.searchUsername = "";
    $scope.users = [];
    $scope.hasFollow = [];
    $scope.search = function () {
       searchUsers(1,$scope.searchUsername);
    };
    $scope.search();
    $scope.isCurrentUser = function (user) {
      return  $rootScope.currentUserId == user.id;
    };
    $scope.select = function (page) {
        if(page == $scope.pagination.currentPage)
            return;
      searchUsers(page,$scope.searchUsername);
    };
    $scope.previous = function () {
        if($scope.pagination.currentPage-1<=0)
          return;
         $scope.select($scope.pagination.currentPage-1);
    };
    $scope.next = function () {
      if($scope.pagination.currentPage+1>$scope.pagination.pages)
          return;
      $scope.select($scope.pagination.currentPage+1);
    };

    function searchUsers(page,username) {
        $http.get("/api/queryUser?page="+page+"&username="+username,{
                headers: {'Authorization': 'Basic ' + btoa(token+":")}
            }).success(function (data) {
            $scope.users = data.users;
            $scope.hasFollow = data.follows;
            $scope.pagination = data.pagination;
            constructPager();
        });
    }
    function constructPager() {
        //所有的页面
        var totalPages = $scope.pagination.pages;
        //每个分页显示5个分页数据
        var perPage = 5;

        $scope.pageList = [];

        //大于2还要做页面转换
        if($scope.pagination.currentPage >2)
        {
            //页面终点
            var endPages = 0;
            if($scope.pagination.currentPage+2>=totalPages)
            {
                endPages = totalPages;
            }
            else {
                endPages = $scope.pagination.currentPage+2;
            }
            for(var i=$scope.pagination.currentPage-2;i<=endPages;i++)
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

    $scope.unfollow = function (user,index) {
         $http.get("/api/unfollow/"+user.id,{
                headers: {'Authorization': 'Basic ' + btoa(token+":")}
            }).success(function (data) {
                if(data.result == true)
                {
                    toastr.success("删除好友成功");
                    $scope.hasFollow[index] = false;
                }
                else
                {
                    toastr.warn("删除好友失败");
                }
         });
    };

    $scope.follow = function (user,index) {
            $http.get("/api/follow/"+user.id,{
                headers: {'Authorization': 'Basic ' + btoa(token+":")}
            }).success(function (data) {
                if(data.result == true)
                {
                    toastr.success("加为好友成功");
                    $scope.hasFollow[index] = true;
                }
                else
                {
                    toastr.warn("加为好友失败");
                }
         });
    };
    $scope.$watch("searchUsername",function (newValue,oldValue,scope) {
        if(newValue != oldValue)
        {
            $scope.search()
        }
    });
});

helloWorldControllers.controller("FriendsCtrl",function ($scope,$rootScope,$http,$routeParams,socket,$location) {
   $scope.friends = [];
   $scope.title = "我的好友";
   $scope.message = "";
   //用户已经在聊天界面了
   $rootScope.isInChatPage = true;
   if($routeParams.sender_id != undefined)
   {
       //如果要直接进行聊天的用户就是本身的话，不允许打开聊天框
       if($routeParams.sender_id==$rootScope.currentUserId)
           return;
       initChatData($routeParams.sender_id);
   }
   $http.get("/api/getFriends/"+$rootScope.currentUserId,{
        headers: {'Authorization': 'Basic ' + btoa(token+":")}
   }).success(function (data) {
        $scope.friends = data.friends
   });

   $scope.unfollow = function (user,index) {
       $http.get("/api/unfollow/"+user.id,{
                headers: {'Authorization': 'Basic ' + btoa(token+":")}
            }).success(function (data) {
                if(data.result == true)
                {
                    toastr.success("删除好友成功");
                    $scope.friends.splice(index,1);
                }
                else
                {
                    toastr.warn("删除好友失败");
                }
         });
   };
   $scope.sendMessage = function () {
        $http.post("/api/sendMessage",
            {
                sended_id :$rootScope.privateChatUser.id,
                message:$scope.message
            },
            {headers: {'Authorization': 'Basic ' + btoa(token+":")}})
            .success(function (response) {
                //通过websocket发送信息
                if (response.result == true) {
                    data = {
                        sender: {id: $rootScope.currentUserId, username: $rootScope.username,image:$rootScope.personalImage},
                        message: {messageId:response.messageId,message: $scope.message, sendTime: response.sendTime},
                        sended_id: $rootScope.privateChatUser.id
                    };
                    socket.emit("send_private_message", data);

                    //构造私聊数据
                    var privateChatRecord = {
                        sender: data.sender,
                        sendTime: data.message.sendTime,
                        content: $scope.message,
                        isReceive: false
                    };
                    //改变私聊记录列表
                    $rootScope.privateChatRecords.push(privateChatRecord);
                    $scope.message = "";
                }
            });
   };
   $scope.chatWith = function (friend) {

     //只做简单的url 跳转
     $location.path("privateChat/"+friend.id);
   };

   //选中某个用户后，初始化相应的信息
   function initChatData(other_id) {
       $http.get("/api/getUser/"+$routeParams.sender_id,{
           headers: {'Authorization': 'Basic ' + btoa(token+":")}
       }).success(function (data) {
          $rootScope.privateChatUser = data.user;
           //清除提醒
           clearWarnFromOthers($rootScope.privateChatUser);
       });

     $http.get("/api/chatRecords/"+other_id+"/0",
         {headers: {'Authorization': 'Basic ' + btoa(token+":")}})
         .success(function (privateChatRecords) {
            $rootScope.privateChatRecords = privateChatRecords;
         });
     setTimeout(function () {
         scrollToBottom();
     },5);
   }

   function scrollToBottom() {
        var chatContent = document.getElementById("chatContent");
        chatContent.scrollTop = chatContent.scrollHeight;
   }
   //从一系列的聊天提醒中清空对应的聊天提醒
   function clearWarnFromOthers(other_user)
   {
        user_id = other_user.id;
        for(var i=0;i<$rootScope.messages_info.length;i++)
        {
            //如果要进行聊天的用户与某条提醒的用户编号相同的话，删除该用户
            if(user_id == $rootScope.messages_info[i].sender_id)
            {
                $rootScope.messages_info.splice(i,1);
            }
        }
   }

    $scope.$on('$routeChangeStart', function(evt, next, current){
          if(next.controller!="ChatCtrl")
          {
              //用户离开了聊天界面
              $rootScope.isInChatPage = false;
          }
        });
   $scope.close = function () {
     $rootScope.privateChatUser = null;
     //回到最初的url
     $location.path("/privateChat");
   };
});