'use strict';

/* App Module */

var helloWorldApp = angular.module('helloWorldApp', [
    'ngRoute',     
    'helloWorldControllers',
    'ui.bootstrap'
]);

var token = '';


helloWorldApp.config(['$routeProvider', '$locationProvider',
    function($routeProvider, $locationProvider) {
        $routeProvider.
                when('/', {
                     controller: 'MainCtrl',
                     templateUrl: 'partials/main.html'

                }).when('/chat', {
                    controller: 'ChatCtrl',
                    templateUrl: 'partials/chat.html'

                }).when('/Tetris',{
                    controller: 'TetrisCtrl',
                    templateUrl: 'partials/game.html'
        }).when('/gameRecord/Tetris',{
            controller:'TetrisRecordCtrl',
            templateUrl:'partials/gameRecordTetris.html'
        }).when('/topUser',{
            controller:'TopUserCtrl',
            templateUrl:'partials/topUser.html'
        })
            .when('/searchFriends',{
                controller:'searchFriendsCtrl',
                templateUrl:'partials/searchFriends.html'
            })
            .when('/privateChat',{
                controller:'FriendsCtrl',
                templateUrl:'partials/privateChat.html'
            })
            .when('/privateChat/:sender_id',
                {
                    controller:'FriendsCtrl',
                    templateUrl:'partials/privateChat.html'
                })
            .when('/personalInfo',
                {
                    controller:'PersonalInfoCtrl',
                    templateUrl:'partials/personalInfo.html'
                })
        ;
        $locationProvider.html5Mode(false).hashPrefix('!');
    }]);



