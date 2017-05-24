/**
 * Created by qi on 2017/5/13.
 */
helloWorldControllers.controller("PersonalInfoCtrl",['$scope', '$http','$rootScope', function($scope, $http,
$rootScope) {
    $scope.reader = new FileReader();   //创建一个FileReader接口
    //上传的图片是否有效
    $scope.isValid = false;
    $scope.img_upload = function(files) {       //单次提交图片的函数
        $scope.reader.readAsDataURL(files[0]);  //FileReader的方法，把图片转成base64
        $scope.reader.onload = function(ev) {
            $scope.$apply(function(){
               $scope.imgSrc = ev.target.result;
               $scope.isValid = true;
               $scope.imageFile = files[0];
            });
        };
    };

    function clearInput() {
   //     document.getElementById("avatarInput");
        $scope.isValid = false;
        $scope.imgSrc = null;
        $scope.imageFile = null;
    }

    $scope.uploadImage = function () {
        var data = new FormData();
        data.append('image', $scope.imageFile);
        $http({
            method: 'post',
            url: '/api/uploadImage',
            data:data,
            headers: {'Content-Type': undefined,'Authorization': 'Basic ' + btoa(token+":")},
            transformRequest: angular.identity
        }).success(function (result) {
            if(result.result==true)
            {
                toastr.success("修改头像成功！");
                $rootScope.personalImage = result.imageLocation;
                clearInput();
            }
            else
            {
                toastr.warn("修改头像失败！请确定图片格式是否正确！");
                clearInput();
            }
        });
    };
}]);