'use strict';
/*global angular*/
var jsGen = angular.module('jsGen', [
    'ngLocale',
    'ngRoute',
    'ngAnimate',
    'ngResource',
    'ngCookies',
    'ui.validate',
    'genTemplates',
    'angularFileUpload']);

jsGen.config(['$httpProvider', 'app',
    function ($httpProvider, app) {
        // global loading status
        var count = 0,
            loading = false,
            status = {
                count: 0,
                total: 0
            };

        status.cancel = function () {
            count = 0;
            loading = false;
            this.count = 0;
            this.total = 0;
            app.loading(false, this); // end loading
        };

        // global loading start
        $httpProvider.defaults.transformRequest.push(function (data) {
            count += 1;
            status.count = count;
            status.total += 1;
            if (!loading) {
                window.setTimeout(function () {
                    if (!loading && count > 0) {
                        loading = true;
                        app.loading(true, status);
                    }
                }, 1000); // if no response in 1000ms, begin loading
            }
            return data;
        });
        // global loading end
        $httpProvider.defaults.transformResponse.push(function (data) {
            count -= 1;
            status.count = count;
            if (loading && count === 0) {
                status.cancel();
            }
            return data;
        });
        // global error handling
        $httpProvider.interceptors.push(function () {
            return {
                response: function (res) {
                    var error, data = res.data;
                    if (angular.isObject(data)) {
                        app.timestamp = data.timestamp;
                        error = !data.ack && data.error;
                    }
                    if (error) {
                        app.toast.error(error.message, error.name);
                        return app.q.reject(data);
                    } else {
                        return res;
                    }
                },
                responseError: function (res) {
                    var data = res.data || res,
                        status = res.status || '',
                        message = data.message || (angular.isObject(data) ? 'Error!' : data);

                    app.toast.error(message, status);
                    return app.q.reject(data);
                }
            };
        });
    }
])
.run(['app', '$q', '$rootScope', '$location', '$timeout', '$filter', 'getFile', 'JSONKit', 'toast', 'timing', 'cache', 'restAPI', 'sanitize',
    'mdParse', 'mdEditor', 'CryptoJS', 'promiseGet', 'myConf', 'anchorScroll', 'isVisible', 'applyFn', 'param', 'store', 'i18n-zh',
    function (app, $q, $rootScope, $location, $timeout, $filter, getFile, JSONKit, toast, timing, cache, restAPI, sanitize, mdParse,
        mdEditor, CryptoJS, promiseGet, myConf, anchorScroll, isVisible, applyFn, param, store, $locale) {
        var unSave = {
                stopUnload: false,
                nextUrl: ''
            },
            global = $rootScope.global = global || $rootScope.global || {
                alipayEmail:"chh1990@mail.ustc.edu.cn",
                alipayTel:"18042426990",
                weixinPayImg:"static/img/weixin_pay.png",
                alipayImg:"static/img/alipay.png",
                discountMsg:"店庆3周年特惠：所有蛋糕一律八折起，邀请亲品尝！",
                isAdmin: false,
                isEditor: false,
                isLogin: false,
                info: {}
            },
            jqWin = $(window);

        function resize() {
            var viewWidth = global.viewWidth = jqWin.width();
            global.viewHeight = jqWin.height();
            global.isPocket = viewWidth < 480;
            global.isPhone = viewWidth < 768;
            global.isTablet = !global.isPhone && viewWidth < 980;
            global.isDesktop = viewWidth >= 980;
        }

        function init() {
            restAPI.index.get({}, function (data) {
                app.timeOffset = Date.now() - data.timestamp;
                data = data.data;
                data.title2 = data.description;
                data.info.angularjs = angular.version.full.replace(/\-build.*$/, '');
                app.union(global, data);
                app.version = global.info.version || '';
                app.upyun = global.user && global.user.upyun;
                app.checkUser();
            });
        }

        app.q = $q;
        app.store = store;
        app.toast = toast;
        app.param = param;
        app.timing = timing;
        app.location = $location;
        app.timeout = $timeout;
        app.timeOffset = 0;
        app.timestamp = Date.now();
        app.filter = $filter;
        app.locale = $locale;
        app.anchorScroll = anchorScroll;
        app.isVisible = isVisible;
        app.getFile = getFile;
        app.cache = cache;
        app.restAPI = restAPI;
        app.sanitize = sanitize;
        app.mdParse = mdParse;
        app.mdEditor = mdEditor;
        app.CryptoJS = CryptoJS;
        app.promiseGet = promiseGet;
        app.myConf = myConf;
        app.rootScope = $rootScope;
        angular.extend(app, JSONKit); //添加 JSONKit 系列工具函数

        app.loading = function (value, status) {
            // $rootScope.loading = status;
            $rootScope.loading.show = value;
            applyFn();
        };
        app.validate = function (scope, turnoff) {
            var collect = [],
                error = [];
            scope.$broadcast('genTooltipValidate', collect, turnoff);
            app.each(collect, function (x) {
                if (x.validate && x.$invalid) {
                    error.push(x);
                }
            });
            if (error.length === 0) {
                app.validate.errorList = null;
                scope.$broadcast('genTooltipValidate', collect, true);
            } else {
                app.validate.errorList = error;
            }
            return !app.validate.errorList;
        };
        app.checkDirty = function (tplObj, pristineObj, Obj) {
            var data = app.union(tplObj);
            if (data && pristineObj && Obj) {
                app.intersect(data, Obj);
                app.each(data, function (x, key, list) {
                    if (angular.equals(x, pristineObj[key])) {
                        delete list[key];
                    }
                });
                app.removeItem(data, undefined);
                unSave.stopUnload = !app.isEmpty(data);
            } else {
                unSave.stopUnload = false;
            }
            return unSave.stopUnload ? data : null;
        };
        app.checkUser = function () {
            global.isLogin = !! global.user;
            global.isAdmin = global.user && global.user.role === 5;
            global.isEditor = global.user && global.user.role >= 4;
            global.isShopper = global.user && global.user.role >= 3;
        };
        app.clearUser = function () {
            global.user = null;
            app.checkUser();
        };
        app.checkFollow = function (user) {
            var me = global.user || {};
            user.isMe = user._id === me._id;
            user.isFollow = !user.isMe && !!app.findItem(me.followList, function (x) {
                return x === user._id;
            });
        };

        $rootScope.loading = {
            show: false
        };
        $rootScope.validateTooltip = {
            validate: true,
            validateMsg: $locale.VALIDATE
        };
        $rootScope.unSaveModal = {
            confirmBtn: $locale.BTN_TEXT.confirm,
            confirmFn: function () {
                if (unSave.stopUnload && unSave.nextUrl) {
                    unSave.stopUnload = false;
                    $timeout(function () {
                        window.location.href = unSave.nextUrl;
                    }, 100);
                }
                return true;
            },
            cancelBtn: $locale.BTN_TEXT.cancel,
            cancelFn: true
        };
        $rootScope.selectShopModal = {
            confirmBtn: false,
            cancelBtn: false

        };
        $rootScope.$on('$locationChangeStart', function (event, next, current) {
            if (unSave.stopUnload) {
                event.preventDefault();
                unSave.nextUrl = next;
                $rootScope.unSaveModal.modal(true);
            } else {
                unSave.nextUrl = '';
            }
        });

        $rootScope.goBack = function () {
            window.history.go(-1);
        };
        $rootScope.logout = function () {
            restAPI.user.get({
                ID: 'logout'
            }, function () {
                global.user = null;
                app.checkUser();
                $location.path('/');
            });
        };
        $rootScope.followMe = function (user) {
            restAPI.user.save({
                ID: user._id
            }, {
                follow: !user.isFollow
            }, function (data) {
                if (data.follow) {
                    global.user.followList.push(user._id);
                    app.toast.success($locale.USER.followed + user.name, $locale.RESPONSE.success);
                } else {
                    app.findItem(global.user.followList, function (x, i, list) {
                        if (x === user._id) {
                            list.splice(i, 1);
                            app.toast.success($locale.USER.unfollowed + user.name, $locale.RESPONSE.success);
                            return true;
                        }
                    });
                }
                user.fans += user.isFollow ? -1 : 1;
                user.isFollow = !user.isFollow;
            });
        };

        jqWin.resize(applyFn.bind(null, resize));
        timing(function () { // 保证每360秒内与服务器存在连接，维持session
            if (Date.now() - app.timestamp - app.timeOffset >= 240000) {
                init();
            }
        }, 120000);
        resize();
        init();

    }
]);

'use strict';
/*global angular, jsGen*/

jsGen
.factory('i18n-zh', ['$locale',
    function ($locale) {
        angular.extend($locale, {
            RESET: {
                locked: '申请解锁',
                passwd: '找回密码',
                email: '请求信息已发送到您的邮箱，请查收。'
            },
            RESPONSE: {
                success: '请求成功',
                error: '请求失败'
            },
            VALIDATE: {
                required: '必填！',
                minlength: '太短！',
                maxlength: '太长！',
                min: '太小！',
                max: '太大！',
                more: '太多！',
                email: 'Email无效！',
                pattern: '格式无效！',
                username: '有效字符为汉字、字母、数字、下划线，以汉字或小写字母开头！',
                minname: '长度应大于5字节，一个汉字3字节！',
                maxname: '长度应小于15字节，一个汉字3字节！',
                repasswd: '密码不一致！',
                url: 'URL无效！',
                tag: '标签错误，不能包含“,”、“，”和“、”'
            },
            BTN_TEXT: {
                confirm: '确定',
                cancel: '取消',
                remove: '删除',
                goBack: '返回'
            },
            TIMING: {
                goHome: '秒钟后自动返回主页'
            },
            HOME: {
                title: '我的主页',
                index: ' 更新，阅读时间线：',
                mark: '我的收藏',
                article: '我的文章',
                comment: '我的评论',
                follow: '我的关注',
                fans: '我的粉丝'
            },
            ADMIN: {
                index: '网站信息',
                user: '用户管理',
                tag: '标签管理',
                article: '文章管理',
                comment: '评论管理',
                message: '消息管理',
                global: '网站设置',
                updated: '成功更新 ',
                noUpdate: '设置暂无变更'
            },
            ARTICLE: {
                title: '添加/编辑文章',
                preview: '预览：',
                reply: '评论：',
                removed: '成功删除 ',
                updated: '成功更新 ',
                noUpdate: '文章暂无变更',
                added: '成功保存 ',
                markdown: 'Markdown简明语法',
                marked: '已收藏 ',
                unmarked: '已取消收藏 ',
                favored: '已支持 ',
                unfavored: '已取消支持 ',
                opposed: '已反对 ',
                unopposed: '已取消反对 ',
                highlight: '置顶 ',
                unhighlight: '取消置顶 '
            },
            USER: {
                title: '的主页',
                login: '用户登录',
                reset: '用户信息找回',
                register: '用户注册',
                article: '的文章',
                fans: '的粉丝',
                followed: '已关注 ',
                unfollowed: '已取消关注 ',
                email: '验证邮件已发送到新邮箱，通过验证后才保存修改',
                updated: '用户信息更新成功',
                noUpdate: '用户信息暂无变更',
                noLogin: '您还未登录'
            },
            TAG: {
                title: '热门标签',
                removed: '成功删除 ',
                updated: '成功更新 ',
                noUpdate: '标签暂无变更'
            },
            FILTER: {
                //role: ['禁言', '待验证', '会员', '组员', '编辑', '管理员'],
                orderStatus:['下单','等待处理','未付款','已付款，待联系','联系不上买家','蛋糕制作中','订单取消，待退款','处理退款中','配送中，待确认','交易成功',"交易成功（含退款）","交易取消","已评论"],
                role: ['禁言', '待验证', '会员', '商家', '编辑', '管理员'],
                follow: ['关注', '已关注'],
                favor: ['支持', '已支持'],
                mark: ['收藏', '已收藏'],
                oppose: ['反对', '已反对'],
                highlight: ['置顶', '取消置顶'],
                turn: ['开启', '关闭'],
                edit: ['添加', '编辑'],
                gender: {
                    male: '男',
                    female: '女'
                }
            },
            DATETIME: {
                second: '秒',
                minute: '分',
                hour: '时',
                day: '天',
                month: '月',
                year: '年',
                fullD: 'yyyy年MM月dd日 HH:mm',
                shortD: 'MM-dd HH:mm',
                dayAgo: '天前',
                hourAgo: '小时前',
                minuteAgo: '分钟前',
                secondAgo: '刚刚'
            },
            UPLOAD: {
                fileType: '文件类型无效，仅允许png、gif、jpg、bmp文件！'
            }
        });
        return $locale;
    }
]);
'use strict';
/*global angular, jsGen*/

jsGen
    .constant('app', {
        version: Date.now()
    })
    .provider('getFile', ['app',
        function (app) {
            this.html = function (fileName) {
                return '/static/tpl/' + fileName + '?v=' + app.version;
            };
            this.md = function (fileName) {
                return '/static/md/' + fileName + '?v=' + app.version;
            };
            this.$get = function () {
                return {
                    html: this.html,
                    md: this.md
                };
            };
        }
    ])
    .config(['$routeProvider', '$locationProvider',

        function ($routeProvider, $locationProvider) {
            var index = {
                    templateUrl: 'index.html',
                    controller: 'indexCtrl'
                },
                cake = {
                    templateUrl: 'cake.html',
                    controller: 'cakeCtrl'
                },
                cake1 = {
                    templateUrl: 'cake1.html',
                    controller: 'cake1Ctrl'
                },
                selectCake = {
                    templateUrl: 'selectCake.html',
                    controller: 'selectCakeCtrl'
                },
                makeCake = {
                    templateUrl: 'make-cake.html',
                    controller: 'makeCakeCtrl'
                },
                orderCake = {
                    templateUrl: 'order-cake.html',
                    controller: 'orderCakeCtrl'
                },
                orderResult = {
                    templateUrl: 'order-result.html',
                    controller: 'orderResultCtrl'
                },
                orderPayWeixin = {
                    templateUrl: 'order-pay-weixin.html',
                    controller:'orderResultCtrl'
                },
                orderPayAlipay={
                    templateUrl: 'order-pay-alipay.html',
                    controller:'orderResultCtrl'
                },
                login = {
                    templateUrl: 'login.html',
                    controller: 'userLoginCtrl'
                },
                register = {
                    templateUrl: 'register.html',
                    controller: 'userRegisterCtrl'
                },
                home = {
                    templateUrl: 'user.html',
                    controller: 'homeCtrl'
                },
                admin = {
                    templateUrl: 'admin.html',
                    controller: 'adminCtrl'
                },
                edit = {
                    templateUrl: 'article-editor.html',
                    controller: 'articleEditorCtrl'
                },
                tag = {
                    templateUrl: 'index.html',
                    controller: 'tagCtrl'
                },
                reset = {
                    templateUrl: 'reset.html',
                    controller: 'userResetCtrl'
                },
                user = {
                    templateUrl: 'user.html',
                    controller: 'userCtrl'
                },
                article = {
                    templateUrl: 'article.html',
                    controller: 'articleCtrl'
                },
                webPs = {
                    templateUrl: 'webPs.html'
                },
                collection = {
                    templateUrl: 'collection.html',
                    controller: 'collectionCtrl'
                };

            $routeProvider.
                when('/hots', selectCake).
                when('/update', selectCake).
                when('/latest', selectCake).
                when('/T:ID', selectCake).
                when('/tag/:TAG', selectCake).
                when('/login', login).
                when('/register', register).
                when('/reset', reset).
                when('/home', home).
                when('/home/:OP', home).
                when('/admin', admin).
                when('/admin/:OP', admin).
                when('/tag', tag).
                when('/add', edit).
                when('/A:ID/edit', edit).
                when('/user/U:ID', user).
                when('/user/U:ID/:OP', user).
                when('/U:ID', user).
                when('/U:ID/:OP', user).
                when('/A:ID', article).
                when('/A:ID/:UID/:OP', article).
                when('/C:ID', collection).
                when('/', cake).
                when('/cake1', cake1).
                when('/selectCake', selectCake).
                when('/makeCake', makeCake).
                when('/orderCake',orderCake).
                when('/orderResult',orderResult).
                when('/orderPayWeixin/:NUM/:OID',orderPayWeixin).
                when('/orderPayWeixin/:NUM',orderPayWeixin).
                when('/orderPayAlipay/:NUM/:OID',orderPayAlipay).
                when('/orderPayAlipay/:NUM',orderPayAlipay).
                when('/webPs',webPs).
                otherwise({
                    redirectTo: '/'
                });
            $locationProvider.html5Mode(true).hashPrefix('!');
        }
    ]);

'use strict';
/*global angular, jsGen, marked, Sanitize, Markdown, prettyPrint, toastr, CryptoJS, utf8, store, JSONKit*/

jsGen
.factory('restAPI', ['$resource',
    function ($resource) {
        return {
            index: $resource('/api/index/:OP'),
            user: $resource('/api/user/:ID/:OP'),
            article: $resource('/api/article/:ID/:OP'),
            order: $resource('/api/order/:ID/:OP'),
            tag: $resource('/api/tag/:ID/:OP')
        };
    }
])
.factory('cache', ['$cacheFactory',
    function ($cacheFactory) {
        return {
            user: $cacheFactory('user', {
                capacity: 20
            }),
            article: $cacheFactory('article', {
                capacity: 100
            }),
            order: $cacheFactory('order', {
                capacity: 100
            }),
            comment: $cacheFactory('comment', {
                capacity: 500
            }),
            list: $cacheFactory('list', {
                capacity: 100
            })
        };
    }
])
.factory('myConf', ['$cookieStore', 'JSONKit',
    function ($cookieStore, JSONKit) {
        function checkValue(value, defaultValue) {
            return value == null ? defaultValue : value;
        }

        function myCookies(name, initial) {
            return function (value, pre, defaultValue) {
                pre = JSONKit.toStr(pre) + name;
                defaultValue = checkValue(defaultValue, initial);
                var result = checkValue($cookieStore.get(pre), defaultValue);
                if ((value != null) && result !== checkValue(value, defaultValue)) {
                    $cookieStore.put(pre, value);
                    result = value;
                }
                return result;
            };
        }
        return {
            pageSize: myCookies('PageSize', 10),
            sumModel: myCookies('sumModel', true)
        };
    }
])
.factory('anchorScroll', function () {
    function toView(element, top, height) {
        var winHeight = $(window).height();

        element = $(element);
        height = height > 0 ? height : winHeight / 10;
        $('html, body').animate({
            scrollTop: top ? (element.offset().top - height) : (element.offset().top + element.outerHeight() + height - winHeight)
        }, {
            duration: 200,
            easing: 'linear',
            complete: function () {
                if (!inView(element)) {
                    element[0].scrollIntoView( !! top);
                }
            }
        });
    }

    function inView(element) {
        element = $(element);

        var win = $(window),
            winHeight = win.height(),
            eleTop = element.offset().top,
            eleHeight = element.outerHeight(),
            viewTop = win.scrollTop(),
            viewBottom = viewTop + winHeight;

        function isInView(middle) {
            return middle > viewTop && middle < viewBottom;
        }

        if (isInView(eleTop + (eleHeight > winHeight ? winHeight : eleHeight) / 2)) {
            return true;
        } else if (eleHeight > winHeight) {
            return isInView(eleTop + eleHeight - winHeight / 2);
        } else {
            return false;
        }
    }

    return {
        toView: toView,
        inView: inView
    };
})
.factory('isVisible', function () {
    return function (element) {
        var rect = element[0].getBoundingClientRect();
        return Boolean(rect.bottom - rect.top);
    };
})
.factory('applyFn', ['$rootScope',
    function ($rootScope) {
        return function (fn, scope) {
            fn = angular.isFunction(fn) ? fn : angular.noop;
            scope = scope && scope.$apply ? scope : $rootScope;
            fn();
            if (!scope.$$phase) {
                scope.$apply();
            }
        };
    }
])
.factory('timing', ['$rootScope', '$q', '$exceptionHandler',
    function ($rootScope, $q, $exceptionHandler) {
        function timing(fn, delay, times) {
            var timingId, count = 0,
                defer = $q.defer(),
                promise = defer.promise;

            fn = angular.isFunction(fn) ? fn : angular.noop;
            delay = parseInt(delay, 10);
            times = parseInt(times, 10);
            times = times >= 0 ? times : 0;
            timingId = window.setInterval(function () {
                count += 1;
                if (times && count >= times) {
                    window.clearInterval(timingId);
                    defer.resolve(fn(count, times, delay));
                } else {
                    try {
                        fn(count, times, delay);
                    } catch (e) {
                        defer.reject(e);
                        $exceptionHandler(e);
                    }
                }
                if (!$rootScope.$$phase) {
                    $rootScope.$apply();
                }
            }, delay);

            promise.$timingId = timingId;
            return promise;
        }
        timing.cancel = function (promise) {
            if (promise && promise.$timingId) {
                clearInterval(promise.$timingId);
                return true;
            } else {
                return false;
            }
        };
        return timing;
    }
])
.factory('promiseGet', ['$q',
    function ($q) {
        return function (param, restAPI, cacheId, cache) {
            var result, defer = $q.defer();

            result = cacheId && cache && cache.get(cacheId);
            if (result) {
                defer.resolve(result);
            } else {
                restAPI.get(param, function (data) {
                    if (cacheId && cache) {
                        cache.put(cacheId, data);
                    }
                    defer.resolve(data);
                }, function (data) {
                    defer.reject(data.error);
                });
            }
            return defer.promise;
        };
    }
])
.factory('getList', ['restAPI', 'cache', 'promiseGet',
    function (restAPI, cache, promiseGet) {
        return function (listType) {
            return promiseGet({
                ID: listType,
                s: 10
            }, restAPI.article, listType, cache.list);
        };
    }
])
.factory('getArticle', ['restAPI', 'cache', 'promiseGet',
    function (restAPI, cache, promiseGet) {
        return function (ID) {
            return promiseGet({
                ID: ID
            }, restAPI.article, ID, cache.article);
        };
    }
])
.factory('getUser', ['restAPI', 'cache', 'promiseGet',
    function (restAPI, cache, promiseGet) {
        return function (ID) {
            return promiseGet({
                ID: ID
            }, restAPI.user, ID, cache.user);
        };
    }
])
.factory('getMarkdown', ['$http',
    function ($http) {
        return $http.get('/static/md/markdown.md', {
            cache: true
        });
    }
])
.factory('toast', ['$log', 'JSONKit',
    function ($log, JSONKit) {
        var toast = {},
            methods = ['info', 'error', 'success', 'warning'];

        angular.forEach(methods, function (x) {
            toast[x] = function (message, title) {
                var log = $log[x] || $log.log;
                title = JSONKit.toStr(title);
                log(message, title);
                message = angular.isObject(message) ? angular.toJson(message) : JSONKit.toStr(message);
                toastr[x](message, title);
            };
        });
        toastr.options = angular.extend({
            positionClass: 'toast-bottom-full-width'
        }, toast.options);
        toast.clear = toastr.clear;
        return toast;
    }
])
.factory('pretty', function () {
    return window.prettyPrint;
})
.factory('param', function () {
    return $.param;
})
.factory('CryptoJS', function () {
    return window.CryptoJS;
})
.factory('utf8', function () {
    return window.utf8;
})
.factory('store', function () {
    return window.store;
})
.factory('JSONKit', function () {
    return window.JSONKit;
})
.factory('mdParse', ['JSONKit',
    function (JSONKit) {
        return function (html) {
            return window.marked(JSONKit.toStr(html));
        };
    }
])
.factory('sanitize', ['JSONKit',
    function (JSONKit) {
        var San = Sanitize,
            config = San.Config,
            sanitize = [
                new San({}),
                new San(config.RESTRICTED),
                new San(config.BASIC),
                new San(config.RELAXED)
            ];
        // level: 0, 1, 2, 3
        return function (html, level) {
            var innerDOM = document.createElement('div'),
                outerDOM = document.createElement('div');
            level = level >= 0 ? level : 3;
            innerDOM.innerHTML = JSONKit.toStr(html);
            outerDOM.appendChild(sanitize[level].clean_node(innerDOM));
            return outerDOM.innerHTML;
        };
    }
])
.factory('mdEditor', ['mdParse', 'sanitize', 'pretty', 'JSONKit',
    function (mdParse, sanitize, pretty, JSONKit) {
        return function (idPostfix, level) {
            idPostfix = JSONKit.toStr(idPostfix);
            var editor = new Markdown.Editor({
                makeHtml: function (text) {
                    return sanitize(mdParse(text), level);
                }
            }, idPostfix);
            var element = angular.element(document.getElementById('wmd-preview' + idPostfix));
            editor.hooks.chain('onPreviewRefresh', function () {
                angular.forEach(element.find('code'), function (value) {
                    value = angular.element(value);
                    if (!value.parent().is('pre')) {
                        value.addClass('prettyline');
                    }
                });
                element.find('pre').addClass('prettyprint'); // linenums have bug!
                pretty();
            });
            return editor;
        };
    }
]);
'use strict';
/*global angular, jsGen*/

jsGen
.filter('placeholder', ['JSONKit',
    function (JSONKit) {
        return function (str) {
            return JSONKit.toStr(str) || '-';
        };
    }
])
.filter('match', ['$locale',
    function ($locale) {
        return function (value, type) {
            return $locale.FILTER[type] && $locale.FILTER[type][value] || '';
        };
    }
])
.filter('switch', ['$locale',
    function ($locale) {
        return function (value, type) {
            return $locale.FILTER[type] && $locale.FILTER[type][+ !! value] || '';
        };
    }
])
.filter('checkName', ['JSONKit',
    function (JSONKit) {
        return function (text) {
            var reg = /^[(\u4e00-\u9fa5)a-z][(\u4e00-\u9fa5)a-zA-Z0-9_]{1,}$/;
            text = JSONKit.toStr(text);
            return reg.test(text);
        };
    }
])
.filter('length', ['utf8', 'JSONKit',
    function (utf8, JSONKit) {
        return function (text) {
            text = JSONKit.toStr(text);
            return utf8.stringToBytes(text).length;
        };
    }
])
.filter('cutText', ['utf8', 'JSONKit',
    function (utf8, JSONKit) {
        return function (text, len) {
            text = JSONKit.toStr(text).trim();
            var bytes = utf8.stringToBytes(text);
            len = len > 0 ? len : 0;
            if (bytes.length > len) {
                bytes.length = len;
                text = utf8.bytesToString(bytes);
                text = text.slice(0, -2) + '…';
            }
            return text;
        };
    }
])
.filter('formatDate', ['$filter', '$locale',
    function ($filter, $locale) {
        return function (date, full) {
            var o = Date.now() - date,
                dateFilter = $filter('date');
            if (full) {
                return dateFilter(date, $locale.DATETIME.fullD);
            } else if (o > 259200000) {
                return dateFilter(date, $locale.DATETIME.shortD);
            } else if (o > 86400000) {
                return Math.floor(o / 86400000) + $locale.DATETIME.dayAgo;
            } else if (o > 3600000) {
                return Math.floor(o / 3600000) + $locale.DATETIME.hourAgo;
            } else if (o > 60000) {
                return Math.floor(o / 60000) + $locale.DATETIME.minuteAgo;
            } else {
                return $locale.DATETIME.secondAgo;
            }
        };
    }
])
.filter('formatTime', ['$locale',
    function ($locale) {
        return function (seconds) {
            var re = '',
                q = 0,
                o = seconds > 0 ? Math.round(+seconds) : Math.floor(Date.now() / 1000),
                TIME = $locale.DATETIME;

            function calculate(base) {
                q = o % base;
                o = (o - q) / base;
                return o;
            }
            calculate(60);
            re = q + TIME.second;
            calculate(60);
            re = (q > 0 ? (q + TIME.minute) : '') + re;
            calculate(24);
            re = (q > 0 ? (q + TIME.hour) : '') + re;
            return o > 0 ? (o + TIME.day + re) : re;
        };
    }
])
.filter('formatBytes', ['$locale',
    function ($locale) {
        return function (bytes) {
            bytes = bytes > 0 ? bytes : 0;
            if (!bytes) {
                return '-';
            } else if (bytes < 1024) {
                return bytes + 'B';
            } else if (bytes < 1048576) {
                return (bytes / 1024).toFixed(3) + ' KiB';
            } else if (bytes < 1073741824) {
                return (bytes / 1048576).toFixed(3) + ' MiB';
            } else {
                return (bytes / 1073741824).toFixed(3) + ' GiB';
            }
        };
    }
]);
'use strict';
/*global angular, $, jsGen*/

jsGen
.directive('genParseMd', ['mdParse', 'sanitize', 'pretty', 'isVisible', '$timeout',
    function (mdParse, sanitize, pretty, isVisible, $timeout) {
        // <div gen-parse-md="document"></div>
        // document是Markdown格式或一般文档字符串，解析成DOM后插入<div>
        return function (scope, element, attr) {
            scope.$watch(attr.genParseMd, function (value) {
                if (isVisible(element)) {
                    parseDoc(value);
                } else {
                    $timeout(function () {
                        parseDoc(value);
                    }, 500);
                }
            });

            function parseDoc(value) {
                if (angular.isDefined(value)) {
                    value = mdParse(value);
                    value = sanitize(value);
                    element.html(value);
                    angular.forEach(element.find('code'), function (value) {
                        value = angular.element(value);
                        if (!value.parent().is('pre')) {
                            value.addClass('prettyline');
                        }
                    });
                    element.find('pre').addClass('prettyprint'); // linenums have bug!
                    element.find('a').attr('target', function () {
                        if (this.host !== location.host) {
                            return '_blank';
                        }
                    });
                    pretty();
                }
            }
        };
    }
])
.directive('genTabClick', function () {
    //<ul>
    //<li gen-tab-click="className"></li>
    //<li gen-tab-click="className"></li>
    //</ul>
    // 点击li元素时，该元素将赋予className类，并移除其它兄弟元素的className类
    return {
        link: function (scope, element, attr) {
            var className = attr.genTabClick;
            element.bind('click', function () {
                element.parent().children().removeClass(className);
                element.addClass(className);
            });
        }
    };
})
.directive('genPagination', function () {
    // <div gen-pagination="options"></div>
    // HTML/CSS修改于Bootstrap框架
    // options = {
    //     path: 'pathUrl',
    //     sizePerPage: [25, 50, 100],
    //     pageSize: 25,
    //     pageIndex: 1,
    //     total: 10
    // };
    return {
        scope: true,
        templateUrl: 'gen-pagination.html',
        link: function (scope, element, attr) {
            scope.$watchCollection(attr.genPagination, function (value) {
                if (!angular.isObject(value)) {
                    return;
                }
                var pageIndex = 1,
                    showPages = [],
                    lastPage = Math.ceil(value.total / value.pageSize) || 1;

                pageIndex = value.pageIndex >= 1 ? value.pageIndex : 1;
                pageIndex = pageIndex <= lastPage ? pageIndex : lastPage;

                showPages[0] = pageIndex;
                if (pageIndex <= 6) {
                    while (showPages[0] > 1) {
                        showPages.unshift(showPages[0] - 1);
                    }
                } else {
                    showPages.unshift(showPages[0] - 1);
                    showPages.unshift(showPages[0] - 1);
                    showPages.unshift('…');
                    showPages.unshift(2);
                    showPages.unshift(1);
                }

                if (lastPage - pageIndex <= 5) {
                    while (showPages[showPages.length - 1] < lastPage) {
                        showPages.push(showPages[showPages.length - 1] + 1);
                    }
                } else {
                    showPages.push(showPages[showPages.length - 1] + 1);
                    showPages.push(showPages[showPages.length - 1] + 1);
                    showPages.push('…');
                    showPages.push(lastPage - 1);
                    showPages.push(lastPage);
                }

                scope.prev = pageIndex > 1 ? pageIndex - 1 : 0;
                scope.next = pageIndex < lastPage ? pageIndex + 1 : 0;
                scope.total = value.total;
                scope.pageIndex = pageIndex;
                scope.showPages = showPages;
                scope.pageSize = value.pageSize;
                scope.perPages = value.sizePerPage || [10, 20, 50];
                scope.path = value.path && value.path + '?p=';
            });
            scope.paginationTo = function (p, s) {
                if (!scope.path && p > 0) {
                    s = s || scope.pageSize;
                    scope.$emit('genPagination', p, s);
                }
            };
        }
    };
})
.directive('genModal', ['$timeout',
    function ($timeout) {
        //<div gen-modal="msgModal">[body]</div>
        // scope.msgModal = {
        //     id: 'msg-modal',    [option]
        //     title: 'message title',    [option]
        //     width: 640,    [option]
        //     confirmBtn: 'confirm button name',    [option]
        //     confirmFn: function () {},    [option]
        //     cancelBtn: 'cancel button name',    [option]
        //     cancelFn: function () {}    [option]
        //     deleteBtn: 'delete button name',    [option]
        //     deleteFn: function () {}    [option]
        // };
        var uniqueModalId = 0;
        return {
            scope: true,
            transclude: true,//保持标签内部内容不变
            templateUrl: 'gen-modal.html',
            //link
            link: function (scope, element, attr) {
                var modalStatus,
                    modalElement = element.children(),
                    list = ['Confirm', 'Cancel', 'Delete'],
                    options = scope.$eval(attr.genModal),
                    isFunction = angular.isFunction;

                function wrap(fn) {
                    return function () {
                        var value = isFunction(fn) ? fn() : true;
                        showModal(!value);
                    };
                }

                function resize() {
                    var jqWin = $(window),
                        element = modalElement.children(),
                        top = (jqWin.height() - element.outerHeight()) * 0.382,
                        css = {};

                    css.marginTop = top > 0 ? top : 0;
                    element.css(css);
                }

                function showModal(value) {
                    modalElement.modal(value ? 'show' : 'hide');
                    if (value) {
                        $timeout(resize);
                    }
                }

                options.cancelFn = options.cancelFn || true;
                options.backdrop = options.backdrop || true;
                options.show = options.show || false;
                options.modal = showModal;

                scope.$watch(function () {
                    return options;
                }, function (value) {
                    angular.extend(scope, value);
                }, true);

                scope.id = scope.id || attr.genModal + '-' + (uniqueModalId++);
                angular.forEach(list, function (name) {
                    var x = name.toLowerCase(),
                        cb = x + 'Cb',
                        fn = x + 'Fn',
                        btn = x + 'Btn';
                    scope[cb] = options[fn] && wrap(options[fn]);
                    scope[btn] = options[btn] || (options[fn] && name);
                });

                modalElement.on('shown.bs.modal', function (event) {
                    modalStatus = true;
                });
                modalElement.on('hidden.bs.modal', function (event) {
                    if (modalStatus && isFunction(options.cancelFn)) {
                        options.cancelFn(); // when hide by other way, run cancelFn;
                    }
                    modalStatus = false;
                });
                modalElement.modal(options);
            }
        };
    }
])
.directive('genTooltip', ['$timeout', 'isVisible',
    function ($timeout, isVisible) {
        //<div data-original-title="tootip title" gen-tooltip="tootipOption"></div>
        // tootipOption = {
        //     validate: false, // if true, use for AngularJS validation
        //     validateMsg : {
        //         required: 'Required!',
        //         minlength: 'Too short!'
        //     }
        //     ...other bootstrap tooltip options
        // }
        return {
            require: '?ngModel',
            link: function (scope, element, attr, ctrl) {
                var enable = false,
                    option = scope.$eval(attr.genTooltip) || {};

                function invalidMsg(invalid) {
                    ctrl.validate = enable && option.validate && isVisible(element);
                    if (ctrl.validate) {
                        var title = (ctrl.$name && ctrl.$name + ' ') || '';
                        if (invalid && option.validateMsg) {
                            angular.forEach(ctrl.$error, function (value, key) {
                                title += (value && option.validateMsg[key] && option.validateMsg[key] + ', ') || '';
                            });
                        }
                        title = title.slice(0, -2) || attr.originalTitle || attr.title;
                        attr.$set('dataOriginalTitle', title ? title : '');
                        showTooltip( !! invalid);
                    } else {
                        showTooltip(false);
                    }
                }

                function validateFn(value) {
                    $timeout(function () {
                        invalidMsg(ctrl.$invalid);
                    });
                    return value;
                }

                function initTooltip() {
                    element.off('.tooltip').removeData('bs.tooltip');
                    element.tooltip(option);
                }

                function showTooltip(show) {
                    if (element.hasClass('invalid-error') !== show) {
                        element[show ? 'addClass' : 'removeClass']('invalid-error');
                        element.tooltip(show ? 'show' : 'hide');
                    }
                }

                if (option.container === 'inner') {
                    option.container = element;
                } else if (option.container === 'ngView') {
                    option.container = element.parents('.ng-view')[0] || element.parents('[ng-view]')[0];
                }
                // use for AngularJS validation
                if (option.validate) {
                    option.template = '<div class="tooltip validate-tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>';
                    option.trigger = 'manual';
                    option.placement = option.placement || 'right';
                    if (ctrl) {
                        ctrl.$formatters.push(validateFn);
                        ctrl.$parsers.push(validateFn);
                    } else {
                        scope.$watch(function () {
                            return attr.originalTitle || attr.dataOriginalTitle;
                        }, showTooltip);
                    }
                    element.bind('focus', function () {
                        element.trigger('input');
                        element.trigger('change');
                    });
                    scope.$on('genTooltipValidate', function (event, collect, turnoff) {
                        enable = !turnoff;
                        if (ctrl) {
                            if (angular.isArray(collect)) {
                                collect.push(ctrl);
                            }
                            invalidMsg(ctrl.$invalid);
                        }
                    });
                } else if (option.click) {
                    // option.click will be 'show','hide','toggle', or 'destroy'
                    element.bind('click', function () {
                        element.tooltip(option.click);
                    });
                }
                element.bind('hidden.bs.tooltip', initTooltip);
                initTooltip();
            }
        };
    }
])
.directive('genMoving', ['anchorScroll',
    function (anchorScroll) {
        return {
            link: function (scope, element, attr) {
                var option = scope.$eval(attr.genMoving);

                function resetTextarea() {
                    var textarea = element.find('textarea');
                    if (textarea.is(textarea)) {
                        textarea.css({
                            height: 'auto',
                            width: '100%'
                        });
                    }
                }

                option.appendTo = function (selector) {
                    element.appendTo($(selector));
                    resetTextarea();
                };
                option.prependTo = function (selector) {
                    element.prependTo($(selector));
                    resetTextarea();
                };
                option.childrenOf = function (selector) {
                    return $(selector).find(element).is(element);
                };
                option.scrollIntoView = function (top, height) {
                    anchorScroll.toView(element, top, height);
                };
                option.inView = function () {
                    return anchorScroll.inView(element);
                };
            }
        };
    }
])
.directive('genSrc', ['isVisible',
    function (isVisible) {
        return {
            priority: 99,
            link: function (scope, element, attr) {
                attr.$observe('genSrc', function (value) {
                    if (value && isVisible(element)) {
                        var img = new Image();
                        img.onload = function () {
                            attr.$set('src', value);
                        };
                        img.src = value;
                    }
                });
            }
        };
    }
])
.directive('genUploader', [ 'app','FileUploader',
    function ( app,FileUploader) {
        // <div gen-uploader="uploaderOptions"></div>
        // HTML/CSS修改于Bootstrap框架
        // uploaderOptions = {
    //        scope: $scope,
    //            allowFileType: upyun.allowFileType,
    //            url: upyun.url,
    //            baseUrl: baseUrl,
    //            policy: upyun.policy,
    //            signature: upyun.signature,
    //            clickImage: function (file) {
    //            $scope.article.content += '\n' + '![' + file.name + '](' + file.url + ')\n';
    //        }
    //    };
        return {
            scope: true,
            templateUrl: 'gen-uploader.html',
            link: function (scope, element, attr) {
                var options = scope.$eval(attr.genUploader);
                scope.triggerUpload = function () {
                    setTimeout(function () {
                        element.find('.upload-input').click();
                    });
                };
                scope.clickImage = options.clickImage || angular.noop;


            }
        };
    }
]);

'use strict';
/*global angular, jsGen*/

jsGen
    .controller('cakeCtrl', ['app', '$scope',
        function (app, $scope) {
            $scope.tip1 = "hidden";
            $scope.tip2 = "hidden";
            $scope.tip3 = "hidden";
            $scope.height = $(window).height() - 80;


            var global = app.rootScope.global;
            global.next = "/cake1";
            global.prev = "/cake1";

            global.isIndex = true;
            global.noOverflow = true;
            if(!global.fireworksTimer && !global.isPhone){
                global.fireworksTimer = setInterval(window.happyNewYear,1000);
            }
            setTimeout(function () {
                angular.element("#next").click();
            }, 8000);

            global.tipsTimer = setInterval(function () {
                if (Math.floor(Math.random() * 10) % 3 === 0) {
                    $scope.tip1 = 'show';
                } else {
                    $scope.tip1 = 'hidden';
                }
                if (Math.floor(Math.random() * 10) % 4 === 0) {
                    $scope.tip2 = 'show';
                } else {
                    $scope.tip2 = 'hidden';
                }
                if (Math.floor(Math.random() * 10) % 3 === 0) {
                    $scope.tip3 = 'show';
                } else {
                    $scope.tip3 = 'hidden';
                }
                $scope.$apply();
            }, 3000);


        }
    ])
    .controller('cake1Ctrl', ['app','$scope',
        function (app,$scope) {
            setTimeout(function () {
                angular.element("#next").click();
            }, 8000);

            var global = app.rootScope.global;
            global.next = "/";
            global.prev = "/";
            if(global.tipsTimer)
                clearInterval(global.tipsTimer);
            global.isIndex = true;
            global.noOverflow = true;
            $scope.height = $(window).height();


        }
    ])
    .controller('selectCakeCtrl', ['app', '$scope', '$routeParams', 'getList',
        function (app, $scope, $routeParams, getList) {
            //ToDo: 查询有哪些商家，商家支持定制哪些蛋糕
            var ID = 'latest',
                restAPI = app.restAPI.article,
                myConf = app.myConf,
                global = app.rootScope.global;

            global.isIndex = false;
            global.noOverflow = false;


            global.title2 = global.description;
            $scope.special=false;
            $scope.parent = {
                getTpl: 'index-cake.html',
                viewPath: '/latest',
                sumModel: myConf.sumModel(null, 'index', true)
            };
            if(global.tipsTimer)
                clearInterval(global.tipsTimer);
            if(global.fireworksTimer){
                clearInterval(global.fireworksTimer);
                global.fireworksTimer = 0;
            }

            function checkRouteParams() {
                var path = app.location.path().slice(1).split('/');
                if ($routeParams.TAG || (/^T[0-9A-Za-z]{3,}$/).test(path[0])) {
                    restAPI = app.restAPI.tag;
                    $scope.other._id = path[0];
                    $scope.other.title = $routeParams.TAG || path[0];
                    $scope.parent.viewPath = '';
                } else {
                    restAPI = app.restAPI.article;
                    $scope.parent.viewPath = path[0] || 'latest';
                }
                ID = $routeParams.TAG || path[0] || 'latest';
            }

            function getArticleList() {
                var params = {
                    ID: ID,
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'index', 20)
                };

                app.promiseGet(params, restAPI, app.param(params), app.cache.list).then(function (data) {
                    var pagination = data.pagination || {};
                    if (data.tag) {
                        $scope.other.title = data.tag.tag;
                        $scope.other._id = data.tag._id;
                    }
                    pagination.path = app.location.path();
                    pagination.pageSize = myConf.pageSize(pagination.pageSize, 'index');
                    $scope.pagination = pagination;
                    $scope.articleList = data.data;
                });
            }


            $scope.other = {};
            $scope.pagination = {};

            $scope.setListModel = function () {
                var parent = $scope.parent;
                parent.sumModel = myConf.sumModel(!parent.sumModel, 'index');
                myConf.pageSize(parent.sumModel ? 20 : 10, 'index');
                app.location.search({});
            };

            checkRouteParams();
            getArticleList();
            getList('comment').then(function (data) {
                data = app.union(data.data);
                app.each(data, function (x, i) {
                    x.content = app.filter('cutText')(x.content, 180);
                });
                $scope.hotComments = data.slice(0, 6);
            });



        }
    ])
    .controller('makeCakeCtrl', ['app', '$scope',
        function (app, $scope) {
            var global = app.rootScope.global;
            if(global.user){
                if(global.selectCake.author._id === global.user._id){
                    app.toast.success("用户不能购买自己发布的商品！");
                    $scope.nextDisable = true;
                }
            }else{
                app.toast.success("请您先登录，然后下单！");
                $scope.nextDisable = true;
            }

        }])
    .controller('orderCakeCtrl', ['app', '$scope','$routeParams',
        function (app, $scope,$routeParams) {
            var global = app.rootScope.global,
                restAPI = app.restAPI.order,
                myConf = app.myConf,
                orderCache = app.cache.order;
            global.order = global.order || {};
            $scope.addOn = global.order.addOn?global.order.addOn:"";
            $scope.phoneNumber =global.order.phoneNumber || global.user.phoneNumber;
            $scope.location=global.order.address || global.user.location;
            $scope.showPic = global.order.finalPic || (global.cloudDomian+"/"+window.finalPic);


            $scope.selectSix = function(){
                $scope.selectSize = global.order.selectSize?global.order.selectSize:6;
                $scope.num = global.order.price? (global.order.price -3) :(global.selectCake.price.six - 3);
            };
            $scope.selectEight = function(){
                $scope.selectSize = global.order.selectSize?global.order.selectSize:8;
                $scope.num = global.order.price? (global.order.price -3) :(global.selectCake.price.eight - 3);
            };
            $scope.selectTen = function(){
                $scope.selectSize = global.order.selectSize?global.order.selectSize:10;
                $scope.num = global.order.price? (global.order.price -3) :(global.selectCake.price.ten - 3);
            };
            $scope.selectTwelve = function(){
                $scope.selectSize = global.order.selectSize?global.order.selectSize:12;
                $scope.num = global.order.price? (global.order.price -3) :(global.selectCake.price.twelve - 3);
            };
            $scope.selectFourteen = function(){
                $scope.selectSize = global.order.selectSize?global.order.selectSize:14;
                $scope.num = global.order.price? (global.order.price -3) :(global.selectCake.price.fourteen - 3);
            };
            $scope.selectSixteen = function(){
                $scope.selectSize = global.order.selectSize?global.order.selectSize:16;
                $scope.num = global.order.price? (global.order.price -3) :(global.selectCake.price.sixteen - 3);
            };
            //默认选择8寸
            if(!global.order.selectSize){
                $scope.selectEight();
            }

            $scope.shopper = global.order.shopperId;


            function getShoppersList(){
                var params = {
                    ID: "getShoppersList",
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'shopper', 20),
                    location:window.city
                };
                app.promiseGet(params, app.restAPI.user, app.param(params), app.cache.list).then(function (data) {
                    var pagination = data.pagination || {};

                    pagination.path = app.location.path();
                    pagination.pageSize = myConf.pageSize(pagination.pageSize, 'shopper');
                    $scope.pagination = pagination;
                    $scope.shoppers = data.data;
                });
            }
            $scope.selectShop = function(){
                getShoppersList();
                app.rootScope.selectShopModal.modal(true);
            };
            $scope.selectShopperID = function(shop){
                $scope.shopper = shop;
                app.rootScope.selectShopModal.modal(false);
            };



            $scope.makeOrder = function () {
                if(!$scope.shopper){
                    app.toast.success("请您选择附近的蛋糕店！");
                }else if($scope.location.length < 4 || $scope.phoneNumber.length < 11){
                    app.toast.success("请您认真填写配送信息！");
                }else if(($scope.shopper && ($scope.shopper._id === global.user._id)) ){
                    app.toast.success("用户不能购买自己发布的商品！");
                }else{
                    $scope.num = $scope.num+"";
                    var data = {
                        _id: global.order._id || 0,
                        size:$scope.selectSize,
                        price: global.order.price || $scope.num,//订单价格
                        cakeName: global.order.cakeName || global.selectCake.title,//蛋糕名称
                        cakeId: global.order.cakeId || global.selectCake._id,//蛋糕的id，就是article的id
                        shopperId: $scope.shopper._id,
                        ownerId: global.order.ownerId || global.user._id,//买蛋糕人的id
                        uploadPic: global.order.uploadPic ||( global.cloudDomian+"/"+window.uploadPic),//用户上传的图片
                        finalPic: global.order.finalPic || ( global.cloudDomian+"/"+window.finalPic),//用户制作的最终效果图片
                        addOn: $scope.addOn,//订单附言备注
                        orderStatus: 1, //订单状态
                        phoneNumber:$scope.phoneNumber,
                        address:$scope.location
                    };
                    console.log(data);

                    if (app.validate($scope)) {
                        //更新用户信息
                        //更新地址信息
                        if(global.user.location==="" || global.user.phoneNumber===""){
                        app.restAPI.user.save({
                        }, {
                            desc: global.user.location===""?$scope.location:global.user.location,
                            phoneNumber:global.user.phoneNumber===""?$scope.phoneNumber:global.user.phoneNumber
                        }, function () {
                            app.toast.success("用户手机号或配送地址更新成功");
                        });
                    }

                        //下订单
                        restAPI.save({
                            ID: data._id === 0?'index':'update'
                        }, data, function (data) {
                            var order = data.data;
                            $scope.Oid = "CC800400"+order._id;

                            $("#nextAlipay").attr("href","/orderPayAlipay/"+$scope.num+"/"+$scope.Oid);
                            $("#nextWeixin").attr("href","/orderPayWeixin/"+$scope.num+"/"+$scope.Oid);


                            if(global.order._id){
                                orderCache.remove(order._id);
                                orderCache.put(order._id, order);
                                global.user.ordersList[global.orderIndex]=order;
                                app.toast.success("订单更新成功！");
                            }else{
                                orderCache.put(order._id, order);
                                global.user.ordersList.unshift(order);
                                app.toast.success("订单创建成功！");
                            }


                            global.selectCakeOrder = order;
                            global.selectCakeOrder.createTime = new Date(global.selectCakeOrder.createTime).pattern("yyyy-MM-dd HH:mm:ss");
                            //跳转到支付订单页面
                            if($scope.selectIcon){
                                //支付宝
                                document.getElementById("nextAlipay").click();
//                                window.open("/orderPayAlipay");
//                               window.open("https://shenghuo.alipay.com/transfer/gathering/create.htm?totleFee="+price+"&optEmail="+ global.alipayEmail+"&isSend=checked&smsNO="+global.alipayTel+"&title=cakeOrder"+order._id);
                            }else{
                            //微信
                                document.getElementById("nextWeixin").click();
//                                window.open("/orderPayWeixin");
                            }

                            global.order = {};
                            app.location.path('/orderResult');
                        });
                    }else{
                        app.toast.error("订单创建失败！");
                    }
                }
            };
            $scope.selectIcon = true;
            $scope.selectAlipay = function(){
                $scope.selectIcon = true;
            };
            $scope.selectWeixin = function(){
                $scope.selectIcon = false;
            };

        }])
    .controller('orderResultCtrl', ['app', '$scope', '$routeParams',
        function (app, $scope,$routeParams) {
            var global = app.rootScope.global;
            $scope.num = $routeParams.NUM;
            $scope.oid = $routeParams.OID;

        }])
    .controller('indexCtrl', ['app', '$scope', '$routeParams', 'getList',
        function (app, $scope, $routeParams, getList) {
            var ID = '',
                restAPI = app.restAPI.article,
                myConf = app.myConf,
                global = app.rootScope.global;

            function checkRouteParams() {
                var path = app.location.path().slice(1).split('/');
                if ($routeParams.TAG || (/^T[0-9A-Za-z]{3,}$/).test(path[0])) {
                    restAPI = app.restAPI.tag;
                    $scope.other._id = path[0];
                    $scope.other.title = $routeParams.TAG || path[0];
                    $scope.parent.viewPath = '';
                } else {
                    restAPI = app.restAPI.article;
                    $scope.parent.viewPath = path[0] || 'latest';
                }
                ID = $routeParams.TAG || path[0] || 'latest';
            }

            function getArticleList() {
                var params = {
                    ID: ID,
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'index', 20)
                };

                app.promiseGet(params, restAPI, app.param(params), app.cache.list).then(function (data) {
                    var pagination = data.pagination || {};
                    if (data.tag) {
                        $scope.other.title = data.tag.tag;
                        $scope.other._id = data.tag._id;
                    }
                    pagination.path = app.location.path();
                    pagination.pageSize = myConf.pageSize(pagination.pageSize, 'index');
                    $scope.pagination = pagination;
                    $scope.articleList = data.data;
                });
            }

            global.title2 = global.description;
            $scope.parent = {
                getTpl: 'index-article.html',
                viewPath: 'latest',
                sumModel: myConf.sumModel(null, 'index', false)
            };
            $scope.other = {};
            $scope.pagination = {};

            $scope.setListModel = function () {
                var parent = $scope.parent;
                parent.sumModel = myConf.sumModel(!parent.sumModel, 'index');
                myConf.pageSize(parent.sumModel ? 20 : 10, 'index');
                app.location.search({});
            };

            checkRouteParams();
            getArticleList();
            getList('comment').then(function (data) {
                data = app.union(data.data);
                app.each(data, function (x, i) {
                    x.content = app.filter('cutText')(x.content, 180);
                });
                $scope.hotComments = data.slice(0, 6);
            });
        }
    ])
    .controller('tagCtrl', ['app', '$scope', '$routeParams', 'getList',
        function (app, $scope, $routeParams, getList) {
            var restAPI = app.restAPI.tag,
                myConf = app.myConf,
                params = {
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'tag', 50)
                };

            app.rootScope.global.title2 = app.locale.TAG.title;
            $scope.parent = {
                getTpl: 'index-tag.html'
            };
            $scope.pagination = {};

            app.promiseGet(params, restAPI, app.param(params), app.cache.list).then(function (data) {
                var pagination = data.pagination || {};
                pagination.path = app.location.path();
                pagination.pageSize = myConf.pageSize(pagination.pageSize, 'tag');
                pagination.sizePerPage = [50, 100, 200];
                $scope.pagination = pagination;
                $scope.tagList = data.data;
            });

            getList('comment').then(function (data) {
                data = app.union(data.data);
                app.each(data, function (x, i) {
                    x.content = app.filter('cutText')(x.content, 180);
                });
                $scope.hotComments = data.slice(0, 6);
            });
        }
    ])
    .controller('userLoginCtrl', ['app', '$scope',
        function (app, $scope) {
            app.rootScope.global.isIndex = false;
            app.clearUser();

            var global = app.rootScope.global;
            if(global.tipsTimer)
                clearInterval(global.tipsTimer);
            if(global.fireworksTimer){
                clearInterval(global.fireworksTimer);
                global.fireworksTimer = 0;
            }

            app.rootScope.global.title2 = app.locale.USER.login;
            $scope.login = {
                logauto: true,
                logname: '',
                logpwd: ''
            };
            $scope.reset = {
                title: '',
                type: ''
            };

            $scope.submit = function () {
                if (app.validate($scope)) {
                    var data = app.union($scope.login);
                    data.logtime = Date.now() - app.timeOffset;
                    data.logpwd = app.CryptoJS.SHA256(data.logpwd).toString();
                    data.logpwd = app.CryptoJS.HmacSHA256(data.logpwd, 'ekaCtciP').toString();
                    data.logpwd = app.CryptoJS.HmacSHA256(data.logpwd, data.logname + ':' + data.logtime).toString();

                    app.restAPI.user.save({
                        ID: 'login'
                    }, data, function (data) {
                        app.rootScope.global.user = data.data;
                        app.checkUser();
                        $scope.$destroy();
                        app.location.path('/latest');
                    }, function (data) {
                        $scope.reset.type = data.error.name;
                        $scope.reset.title = app.locale.RESET[data.error.name];
                    });
                }
            };
        }
    ])
    .controller('userResetCtrl', ['app', '$scope', '$routeParams',
        function (app, $scope, $routeParams) {
            var timing,
                locale = app.locale,
                global = app.rootScope.global;

            global.isIndex = false;
            global.noOverflow = false;

            function showModal() {
                $scope.timingModal.modal(true);
                timing = app.timing(function (count, times) {
                    $scope.parent.timing = times - count;
                }, 1000, $scope.parent.timing);
                timing.then(function () {
                    $scope.timingModal.modal(false);
                    app.location.search({}).path('/');
                });
            }

            app.rootScope.global.title2 = locale.USER.reset;
            $scope.reset = {
                name: '',
                email: '',
                request: $routeParams.req
            };
            $scope.parent = {
                title: locale.RESET[$routeParams.type],
                timing: 5
            };
            $scope.timingModal = {
                confirmBtn: locale.BTN_TEXT.goBack,
                confirmFn: function () {
                    app.timing.cancel(timing);
                    app.timing(null, 100, 1).then(function () {
                        app.location.search({}).path('/');
                    });
                    return true;
                },
                cancelBtn: locale.BTN_TEXT.cancel,
                cancelFn: function () {
                    return app.timing.cancel(timing);
                }
            };
            $scope.submit = function () {
                if (app.validate($scope)) {
                    app.restAPI.user.save({
                        ID: 'reset'
                    }, $scope.reset, function (data) {
                        app.toast.success(locale.RESET.email, locale.RESPONSE.success);
                        showModal();
                    });
                }
            };
            if (['locked', 'passwd'].indexOf($routeParams.type) < 0) {
                app.restAPI.user.get({
                    ID: 'reset',
                    OP: $routeParams.req
                }, function () {
                    app.toast.success(3 + locale.TIMING.goHome, locale.RESPONSE.success);
                    app.timing(null, 1000, 3).then(function () {
                        app.location.search({}).path('/home');
                    });
                }, showModal);
            }
        }
    ])
    .controller('userRegisterCtrl', ['app', '$scope',
        function (app, $scope) {
            app.rootScope.global.isIndex = false;
            var filter = app.filter,
                lengthFn = filter('length'),
                global = app.rootScope.global;

            app.clearUser();
            global.title2 = app.locale.USER.register;
            $scope.user = {
                name: '',
                email: '',
                phoneNumber: '',
                passwd: '',
                passwd2: ''
            };

            if(global.tipsTimer)
                clearInterval(global.tipsTimer);
            if(global.fireworksTimer){
                clearInterval(global.fireworksTimer);
                global.fireworksTimer = 0;
            }

            $scope.checkName = function (scope, model) {
                return filter('checkName')(model.$value);
            };
            $scope.checkMin = function (scope, model) {
                return lengthFn(model.$value) >= 5;
            };
            $scope.checkMax = function (scope, model) {
                return lengthFn(model.$value) <= 40;
            };
            $scope.submit = function () {
                var user = $scope.user;
                if (app.validate($scope)) {
                    var data = {
                        name: user.name,
                        phoneNumber: user.phoneNumber
                    };
                    data.passwd = app.CryptoJS.SHA256(user.passwd).toString();
                    data.passwd = app.CryptoJS.HmacSHA256(data.passwd, 'ekaCtciP').toString();

                    app.restAPI.user.save({
                        ID: 'register'
                    }, data, function (data) {
                        app.rootScope.global.user = data.data;
                        app.checkUser();
                        $scope.$destroy();
                        app.location.path('/latest');
                    });
                }
            };
        }
    ])
    .controller('homeCtrl', ['app', '$scope', '$routeParams',
        function (app, $scope, $routeParams) {
            var global = app.rootScope.global;
            global.isIndex = false;
            global.noOverflow = false;

            if (!global.isLogin) {
                return app.location.search({}).path('/');
            }
            if(global.fireworksTimer){
                clearInterval(global.fireworksTimer);
                global.fireworksTimer = 0;
            }

            function tplName(path) {
                switch (path) {
                    case 'follow':
                    case 'fans':
                        return 'user-list.html';
                    case 'detail':
                        return 'user-edit.html';
                    case 'article':
                    case 'comment':
                    case 'mark':
                        return 'user-article.html';
                    default:
                        return 'user-order.html';
                }
            }

            global.title2 = app.locale.HOME.title;
            $scope.user = global.user;
            $scope.parent = {
                getTpl: tplName($routeParams.OP),
                isMe: true,
                viewPath: $routeParams.OP || 'index'
            };
        }
    ])
    .controller('userCtrl', ['app', '$scope', '$routeParams', 'getUser',
        function (app, $scope, $routeParams, getUser) {

            function tplName() {
                switch ($routeParams.OP) {
                    case 'fans':
                        return 'user-list.html';
                    case 'article':
                        return 'user-article.html';
                    default:
                        return 'user-article.html';
                }
            }

            app.rootScope.global.title2 = app.locale.USER.title;
            $scope.parent = {
                getTpl: tplName(),
                isMe: false,
                viewPath: $routeParams.OP || 'index'
            };

            getUser('U' + $routeParams.ID).then(function (data) {
                $scope.user = data.data;
                app.rootScope.global.title2 = $scope.user.name + app.locale.USER.title;
            });
        }
    ])
    .controller('userListCtrl', ['app', '$scope', '$routeParams',
        function (app, $scope, $routeParams) {
            var restAPI = app.restAPI.user,
                myConf = app.myConf,
                locale = app.locale,
                params = {
                    ID: $routeParams.ID && 'U' + $routeParams.ID || $routeParams.OP,
                    OP: $routeParams.OP || 'fans',
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'user', 20)
                };

            $scope.parent = {
                title: ''
            };

            app.promiseGet(params, restAPI, app.param(params), app.cache.list).then(function (data) {
                var pagination = data.pagination || {};

                pagination.path = app.location.path();
                pagination.pageSize = myConf.pageSize(pagination.pageSize, 'user');
                $scope.pagination = pagination;
                app.each(data.data, function (x) {
                    app.checkFollow(x);
                });
                if (!$routeParams.ID) {
                    $scope.parent.title = locale.HOME[params.OP];
                } else {
                    $scope.parent.title = data.user.name + locale.USER[params.OP];
                }
                $scope.userList = data.data;
            });
        }
    ])
    .controller('userOrderCtrl', ['app', '$scope', '$routeParams','getUser',
        function (app, $scope, $routeParams,getUser) {

            var global = app.rootScope.global,
                restAPI = app.restAPI.order,
                myConf = app.myConf,
                orderCache = app.cache.order;

            function getOrderList() {
                var params = {
                    ID: "allOrder",
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'order', 20)
                };
                console.log(12314124);
                app.promiseGet(params, restAPI, app.param(params), app.cache.list).then(function (data) {
                    var pagination = data.pagination || {};

                    pagination.path = app.location.path();
                    pagination.pageSize = myConf.pageSize(pagination.pageSize, 'order');
                    $scope.pagination = pagination;
                    $scope.ordersList = data.data;
                });
            }

            //处理订单状态为等待处理时间超过一天的，自动标识为未付款
            var orderList=[];

            //用户权限，5/4/3/2/1/0对应：管理员/编辑/商家/会员/待验证/禁言
            if(global.user.role <3){
                $scope.ordersList = global.user.ordersList;
                $scope.parent = {
                    title: '已买到的蛋糕订单'
                };

                app.each($scope.ordersList,function(x){
                    if((Date.now() - x.createTime) > 24*60*60*1000 ){
                        orderList.push({_id: x._id,orderStatus: x.orderStatus});
                        orderCache.remove(x._id);
                        x.orderStatus = 2;//未付款
                        orderCache.put(x._id, x);
                    }
                });
                if(orderList && orderList.length > 0){
                    restAPI.save({
                        ID: 'set'
                    }, orderList, function (data) {

                    });
                }

                //订单状态："等待处理"（1）, "未付款"（2）, "已付款，待联系"（3）,"联系不上买家"（4）,"蛋糕制作中"（5）,"订单取消"（6）,"退款中"（7）,"待确认收货"（8）,"交易成功"（9）,"交易成功（含退款）"（10）,"删除（这个不会显示的，用于取数据时候过滤）"（11）

            }else if(global.user.role === 3){
                $scope.ordersList = global.user.ordersList;
                $scope.parent = {
                    title: '已卖出的蛋糕订单'
                };
                app.each($scope.ordersList,function(x){
                    if(Date.now() - parseInt(x.createTime) > 24*60*60*1000 ){
                        orderList.put({_id: x._id,orderStatus: x.orderStatus});
                        orderCache.remove(x._id);
                        x.orderStatus = 2;//未付款
                        orderCache.put(x._id, x);
                    }
                });
                if(orderList && orderList.length > 0){
                    restAPI.save({
                        ID: 'set'
                    }, orderList, function (data) {

                    });
                }

            }else if(global.user.role > 3){
                $scope.parent = {
                    title: '需要处理的蛋糕订单'
                };
                getOrderList();

            }

            $scope.search=function(){
                var key = $scope.searchKey;
                $scope.ordersList=[];
                if(key.indexOf("CC800400") !== -1){
                    key = key.replace("CC800400","");
                    restAPI.get({
                    }, {"_id":key}, function (data) {
                        $scope.ordersList.push(data);
                    });
                }
            };
            $scope.payOrder = function(index){
                global.order = $scope.ordersList[index];
                global.orderIndex = index;
                app.location.path("/orderCake");
            };
            //用户取消订单，直接删除
            $scope.cancelOrder = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{"_id":id,orderStatus:11}], function (data) {
                    app.toast.info("交易取消成功");
                    $scope.ordersList[index].orderStatus = 11;
                });
            };
            //商家取消订单，修改标志，需要退款
            $scope.cancelShopperOrder = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:6}], function (data) {
                    app.toast.info("订单取消成功");
                    $scope.ordersList[index].orderStatus = 6;
                });
            };
            //管理员删除订单
            $scope.delOrder = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{"_id":id,orderStatus:11}], function (data) {
                    app.toast.info("交易取消成功");
                    $scope.ordersList[index].orderStatus = 11;
                });
            };
            $scope.verifyOrder = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:9}], function (data) {
                    app.toast.info("订单确认收货成功");
                    $scope.ordersList[index].orderStatus = 9;
                });
            };
            $scope.commentOrder = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:12}], function (data) {
                    app.toast.info("订单确认收货成功");
                    $scope.ordersList[index].orderStatus = 9;
                });
            };
            $scope.lostContact = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:4}], function (data) {
                    app.toast.info("订单修改成功");
                    $scope.ordersList[index].orderStatus = 4;
                });
            };

            $scope.makeCake = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:5}], function (data) {
                    app.toast.info("蛋糕制作中，完成后可以选择配送");
                    $scope.ordersList[index].orderStatus = 5;
                });
            };
            $scope.sendCake = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:8}], function (data) {
                    app.toast.info("配送蛋糕成功");
                    $scope.ordersList[index].orderStatus = 8;
                });
            };
            $scope.handlePay = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:3}], function (data) {
                    app.toast.info("订单修改成功");
                    $scope.ordersList[index].orderStatus = 3;
                });
            };
            $scope.handleBack = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:7}], function (data) {
                    app.toast.info("开始处理退款，成功后选择退款成功");
                    $scope.ordersList[index].orderStatus = 7;
                });
            };

            $scope.finBack = function(index,id){
                restAPI.save({
                    ID: 'set'
                }, [{_id:id,orderStatus:10}], function (data) {
                    app.toast.info("订单退款成功");
                    $scope.ordersList[index].orderStatus = 10;
                });
            };

        }
    ])
    .controller('userArticleCtrl', ['app', '$scope', '$routeParams',
        function (app, $scope, $routeParams) {
            var restAPI = app.restAPI.user,
                myConf = app.myConf,
                locale = app.locale,
                global = app.rootScope.global;

            function getArticleList() {
                var params = {
                    ID: $routeParams.ID && 'U' + $routeParams.ID || $routeParams.OP,
                    OP: $routeParams.OP || ($routeParams.ID ? 'article' : 'index'),
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'home', 20)
                };
                console.log('11111111getArticleList1111111111');
                app.promiseGet(params, restAPI, app.param(params), app.cache.list).then(function (data) {
                    var newArticles = 0,
                        pagination = data.pagination || {};

                    pagination.path = app.location.path();
                    pagination.pageSize = myConf.pageSize(pagination.pageSize, 'home');
                    $scope.pagination = pagination;
                    if (!$routeParams.ID) {
                        var user = global.user || {};
                        app.each(data.data, function (x) {
                            if (data.readtimestamp > 0) {
                                x.read = x.updateTime < data.readtimestamp;
                                newArticles += !x.read;
                            }
                            x.isAuthor = x.author._id === user._id;
                        });
                        $scope.parent.title = params.OP !== 'index' ? locale.HOME[params.OP] : newArticles + locale.HOME.index + app.filter('date')(data.readtimestamp, 'medium');
                    } else {
                        $scope.parent.title = data.user.name + locale.USER[params.OP];
                    }
                    $scope.articleList = data.data;
                });
            }

            $scope.parent = {
                sumModel: myConf.sumModel(null, 'index', false),
                title: ''
            };
            $scope.pagination = {};
            $scope.removeArticle = null;

            $scope.removeArticleModal = {
                confirmBtn: locale.BTN_TEXT.confirm,
                confirmFn: function () {
                    var article = $scope.removeArticle;
                    app.restAPI.article.remove({
                        ID: article._id
                    }, function () {
                        app.findItem($scope.articleList, function (x, i, list) {
                            if (x._id === article._id) {
                                list.splice(i, 1);
                                app.toast.success(locale.ARTICLE.removed + article.title, locale.RESPONSE.success);
                                return true;
                            }
                        });
                        $scope.removeArticle = null;
                    });
                    return true;
                },
                cancelBtn: locale.BTN_TEXT.cancel,
                cancelFn: function () {
                    $scope.removeArticle = null;
                    return true;
                }
            };
            $scope.setListModel = function () {
                var parent = $scope.parent;
                parent.sumModel = myConf.sumModel(!parent.sumModel, 'home');
                myConf.pageSize(parent.sumModel ? 20 : 10, 'home');
                app.location.search({});
            };
            $scope.remove = function (article) {
                if (article.isAuthor || global.isEditor) {
                    $scope.removeArticle = article;
                    $scope.removeArticleModal.modal(true);
                }
            };

            getArticleList();
        }
    ])
    .controller('userEditCtrl', ['app', '$scope',
        function (app, $scope) {
            var originData = {},
                tagsArray = [],
                locale = app.locale,
                filter = app.filter,
                global = app.rootScope.global,
                lengthFn = filter('length'),
                user = {
                    avatar: '',
                    name: '',
                    nickname: '',
                    sex: '',
                    email: '',
                    phoneNumber:'',
                    desc: '',
                    location:'',
                    passwd: '',
                    tagsList: ['']
                };

            function initUser() {
                originData = app.union(global.user);
                app.each(originData.tagsList, function (x, i, list) {
                    list[i] = x.tag;
                });
                originData = app.intersect(app.union(user), originData);
                $scope.user = app.union(originData);
                app.checkDirty(user, originData, $scope.user);
            }

            $scope.sexArray = ['male', 'female'];

            $scope.checkName = function (scope, model) {
                return filter('checkName')(model.$value);
            };
            $scope.checkMin = function (scope, model) {
                return lengthFn(model.$value) >= 5;
            };
            $scope.checkMax = function (scope, model) {
                return lengthFn(model.$value) <= 40;
            };
            $scope.checkDesc = function (scope, model) {
                return lengthFn(model.$value) <= global.SummaryMaxLen;
            };
            $scope.checkTag = function (scope, model) {
                var list = model.$value || '';
                list = angular.isString(list) ? list.split(/[,，、]/) : list;
                return list.length <= global.UserTagsMax;
            };
            $scope.checkPwd = function (scope, model) {
                var passwd = model.$value || '';
                return passwd === ($scope.user.passwd || '');
            };
            $scope.getTag = function (tag) {
                var tagsList = $scope.user.tagsList;
                if (tagsList.indexOf(tag.tag) < 0 && tagsList.length < global.UserTagsMax) {
                    $scope.user.tagsList = tagsList.concat(tag.tag); // 此处push方法不会更新tagsList视图
                }
            };
            $scope.reset = function () {
                $scope.user = app.union(originData);
            };
            $scope.verifyEmail = function () {
                var verify = app.restAPI.user.save({
                    ID: 'reset'
                }, {
                    request: 'role'
                }, function () {
                    app.toast.success(locale.RESET.email, locale.RESPONSE.success);
                });
            };
            $scope.submit = function () {
                var data = app.union($scope.user);
                if (app.validate($scope)) {

                    data = app.checkDirty(user, originData, data);
                    console.log(data);
                    if (app.isEmpty(data)) {
                        app.toast.info(locale.USER.noUpdate);
                    } else {
                        if (data.passwd && data.passwd.length > 6) {
                            data.passwd = app.CryptoJS.SHA256(data.passwd).toString();
                            data.passwd = app.CryptoJS.HmacSHA256(data.passwd, 'jsGen').toString();
                        }
                        if ( data.email) {
                            if(global.user.email === ""){
                                app.restAPI.user.save({
                                    ID: 'index'
                                }, {
                                    email: data.email
                                }, function () {
                                    app.toast.success(locale.USER.email, locale.RESPONSE.success);
                                });
                            }else{
                                app.restAPI.user.save({
                                    ID: 'reset'
                                }, {
                                    email: data.email,
                                    request: 'email'
                                }, function () {
                                    app.toast.success(locale.USER.email, locale.RESPONSE.success);
                                });
                            }
                            delete data.email;
                        }
                        if (!app.isEmpty(data)) {
                            app.restAPI.user.save({}, data, function (data) {
                                app.union(global.user, data.data);
                                initUser();
                                app.toast.success(locale.USER.updated, locale.RESPONSE.success);
                            });
                        } else {
                            initUser();
                        }
                    }
                }
            };

            $scope.$watchCollection('user', function (value) {
                app.checkDirty(user, originData, value);
            });
            initUser();
        }
    ])
    .controller('articleCtrl', ['app', '$scope', '$routeParams', 'mdEditor', 'getList', 'getMarkdown',
        function (app, $scope, $routeParams, mdEditor, getList, getMarkdown) {
            var ID = 'A' + $routeParams.ID,
                myConf = app.myConf,
                locale = app.locale,
                global = app.rootScope.global,
                filter = app.filter,
                lengthFn = filter('length'),
                cutTextFn = filter('cutText'),
                commentCache = app.cache.comment,
                listCache = app.cache.list,
                restAPI = app.restAPI.article,
                user = global.user || {};//莫名其妙拿不到值
            var UID = $routeParams.UID, //shopperID
                OP = $routeParams.OP;

            global.isIndex = false;
            global.noOverflow = false;

            $scope.isComment = false;

            if(global.isShopper || (OP && OP === "comment")){
                $scope.isComment = true;
                //需要加上这个，要在页面上先有comment 才可以
                setTimeout(function(){
                    mdEditor().run();
                },1000);

            }

            user = {
                _id: user._id,
                name: user.name,
                avatar: user.avatar
            };

            function checkArticleIs(article) {
                var _id = user._id;
                if (!angular.isObject(article)) {
                    return;
                }
                article.isAuthor = _id === article.author._id;
                article.isMark = !!app.findItem(article.markList, function (x) {
                    return x._id === _id;
                });
                article.isFavor = !!app.findItem(article.favorsList, function (x) {
                    return x._id === _id;
                });
                article.isOppose = !!app.findItem(article.opposesList, function (x) {
                    return x._id === _id;
                });
                app.each(article.commentsList, function (x) {
                    checkArticleIs(x);
                });
            }

            function checkLogin() {
                if (!global.isLogin) {
                    app.toast.error(locale.USER.noLogin);
                }
                return global.isLogin;
            }

            function initReply() {
                var comment = $scope.comment,
                    article = $scope.article;
                comment.replyToComment = '';
                comment.title = '评论：' + cutTextFn(article.title, global.TitleMaxLen - 9);
                comment.content = '';
                comment.refer = article._id;
                $scope.replyMoving.prependTo('#comments');
            }

            $scope.parent = {
                wmdPreview: false,
                contentBytes: 0,
                markdownHelp: ''
            };
            $scope.comment = {
                title: '',
                content: '',
                refer: '',
                replyToComment: '',
                shopperId:UID,
                isMark:false,
                isFavor:false,
                isOppose:false

            };
            $scope.replyMoving = {};
            $scope.commentMoving = {};
            $scope.markdownModal = {
                title: locale.ARTICLE.markdown,
                cancelBtn: locale.BTN_TEXT.goBack
            };
            $scope.validateTooltip = app.union(app.rootScope.validateTooltip);
            $scope.validateTooltip.placement = 'bottom';
            $scope.removeCommentModal = {
                confirmBtn: locale.BTN_TEXT.confirm,
                confirmFn: function () {
                    var comment = $scope.removeComment;
                    app.restAPI.article.remove({
                        ID: comment._id
                    }, function () {
                        app.findItem($scope.article.commentsList, function (x, i, list) {
                            if (x._id === comment._id) {
                                list.splice(i, 1);
                                $scope.article.comments = list.length;
                                app.toast.success(locale.ARTICLE.removed + comment.title, locale.RESPONSE.success);
                                return true;
                            }
                        });
                        $scope.removeComment = null;
                    });
                    return true;
                },
                cancelBtn: locale.BTN_TEXT.cancel,
                cancelFn: function () {
                    $scope.removeComment = null;
                    return true;
                }
            };
            $scope.remove = function (comment) {
                if (comment.isAuthor || global.isEditor) {
                    $scope.removeComment = comment;
                    $scope.removeCommentModal.modal(true);
                }
            };

            $scope.wmdHelp = function () {
                getMarkdown.success(function (data) {
                    $scope.parent.markdownHelp = data;
                    $scope.markdownModal.modal(true);
                });
            };
            $scope.wmdPreview = function () {
                $scope.parent.wmdPreview = !$scope.parent.wmdPreview;
                $scope.replyMoving.scrollIntoView(true);
            };
            $scope.checkContentMin = function (scope, model) {
                var length = lengthFn(model.$value);
                $scope.parent.contentBytes = length;
                return length >= global.ContentMinLen;
            };
            $scope.checkContentMax = function (scope, model) {
                return lengthFn(model.$value) <= global.ContentMaxLen;
            };
            $scope.reply = function (article) {
                var comment = $scope.comment;
                comment.refer = article._id;
                $scope.parent.wmdPreview = false;
                if (article._id === $scope.article._id) {
                    initReply();
                } else {
                    comment.replyToComment = article._id;
                    comment.title = locale.ARTICLE.reply + cutTextFn(app.sanitize(app.mdParse(article.content), 0), global.TitleMaxLen - 9);
                    $scope.replyMoving.appendTo('#' + article._id);
                }
                $scope.replyMoving.scrollIntoView();
            };
            $scope.getComments = function (idArray, to) {
                var idList = [],
                    result = {};

                function getResult() {
                    var list = [];
                    app.each(idArray, function (x) {
                        if (result[x]) {
                            list.push(result[x]);
                        }
                    });
                    return list;
                }

                $scope.referComments = [];
                if (to && idArray && idArray.length > 0) {
                    if ($scope.commentMoving.childrenOf('#' + to._id)) {
                        $scope.commentMoving.appendTo('#comments');
                        return;
                    } else {
                        $scope.commentMoving.appendTo('#' + to._id);
                    }
                    app.each(idArray, function (x) {
                        var comment = commentCache.get(x);
                        if (comment) {
                            result[x] = comment;
                        } else {
                            idList.push(x);
                        }
                    });
                    $scope.referComments = getResult();
                    if (idList.length > 0) {
                        restAPI.save({
                            ID: 'comment'
                        }, {
                            data: idList
                        }, function (data) {
                            app.each(data.data, function (x) {
                                checkArticleIs(x);
                                commentCache.put(x._id, x);
                                result[x._id] = x;
                            });
                            $scope.referComments = getResult();
                        });
                    }
                }
            };
            $scope.highlight = function (article) {
                // this is todo
                article.status = article.status === 2 ? 1 : 2;
            };
            $scope.setMark = function (article) {
                if (checkLogin()) {
                    restAPI.save({
                        ID: article._id,
                        OP: 'mark'
                    }, {
                        mark: !article.isMark
                    }, function () {
                        article.isMark = !article.isMark;
                        if (article.isMark) {
                            article.markList.push(user);
                        } else {
                            app.removeItem(article.markList, user._id);
                        }
                        app.toast.success(locale.ARTICLE[article.isMark ? 'marked' : 'unmarked']);
                    });
                }
            };
            $scope.setFavor = function (article) {


                if (checkLogin()) {
                    //用户支持这个蛋糕文章，同时将用户加入到商家的粉丝列表，这个同时作为商家的一个评价参数，用户选择商家的时候，可以在展示( 多少人推荐)而不是简单的分数
                    if(UID){
                        app.rootScope.followMe(UID);
                    }

                    restAPI.save({
                        ID: article._id,
                        OP: 'favor'
                    }, {
                        favor: !article.isFavor
                    }, function () {
                        article.isFavor = !article.isFavor;
                        if (article.isFavor) {
                            article.favorsList.push(user);
                            app.removeItem(article.opposesList, user._id);
                            article.isOppose = false;
                        } else {
                            app.removeItem(article.favorsList, user._id);
                        }
                        app.toast.success(locale.ARTICLE[article.isFavor ? 'favored' : 'unfavored']);
                    });
                }
            };
            $scope.setOppose = function (article) {
                if (checkLogin()) {
                    restAPI.save({
                        ID: article._id,
                        OP: 'oppose'
                    }, {
                        oppose: !article.isOppose
                    }, function () {
                        article.isOppose = !article.isOppose;
                        if (article.isOppose) {
                            article.opposesList.push(user);
                            app.removeItem(article.favorsList, user._id);
                            article.isFavor = false;
                        } else {
                            app.removeItem(article.opposesList, user._id);
                        }
                        app.toast.success(locale.ARTICLE[article.isOppose ? 'opposed' : 'unopposed']);
                    });
                }
            };
            $scope.submit = function () {
                if (checkLogin() && app.validate($scope)) {
                    var data = app.union($scope.comment),
                        article = $scope.article;

                    //对蛋糕的评论
                    restAPI.save({
                        ID: article._id,
                        OP: 'comment'
                    }, data, function (data) {

                        $scope.isComment = false;

                        var comment = data.data,
                            replyToComment = $scope.comment.replyToComment;
                        article.commentsList.unshift(comment);
                        article.comments += 1;
                        article.updateTime = Date.now();
                        if (replyToComment) {
                            app.findItem(article.commentsList, function (x, i, list) {
                                if (replyToComment === x._id) {
                                    x.commentsList.push(comment._id);
                                    return true;
                                }
                            });
                        }
                        commentCache.put(comment._id, comment);
                        initReply();
                    });
                }
            };
            $scope.$on('genPagination', function (event, p, s) {
                event.stopPropagation();
                var params = {
                    ID: ID,
                    OP: 'comment',
                    p: p,
                    s: myConf.pageSize(s, 'comment', 10)
                };
                app.promiseGet(params, restAPI, app.param(params), listCache).then(function (data) {
                    var pagination = data.pagination || {},
                        commentsList = data.data;
                    pagination.pageSize = myConf.pageSize(pagination.pageSize, 'comment');
                    $scope.pagination = pagination;
                    app.each(commentsList, function (x) {
                        checkArticleIs(x);
                        commentCache.put(x._id, x);
                    });
                    $scope.article.commentsList = commentsList;
                    app.anchorScroll.toView('#comments', true);
                });
            });


            app.promiseGet({
                ID: ID
            }, restAPI, ID, app.cache.article).then(function (data) {
                    var pagination = data.pagination || {},
                        article = data.data;
                    pagination.pageSize = myConf.pageSize(pagination.pageSize, 'comments');
                    checkArticleIs(article);
                    app.each(article.commentsList, function (x) {
                        commentCache.put(x._id, x);
                    });
                    global.title2 = article.title;
                    $scope.pagination = pagination;
                    $scope.article = article;
                    initReply();

                    app.promiseGet({
                        ID: article.author._id,
                        OP: 'article'
                    }, app.restAPI.user, article.author._id, listCache).then(function (data) {
                            var user = data.user,
                                author = $scope.article.author;
                            app.checkFollow(user);
                            app.union(author, user);
                            author.articlesList = data.data;
                        });
                });
            getList('hots').then(function (data) {
                $scope.hotArticles = data.data.slice(0, 10);
            });
        }
    ])
    .controller('articleEditorCtrl', ['app', '$scope', '$routeParams', 'mdEditor', 'getMarkdown', 'FileUploader',
        function (app, $scope, $routeParams, mdEditor, getMarkdown, FileUploader) {
            var oldArticle,
                ID = $routeParams.ID && 'A' + $routeParams.ID,
                toStr = app.toStr,
                locale = app.locale,
                global = app.rootScope.global,
                filter = app.filter,
                upyun = app.upyun,
                lengthFn = filter('length'),
                cutTextFn = filter('cutText'),
                restAPI = app.restAPI.article,
                articleCache = app.cache.article,
                article = {
                    title: '',
                    content: '',
                    modelPic: '',
                    price:{
                        six:"0",
                        eight:"0",
                        ten:"0",
                        twelve:"0",
                        fourteen:"0",
                        sixteen:"0"
                    },
                    facePic: '',
                    discount: '',
                    refer: '',
                    tagsList: []
                },
                originData = app.union(article);

            global.noOverflow = false;

            if (!global.isLogin) {
                return app.location.search({}).path('/');
            }

            function initArticle(data) {
                originData = app.union(article);
                if (data) {
                    data = app.union(data);
                    app.each(data.tagsList, function (x, i, list) {
                        list[i] = x.tag;
                    });
                    data.refer = data.refer && data.refer.url;
                    app.intersect(originData, data);
                    $scope.article = app.union(originData);
                    app.checkDirty(article, originData, $scope.article);
                } else {
                    $scope.article = {};
                    app.each(article, function (value, key) {
                        $scope.article[key] = app.store.get('article.' + key) || value;
                    });
                }
                preview(data);
            }

            function preview(value) {
                var parent = $scope.parent,
                    article = $scope.article;
                if (value) {
                    parent.title = locale.ARTICLE.preview + toStr(article.title);
                    parent.content = article.content;
                } else {
                    getMarkdown.success(function (data) {
                        parent.title = locale.ARTICLE.markdown;
                        parent.content = data;
                    });
                }
            }

            global.title2 = app.locale.ARTICLE.title;
            $scope.parent = {
                edit: !!ID,
                wmdPreview: true,
                contentBytes: 0,
                titleBytes: 0,
                title: '',
                content: ''
            };
            var baseUrl = global.cloudDomian || global.url;//绑定的域名，用于访问文件
            $scope.insertPosition = "content";
            $scope.uploaderOptions = {
                scope: $scope,
                allowFileType: upyun.allowFileType,
                url: upyun.url,//用于上传文件,http://127.0.0.1/api/upload/uploadImage
                baseUrl: baseUrl,//用于访问文件,http://127.0.0.1/static/cdn
                access_id: upyun.access_id,
                policy: upyun.policy,
                signature: upyun.signature,
                clickImage: function (file) {
                    if ($scope.insertPosition === "modelPic") {
                        $scope.article.modelPic = file.url;
                    } else if ($scope.insertPosition === "facePic") {
                        $scope.article.facePic = file.url;
                    } else if ($scope.insertPosition === "content") {
                        $scope.article.content += '\n' + '![' + file.name + '](' + file.url + ')\n';
                    }

                }
            };
            var uploaded = $scope.uploaded = [];

            // create a uploader with options
            var options = $scope.uploaderOptions;
            var uploader = $scope.uploader = new FileUploader({
                url: options.url,
                formData: [
                    {
                        OSSAccessKeyId: options.access_id,
                        policy: options.policy,
                        signature: options.signature,
                        key: '${filename}'
                    }
                ]
            });

            uploader.filters.push({
                name: 'imageFilter',
                fn: function (file) {
                    var judge = true,
                        parts = file.name.split('.');
                    parts = parts.length > 1 ? parts.slice(-1)[0] : '';
                    if (!parts || options.allowFileType.indexOf(parts.toLowerCase()) < 0) {
                        judge = false;
                        app.toast.warning(app.locale.UPLOAD.fileType);
                    }
                    return judge;
                }
            });

            //uploader.onCompleteItem = function(fileItem, response, status, headers) {
            //            uploader.onCompleteItem = function (event, xhr, item) {
            uploader.onCompleteItem = function (item, res, status, headers) {

                var response = res || {};
                if (~[200, 201].indexOf(status)) {
                    var file = app.union(item.file, response);
                    file.url = options.baseUrl + "/" + file.fileName;
                    uploaded.push(file);
                    item.remove();
                } else {
                    item.progress = 0;
                    app.toast.warning(response.message, response.code);
                }
            };

            $scope.validateTooltip = app.union(app.rootScope.validateTooltip);
            $scope.validateTooltip.placement = 'bottom';
            $scope.store = function (key) {
                var value = $scope.article[key];
                app.store.set('article.' + key, value);
            };
            $scope.checkTitleMin = function (scope, model) {
                var length = lengthFn(model.$value);
                $scope.parent.titleBytes = length;
                if ($scope.parent.wmdPreview) {
                    $scope.parent.title = locale.ARTICLE.preview + app.sanitize(model.$value, 0);
                }
                return length >= global.TitleMinLen;
            };
            $scope.checkTitleMax = function (scope, model) {
                return lengthFn(model.$value) <= global.TitleMaxLen;
            };
            $scope.checkContentMin = function (scope, model) {
                var length = lengthFn(model.$value);
                $scope.parent.contentBytes = length;
                if ($scope.parent.wmdPreview) {
                    $scope.parent.content = model.$value;
                }
                return length >= global.ContentMinLen;
            };
            $scope.checkContentMax = function (scope, model) {
                return lengthFn(model.$value) <= global.ContentMaxLen;
            };
            $scope.checkTag = function (scope, model) {
                var list = model.$value || '';
                list = angular.isString(list) ? list.split(/[,，、]/) : list;
                return list.length <= global.ArticleTagsMax;
            };
            $scope.getTag = function (tag) {
                var tagsList = $scope.article.tagsList;
                if (tagsList.indexOf(tag.tag) < 0 && tagsList.length < global.ArticleTagsMax) {
                    $scope.article.tagsList = tagsList.concat(tag.tag); // 此处push方法不会更新tagsList视图
                    $scope.store('tagsList');
                }
            };
            $scope.wmdPreview = function () {
                var parent = $scope.parent;
                parent.wmdPreview = !parent.wmdPreview;
                preview(parent.wmdPreview);
            };

            $scope.submit = function () {
                //console.log($scope.article);
                var data = app.union($scope.article);
                if (app.validate($scope)) {
                    if (app.checkDirty(article, originData, data)) {
                        data.title = app.sanitize(data.title, 0);
                        restAPI.save({
                            ID: ID || 'index',
                            OP: ID && 'edit'
                        }, data, function (data) {

                            var article = data.data;

                            if (oldArticle) {
                                delete article.commentsList;
                                article = data.data = app.union(oldArticle.data, article);
                            }

                            articleCache.put(article._id, data);
                            initArticle(article);
                            app.toast.success(locale.ARTICLE[ID ? 'updated' : 'added'] + article.title);
                            var timing = app.timing(null, 1000, 2);
                            timing.then(function () {
                                app.location.search({}).path('/' + article._id);
                            });
                            app.store.clear();
                        });
                    } else {
                        app.toast.info(locale.ARTICLE.noUpdate);
                    }
                }
            };

            if (!app.store.enabled) {
                $scope.$watchCollection('article', function (value) {
                    app.checkDirty(article, originData, value);
                });
            }

            mdEditor().run();
            if (ID) {
                oldArticle = articleCache.get(ID);
                app.promiseGet({
                    ID: ID
                }, restAPI, ID, articleCache).then(function (data) {
                        initArticle(data.data);
                    });
            } else {
                initArticle();
            }
        }
    ])
    .controller('adminCtrl', ['app', '$scope', '$routeParams',
        function (app, $scope, $routeParams) {
            var global = app.rootScope.global,
                path = $routeParams.OP || 'index';

            global.noOverflow = false;
            global.isIndex = false;

            if (!global.isEditor) {
                return app.location.search({}).path('/');
            }

            function tplName(path) {
                path = path === 'comment' ? 'article' : path;
                return 'admin-' + path + '.html';
            }

            $scope.parent = {
                getTpl: tplName(path),
                viewPath: path
            };
            global.title2 = app.locale.ADMIN[path];
        }
    ])
    .controller('adminUserCtrl', ['app', '$scope', '$routeParams',
        function (app, $scope, $routeParams) {
            var originData = {},
                restAPI = app.restAPI.user,
                myConf = app.myConf,
                locale = app.locale,
                params = {
                    ID: 'admin',
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'userAdmin', 20)
                },
                userList = [
                    {
                        _id: '',
                        name: '',
                        locked: false,
                        email: '',
                        role: 0,
                        score: 0,
                        date: 0,
                        lastLoginDate: 0
                    }
                ];

            function initUserList(list) {
                originData = app.intersect(app.union(userList), list);
                $scope.userList = app.union(originData);
                $scope.parent.editSave = !!app.checkDirty(userList, originData, $scope.userList);
            }

            $scope.parent = {
                editSave: false,
                isSelectAll: false
            };
            $scope.pagination = {};
            $scope.roleArray = [0, 1, 2, 3, 4, 5];

            $scope.selectAll = function () {
                app.each($scope.userList, function (x) {
                    x.isSelect = $scope.parent.isSelectAll;
                });
            };
            $scope.reset = function () {
                $scope.userList = app.union(originData);
            };
            $scope.submit = function () {
                var list = [
                    {
                        _id: '',
                        locked: false,
                        role: 0
                    }
                ];
                if (app.validate($scope)) {
                    var data = app.checkDirty(userList, originData, $scope.userList);
                    if (app.isEmpty(data)) {
                        app.toast.info(locale.USER.noUpdate);
                    } else {
                        data = app.intersect(list, data);
                        restAPI.save({
                            ID: 'admin'
                        }, {
                            data: data
                        }, function (data) {
                            var updated = [];
                            app.each(data.data, function (x) {
                                app.findItem($scope.userList, function (y) {
                                    if (x._id === y._id) {
                                        app.union(y, x);
                                        updated.push(x.name);
                                        return true;
                                    }
                                });
                            });
                            initUserList($scope.userList);
                            app.toast.success(locale.USER.updated + updated.join(', '), locale.RESPONSE.success);
                        });
                    }
                }
            };
            $scope.$watch('userList', function (value) {
                $scope.parent.editSave = !!app.checkDirty(userList, originData, value);
            }, true);
            app.promiseGet(params, restAPI).then(function (data) {
                var pagination = data.pagination || {};
                pagination.path = app.location.path();
                pagination.pageSize = myConf.pageSize(pagination.pageSize, 'userAdmin');
                pagination.sizePerPage = [20, 100, 200];
                $scope.pagination = pagination;
                initUserList(data.data);
            });
        }
    ])
    .controller('adminTagCtrl', ['app', '$scope', '$routeParams',
        function (app, $scope, $routeParams) {
            var originData = {},
                restAPI = app.restAPI.tag,
                myConf = app.myConf,
                locale = app.locale,
                params = {
                    ID: 'index',
                    p: $routeParams.p,
                    s: $routeParams.s || myConf.pageSize(null, 'tagAdmin', 20)
                },
                tagList = [
                    {
                        _id: '',
                        articles: 0,
                        tag: '',
                        users: 0
                    }
                ];

            function initTagList(list) {
                originData = app.union(app.union(tagList), list);
                $scope.tagList = app.union(originData);
                $scope.parent.editSave = !!app.checkDirty(tagList, originData, $scope.tagList);
            }

            $scope.parent = {
                editSave: false
            };
            $scope.pagination = {};
            $scope.removeTag = null;

            $scope.removeTagModal = {
                confirmBtn: locale.BTN_TEXT.confirm,
                confirmFn: function () {
                    var tag = $scope.removeTag;
                    restAPI.remove({
                        ID: tag._id
                    }, function () {
                        app.findItem($scope.tagList, function (x, i, list) {
                            if (x._id === tag._id) {
                                list.splice(i, 1);
                                app.toast.success(locale.TAG.removed + tag.tag, locale.RESPONSE.success);
                                return true;
                            }
                        });
                        initTagList($scope.tagList);
                        $scope.removeTag = null;
                    });
                    return true;
                },
                cancelBtn: locale.BTN_TEXT.cancel,
                cancelFn: function () {
                    $scope.removeTag = null;
                    return true;
                }
            };

            $scope.checkTag = function (scope, model) {
                var tag = app.toStr(model.$value);
                return !/[,，、]/.test(tag);
            };
            $scope.checkTagMin = function (scope, model) {
                return app.filter('length')(model.$value) >= 3;
            };
            $scope.reset = function () {
                $scope.tagList = app.union(originData);
            };
            $scope.remove = function (tag) {
                $scope.removeTag = tag;
                $scope.removeTagModal.modal(true);
            };
            $scope.submit = function () {
                var list = [
                    {
                        _id: '',
                        tag: ''
                    }
                ];
                if (app.validate($scope)) {
                    var data = app.checkDirty(tagList, originData, $scope.tagList);
                    if (app.isEmpty(data)) {
                        app.toast.info(locale.TAG.noUpdate);
                    } else {
                        data = app.intersect(list, data);
                        restAPI.save({
                            ID: 'admin'
                        }, {
                            data: data
                        }, function (result) {
                            var updated = [];
                            app.each(data, function (x) {
                                var tag = result.data[x._id];
                                if (!tag) {
                                    app.findItem($scope.tagList, function (y, i, list) {
                                        if (x._id === y._id) {
                                            list.splice(i, 1);
                                            return true;
                                        }
                                    });
                                }
                            });
                            app.each(result.data, function (x) {
                                app.findItem($scope.tagList, function (y, i, list) {
                                    if (x._id === y._id) {
                                        app.union(y, x);
                                        updated.push(x.tag);
                                        return true;
                                    }
                                });
                            });
                            initTagList($scope.tagList);
                            app.toast.success(locale.TAG.updated + updated.join(', '), locale.RESPONSE.success);
                        });
                    }
                }
            };

            $scope.$watch('tagList', function (value) {
                $scope.parent.editSave = !!app.checkDirty(tagList, originData, value);
            }, true);
            app.promiseGet(params, restAPI).then(function (data) {
                var pagination = data.pagination || {};
                pagination.path = app.location.path();
                pagination.pageSize = myConf.pageSize(pagination.pageSize, 'tagAdmin');
                pagination.sizePerPage = [20, 50, 100];
                $scope.pagination = pagination;
                initTagList(data.data);
            });
        }
    ])
    .controller('adminArticleCtrl', ['app', '$scope',
        function (app, $scope) {

        }
    ])
    .controller('adminGlobalCtrl', ['app', '$scope',
        function (app, $scope) {
            var globalTpl,
                originData = {},
                tagsArray = [],
                locale = app.locale,
                filter = app.filter,
                restAPI = app.restAPI.index,
                lengthFn = filter('length');


            function initglobal(data) {
                $scope.global = app.union(data);
                originData = app.union(data);
                originData = app.intersect(app.union(globalTpl), originData);
                $scope.editGlobal = app.union(originData);
                app.checkDirty(globalTpl, originData, $scope.editGlobal);
            }

            $scope.parent = {
                switchTab: 'tab1'
            };
            $scope.reset = function () {
                $scope.editGlobal = app.union(originData);
            };
            $scope.submit = function () {
                var data = app.union($scope.editGlobal);
                if (app.validate($scope)) {
                    data = app.checkDirty(globalTpl, originData, data);
                    if (app.isEmpty(data)) {
                        app.toast.info(locale.ADMIN.noUpdate);
                    } else {
                        restAPI.save({
                            OP: 'admin'
                        }, data, function (data) {
                            initglobal(data.data);
                            var updated = app.union(originData);
                            delete updated.smtp;
                            delete updated.email;
                            app.union(app.rootScope.global, updated);
                            app.toast.success(locale.ADMIN.updated, locale.RESPONSE.success);
                        });
                    }
                }
            };

            $scope.$watchCollection('editGlobal', function (value) {
                app.checkDirty(globalTpl, originData, value);
            });
            app.promiseGet({
                OP: 'admin'
            }, restAPI).then(function (data) {
                    globalTpl = data.configTpl;
                    initglobal(data.data);
                });
        }
    ]);

'use strict';

angular.module('genTemplates', []).run(['$templateCache', function($templateCache) {

  $templateCache.put('admin-article.html', '<div ng-controller="adminArticleCtrl"><div class="panel"><div class="inner page-header"><strong>文章评论批量管理</strong></div><div class="inner well text-right" ng-show="parent.editSave"><button class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></div><div gen-pagination="pagination"></div></div><div gen-modal="unSaveModal">确定要离开？未保存的数据将会丢失！</div>');

  $templateCache.put('admin-global.html', '<div class="panel" ng-controller="adminGlobalCtrl"><div class="inner page-header"><strong>网站设置</strong></div><ul class="nav nav-tabs inner"><li class="active" gen-tab-click="active"><a ng-click="parent.switchTab=\'tab1\'">基本设置</a></li><li gen-tab-click="active"><a ng-click="parent.switchTab=\'tab2\'">参数设置</a></li><li gen-tab-click="active"><a ng-click="parent.switchTab=\'tab3\'">缓存设置</a></li><li gen-tab-click="active"><a ng-click="parent.switchTab=\'tab4\'">SMTP设置</a></li><li gen-tab-click="active"><a ng-click="parent.switchTab=\'tab5\'">云存储设置</a></li></ul><div class="inner well" ng-switch on="parent.switchTab"><div ng-switch-default><form class="pure-form pure-form-aligned" novalidate><div class="pure-control-group"><label>网站域名：</label> <input type="text" class="pure-input-1-2" name="网站域名" ng-model="editGlobal.domain" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>ICP备案：</label> <input type="text" class="pure-input-1-2" name="ICP备案" ng-model="editGlobal.beian"></div><div class="pure-control-group"><label>网站网址[含http://]：</label> <input type="url" class="pure-input-1-2" name="网站网址" ng-model="editGlobal.url" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>网站Logo：</label> <input type="text" class="pure-input-1-2" name="logo" ng-model="editGlobal.logo" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>管理员Email[不公开]：</label> <input type="email" name="管理员Email" ng-model="editGlobal.email" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>网站名称：</label> <input type="text" class="pure-input-1-2" name="网站名称" ng-model="editGlobal.title" ng-maxlength="20" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>网站副标题：</label> <input type="text" class="pure-input-1-2" ng-model="editGlobal.description"></div><div class="pure-control-group"><label>网站Meta标题[SEO]：</label> <textarea class="pure-input-1-2" rows="4" ng-model="editGlobal.metatitle">\n                    </textarea></div><div class="pure-control-group"><label>网站Meta描述[SEO]：</label> <textarea class="pure-input-1-2" rows="4" ng-model="editGlobal.metadesc">\n                    </textarea></div><div class="pure-control-group"><label>网站Meta关键词[SEO]：</label> <textarea class="pure-input-1-2" rows="4" ng-model="editGlobal.keywords">\n                    </textarea></div><div class="pure-control-group"><label>搜索引擎机器人：</label> <textarea class="pure-input-1-2" rows="4" ng-model="editGlobal.robots">\n                    </textarea></div><div class="pure-control-group"><label>用户注册：</label> <input type="button" class="pure-button pure-button-small" ng-class="{\'primary-bg\':editGlobal.register}" ng-click="editGlobal.register=!editGlobal.register" value="{{!editGlobal.register | switch:\'turn\'}}"></div><div class="pure-control-group"><label>邮箱验证：</label> <input type="button" class="pure-button pure-button-small" ng-class="{\'primary-bg\':editGlobal.emailVerification}" ng-click="editGlobal.emailVerification=!editGlobal.emailVerification" value="{{!editGlobal.emailVerification | switch:\'turn\'}}"></div><div class="pure-controls"><button type="submit" class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></form></div><div ng-switch-when="tab2"><form class="pure-form pure-form-aligned" novalidate><div class="pure-control-group"><label>文章最多标签数量：</label> <input type="number" ng-model="editGlobal.ArticleTagsMax"></div><div class="pure-control-group"><label>用户最多标签数量：</label> <input type="number" ng-model="editGlobal.UserTagsMax"></div><div class="pure-control-group"><label>标题最短字节数：</label> <input type="number" ng-model="editGlobal.TitleMinLen"></div><div class="pure-control-group"><label>标题最长字节数：</label> <input type="number" ng-model="editGlobal.TitleMaxLen"></div><div class="pure-control-group"><label>摘要最长字节数：</label> <input type="number" ng-model="editGlobal.SummaryMaxLen"></div><div class="pure-control-group"><label>文章最短字节数：</label> <input type="number" ng-model="editGlobal.ContentMinLen"></div><div class="pure-control-group"><label>文章最长字节数：</label> <input type="number" ng-model="editGlobal.ContentMaxLen"></div><div class="pure-control-group"><label>用户名最短字节数：</label> <input type="number" ng-model="editGlobal.UserNameMinLen"></div><div class="pure-control-group"><label>用户名最长字节数：</label> <input type="number" ng-model="editGlobal.UserNameMaxLen"></div><div class="pure-control-group"><label>用户积分系数：</label> <input type="text" ng-model="editGlobal.UsersScore" ng-list="/[,，、]/"></div><div class="pure-controls-group"><small>评论×<strong>{{editGlobal.UsersScore[0]}}</strong> ，文章×<strong>{{editGlobal.UsersScore[1]}}</strong>，关注×<strong>{{editGlobal.UsersScore[2]}}</strong> ，粉丝×<strong>{{editGlobal.UsersScore[3]}}</strong>，文章热度×<strong>{{editGlobal.UsersScore[4]}}</strong>， 注册时长天数×<strong>{{editGlobal.UsersScore[5]}}</strong></small></div><div class="pure-control-group"><label>评论提升系数：</label> <input type="text" ng-model="editGlobal.ArticleStatus" ng-list="/[,，、]/"></div><div class="pure-controls-group"><small>评论的评论数达到<strong>{{editGlobal.ArticleStatus[0]}}</strong>时，自动提升正常文章， 达到<strong>{{editGlobal.ArticleStatus[1]}}</strong>时，自动提升为推荐文章</small></div><div class="pure-control-group"><label>文章热度系数：</label> <input type="text" ng-model="editGlobal.ArticleHots" ng-list="/[,，、]/"></div><div class="pure-controls-group"><small>访问+<strong>{{editGlobal.ArticleHots[0]}}</strong>，支持/反对±<strong>{{editGlobal.ArticleHots[1]}}</strong>，评论+<strong>{{editGlobal.ArticleHots[2]}}</strong>，收藏+ <strong>{{editGlobal.ArticleHots[3]}}</strong>，推荐+<strong>{{editGlobal.ArticleHots[4]}}</strong></small></div><div class="pure-controls"><button type="submit" class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></form></div><div ng-switch-when="tab3"><form class="pure-form pure-form-aligned" novalidate><div class="pure-control-group"><label>用户缓存容量：</label> <input type="number" ng-model="editGlobal.userCache"></div><div class="pure-control-group"><label>文章缓存容量：</label> <input type="number" ng-model="editGlobal.articleCache"></div><div class="pure-control-group"><label>评论缓存容量：</label> <input type="number" ng-model="editGlobal.commentCache"></div><div class="pure-control-group"><label>列表缓存容量：</label> <input type="number" ng-model="editGlobal.listCache"></div><div class="pure-control-group"><label>标签缓存容量：</label> <input type="number" ng-model="editGlobal.tagCache"></div><div class="pure-control-group"><label>合集缓存容量：</label> <input type="number" ng-model="editGlobal.collectionCache"></div><div class="pure-control-group"><label>消息缓存容量：</label> <input type="number" ng-model="editGlobal.messageCache"></div><div class="pure-control-group"><label>分页导航缓存：</label> <input type="number" ng-model="editGlobal.paginationCache"></div><div class="pure-controls-group"><small>分页导航缓存有效期<strong>{{editGlobal.paginationCache}}</strong>秒</small></div><div class="pure-control-group"><label>操作限时缓存：</label> <input type="number" ng-model="editGlobal.TimeInterval"></div><div class="pure-controls-group"><small>搜索、用户添加文章或评论等限制操作的最小时间间隔，最小值为3秒</small></div><div class="pure-controls"><button type="submit" class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></form></div><div ng-switch-when="tab4"><form class="pure-form pure-form-aligned" novalidate><div class="pure-control-group"><label>服务器地址：</label> <input type="text" ng-model="editGlobal.smtp.host"></div><div class="pure-control-group"><label>服务器端口：</label> <input type="number" ng-model="editGlobal.smtp.port"></div><div class="pure-control-group"><label>SMTP用户名：</label> <input type="text" ng-model="editGlobal.smtp.auth.user"></div><div class="pure-control-group"><label>SMTP用户密码：</label> <input type="password" ng-model="editGlobal.smtp.auth.pass"></div><div class="pure-control-group"><label>发送人名称：</label> <input type="text" ng-model="editGlobal.smtp.senderName"></div><div class="pure-control-group"><label>发送人Email：</label> <input type="text" ng-model="editGlobal.smtp.senderEmail"> <small>部分SMTP服务器要求其与用户名一致</small></div><div class="pure-control-group"><label>是否开启SSL：</label> <input type="button" class="pure-button pure-button-small" ng-class="{\'primary-bg\':editGlobal.smtp.secureConnection}" ng-click="editGlobal.smtp.secureConnection=!editGlobal.smtp.secureConnection" value="{{!editGlobal.smtp.secureConnection | switch:\'turn\'}}"></div><div class="pure-controls"><button type="submit" class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></form></div><div ng-switch-when="tab5"><form class="pure-form pure-form-aligned" novalidate><div class="pure-control-group"><label>文件访问前缀：</label> <input type="text" ng-model="editGlobal.cloudDomian"></div><div class="pure-control-group"><label>文件上传前缀：</label> <input type="text" ng-model="editGlobal.upyun.bucket"></div><div class="pure-control-group"><label>客户端访问ID：</label> <input type="text" ng-model="editGlobal.upyun.access_id"></div><div class="pure-control-group"><label>客户端访问密钥：</label> <input type="password" ng-model="editGlobal.upyun.access_secret"></div><div class="pure-control-group"><label>是否开启图片上传：</label> <input type="button" class="pure-button pure-button-small" ng-class="{\'primary-bg\':editGlobal.upload}" ng-click="editGlobal.upload=!editGlobal.upload" value="{{!editGlobal.upload | switch:\'turn\'}}"></div><div class="pure-controls"><button type="submit" class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></form></div></div></div><div gen-modal="unSaveModal">确定要离开？未保存的数据将会丢失！</div>');

  $templateCache.put('admin-index.html', '<div class="panel" ng-controller="adminGlobalCtrl"><div class="page-header inner"><strong>网站信息</strong></div><ul class="nav nav-tabs inner"><li class="active" gen-tab-click="active"><a ng-click="parent.switchTab=\'tab1\'">站点信息</a></li><li gen-tab-click="active"><a ng-click="parent.switchTab=\'tab2\'">服务器信息</a></li></ul><div class="inner" ng-switch on="parent.switchTab"><div ng-switch-default><dl class="dl-horizontal"><dt>网站名称：</dt><dd>{{global.title | placeholder}}</dd><dt>网站网址：</dt><dd>{{global.url | placeholder}}</dd><dt>网站副标题：</dt><dd>{{global.description | placeholder}}</dd><dt>网站Meta标题：</dt><dd>{{global.metatitle | placeholder}}</dd><dt>网站Meta描述：</dt><dd>{{global.metadesc | placeholder}}</dd><dt>网站Meta关键词：</dt><dd>{{global.keywords | placeholder}}</dd><dt>上线时间：</dt><dd>{{global.date | date:\'yy-MM-dd HH:mm\'}}</dd><dt>访问总数：</dt><dd>{{global.visitors | placeholder}}</dd><dt>会员总数：</dt><dd>{{global.users | placeholder}}</dd><dt>文章总数：</dt><dd>{{global.articles | placeholder}}</dd><dt>评论总数：</dt><dd>{{global.comments | placeholder}}</dd><dt>在线访客：</dt><dd>{{global.onlineNum | placeholder}}</dd><dt>在线会员：</dt><dd>{{global.onlineUsers | placeholder}}</dd><dt>在线记录：</dt><dd>{{global.maxOnlineNum | placeholder}}</dd><dt>记录时间：</dt><dd>{{global.maxOnlineTime | date:\'yy-MM-dd HH:mm\'}}</dd></dl></div><div ng-switch-when="tab2"><dl class="dl-horizontal"><dt>服务器已运行时间：</dt><dd>{{global.sys.uptime | formatTime}}</dd><dt>服务器操作系统：</dt><dd>{{global.sys.platform | placeholder}}</dd><dt>软件信息：</dt><dd><span>软件：<a ng-href="{{global.info.homepage}}"><strong>{{global.info.name}}</strong></a></span><br><span>版本：{{global.info.version}}</span><br><span>作者：<a ng-href="{{global.info.author.url}}">{{global.info.author.name}}</a></span><br><span>邮箱：<a href="mailto:#">{{global.info.author.email}}</a></span></dd><dt>Node.js环境：</dt><dd><span ng-repeat="(key, value) in global.sys.node"><strong>{{key}}：</strong>{{value}}<br></span></dd><dt>CPUs[{{global.sys.cpus.length}}]：</dt><dd ng-repeat="data in global.sys.cpus"><span ng-repeat="(key, value) in data"><strong>{{key}}：</strong>{{value}}<br></span></dd><dt>系统内存：</dt><dd><span ng-repeat="(key, value) in global.sys.memory track by $index"><strong>{{key}}：</strong>{{value | formatBytes}}<br></span></dd><dt>用户缓存：</dt><dd><span>容量：{{global.sys.user.capacity}}</span> <span>当前数量：{{global.sys.user.length}}</span></dd><dt>文章缓存：</dt><dd><span>容量：{{global.sys.article.capacity}}</span> <span>当前数量：{{global.sys.article.length}}</span></dd><dt>评论缓存：</dt><dd><span>容量：{{global.sys.comment.capacity}}</span> <span>当前数量：{{global.sys.comment.length}}</span></dd><dt>列表缓存：</dt><dd><span>容量：{{global.sys.list.capacity}}</span> <span>当前数量：{{global.sys.list.length}}</span></dd><dt>标签缓存：</dt><dd><span>容量：{{global.sys.tag.capacity}}</span> <span>当前数量：{{global.sys.tag.length}}</span></dd><dt>合集缓存：</dt><dd><span>容量：{{global.sys.collection.capacity}}</span> <span>当前数量：{{global.sys.collection.length}}</span></dd><dt>消息缓存：</dt><dd><span>容量：{{global.sys.message.capacity}}</span> <span>当前数量：{{global.sys.message.length}}</span></dd><dt>分页导航缓存：</dt><dd><span>限时(s)：{{global.sys.pagination.timeLimit}}</span> <span>当前数量：{{global.sys.pagination.length}}</span></dd><dt>操作限时缓存：</dt><dd><span>限时(s)：{{global.sys.timeInterval.timeLimit}}</span> <span>当前数量：{{global.sys.timeInterval.length}}</span></dd></dl></div></div></div>');

  $templateCache.put('admin-message.html', '<div><div class="panel"><div class="inner page-header"><strong>消息批量管理</strong></div><div class="inner well text-right" ng-show="parent.editSave"><button class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></div><div gen-pagination="pagination"></div></div><div gen-modal="unSaveModal">确定要离开？未保存的数据将会丢失！</div>');

  $templateCache.put('admin-tag.html', '<div ng-controller="adminTagCtrl"><div class="panel"><div class="inner page-header"><strong>标签管理</strong> <small class="right"><button class="pure-button pure-button-link" ng-click="predicate=\'tag\';reverse=!reverse"><i class="fa fa-sort-alpha-asc"></i>名称</button> <button class="pure-button pure-button-link" ng-click="predicate=\'articles\';reverse=!reverse"><i class="fa fa-sort-amount-asc"></i>文章</button> <button class="pure-button pure-button-link" ng-click="predicate=\'users\';reverse=!reverse"><i class="fa fa-sort-amount-asc"></i>用户</button></small></div><form class="pure-form pure-g-r inner"><div class="pure-u-1-2 edit-tag" ng-repeat="tag in tagList | orderBy:predicate:reverse" id="{{tag._id}}"><a title="删除标签" ng-click="remove(tag)" gen-tooltip><i class="fa fa-trash-o"></i></a> <input class="pure-input-1-2 input-flat" type="text" name="标签" ng-model="tag.tag" ui-validate="{tag:checkTag,minlength:checkTagMin}" gen-tooltip="validateTooltip" required> <small class="muted"><a ng-href="/{{tag._id}}">文章 {{tag.articles}}/会员 {{tag.users}}</a></small></div></form><div class="inner well text-right" ng-show="parent.editSave"><button class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></div><div gen-pagination="pagination"></div><div gen-modal="removeTagModal">确定要删除标签 {{removeTag.tag}}？</div></div><div gen-modal="unSaveModal">确定要离开？未保存的数据将会丢失！</div>');

  $templateCache.put('admin-user.html', '<div ng-controller="adminUserCtrl"><div class="panel"><div class="inner page-header"><strong>用户批量查询/设置</strong></div><div class="inner"><table class="pure-table pure-table-horizontal"><thead><tr><th class="text-left"><input type="checkbox" ng-model="parent.isSelectAll" ng-click="selectAll()"></th><th><i class="fa fa-sort-alpha-asc"></i><a ng-click="predicate=\'name\';reverse=!reverse">用户名</a></th><th><i class="fa fa-sort-alpha-asc"></i><a ng-click="predicate=\'email\';reverse=!reverse">Email</a></th><th><i class="fa fa-sort-alpha-asc"></i><a ng-click="predicate=\'role\';reverse=!reverse">权限</a></th><th><i class="fa fa-sort-amount-asc"></i><a ng-click="predicate=\'score\';reverse=!reverse">积分</a></th><th><i class="fa fa-sort-amount-asc"></i><a ng-click="predicate=\'date\';reverse=!reverse">注册</a></th><th><i class="fa fa-sort-amount-asc"></i><a ng-click="predicate=\'lastLoginDate\';reverse=!reverse">登录</a></th></tr></thead><tbody><tr ng-repeat="user in userList | orderBy:predicate:reverse"><td><input type="checkbox" ng-model="user.isSelect"></td><td><a ng-href="/{{user._id}}">{{user.name}}</a><a ng-show="user.locked" title="该用户已被锁定，点击保存后解锁" ng-click="user.locked=false" gen-tooltip><i class="fa fa-minus-circle"></i></a></td><td>{{user.email}}</td><td><select class ng-model="user.role" ng-options="role | match:\'role\' for role in roleArray"></select></td><td class="text-center">{{user.score}}</td><td class="text-center">{{user.date | date:\'yy-MM-dd\'}}</td><td class="text-center">{{user.lastLoginDate | date:\'yy-MM-dd\'}}</td></tr></tbody></table></div><div class="inner well text-right" ng-show="parent.editSave"><button class="pure-button success-bg" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></div><div gen-pagination="pagination"></div></div><div gen-modal="unSaveModal">确定要离开？未保存的数据将会丢失！</div>');

  $templateCache.put('admin.html', '<div class="pure-g-r wrap margin-top40"><div class="pure-u-2-3"><div ng-include src="parent.getTpl"></div></div><div class="pure-u-1-3 aside"><div class="panel pure-menu pure-menu-open"><ul class="text-center"><li ng-class="{active: parent.viewPath==\'index\'}"><a href="/admin/index"><i class="fa fa-chevron-left left"></i>网站信息</a></li><li ng-class="{active: parent.viewPath==\'user\'}"><a href="/admin/user"><i class="fa fa-chevron-left left"></i>用户管理</a></li><li ng-class="{active: parent.viewPath==\'tag\'}"><a href="/admin/tag"><i class="fa fa-chevron-left left"></i>标签管理</a></li><li ng-class="{active: parent.viewPath==\'article\'}"><a href="/admin/article"><i class="fa fa-chevron-left left"></i>文章管理</a></li><li ng-class="{active: parent.viewPath==\'comment\'}"><a href="/admin/comment"><i class="fa fa-chevron-left left"></i>评论管理</a></li><li ng-class="{active: parent.viewPath==\'message\'}"><a href="/admin/message"><i class="fa fa-chevron-left left"></i>消息管理</a></li><li ng-class="{active: parent.viewPath==\'global\'}" ng-show="global.isAdmin"><a href="/admin/global"><i class="fa fa-chevron-left left"></i>网站设置</a></li></ul></div></div></div>');

  $templateCache.put('article-editor.html', '<div class="pure-g-r margin-top40"><div class="pure-u-1-2 pure-visible-desktop"><div class="panel"><div class="page-header inner"><strong>{{parent.title}}</strong></div><div class="article-content" gen-parse-md="parent.content"></div></div></div><div ng-class="{\'pure-u-1-2 \':global.isDesktop,\'pure-u-1\':!global.isDesktop}"><div class="panel file-drop" ng-file-drop ng-file-over="file-drop-over"><div class="page-header inner"><strong>{{parent.edit | switch:\'edit\'}}蛋糕</strong></div><form class="inner pure-form pure-form-stacked" novalidate><label>蛋糕名称 <span class="info">[必填，{{global.TitleMinLen}} 到 {{global.TitleMaxLen}} 字节，当前<strong class="hot">{{parent.titleBytes}}</strong>字节]</span></label> <input class="pure-input-1" type="text" placeholder="蛋糕名称" name="蛋糕名称" ng-model="article.title" ng-change="store(\'title\')" ui-validate="{maxlength:checkTitleMax,minlength:checkTitleMin}" gen-tooltip="validateTooltip" required> <label>促销活动 <span class="info">[如“满100送10”]</span></label> <input class="pure-input-1" type="text" placeholder="促销活动" name="促销活动" ng-model="article.discount" ng-change="store(\'discount\')" ng-maxlength="15"> <label>蛋糕价格 <span class="info">[填写不同尺寸蛋糕价格，填0表示没有对应尺寸]</span></label><div><ul class="list-inline inner"><li>6寸：<input class="width60 pure-input-1" type="text" ng-model="article.price.six" ng-change="store(\'price\')"></li><li>8寸：<input class="width60 pure-input-1" type="text" ng-model="article.price.eight" ng-change="store(\'price\')"></li><li>10寸：<input class="width60 pure-input-1" type="text" ng-model="article.price.ten" ng-change="store(\'price\')"></li><li>12寸：<input class="width60 pure-input-1" type="text" ng-model="article.price.twelve" ng-change="store(\'price\')"></li><li>14寸：<input class="width60 pure-input-1" type="text" ng-model="article.price.fourteen" ng-change="store(\'price\')"></li><li>16寸：<input class="width60 pure-input-1" type="text" ng-model="article.price.sixteen" ng-change="store(\'price\')"></li></ul></div><label>模型图片 <span class="info">[用于和用户上传的图片合成]</span></label> <input class="pure-input-1" type="text" placeholder="模型图片URL" name="模型图片" ng-model="article.modelPic" ng-click="insertPosition = \'modelPic\'" ng-change="store(\'modelPic\')"> <label>封面展示 <span class="info">[封面展示图片]</span></label> <input class="pure-input-1" type="text" placeholder="封面展示URL" name="封面展示" ng-model="article.facePic" ng-click="insertPosition = \'facePic\'" ng-change="store(\'facePic\')"> <label>蛋糕介绍 <span class="info">[参看<a class="hot" ng-click="wmdPreview()">编辑示例</a>，{{global.ContentMinLen}} 到 {{global.ContentMaxLen}} 字节，当前<strong class="hot">{{parent.contentBytes}}</strong>字节]</span></label><div id="wmd-button-bar"></div><textarea ng-click="insertPosition = \'content\'" class="wmd-input pure-input-1" id="wmd-input" name="文章内容" placeholder="{{global.isLogin?\'请参考编辑示例编辑内容\':\'您还没有登录，不能发表文章哦\'}}" ng-model="article.content" rows="10" ng-change="store(\'content\')" ui-validate="{maxlength:checkContentMax,minlength:checkContentMin}" gen-tooltip="validateTooltip" required>\n                </textarea> <label>蛋糕标签 <span class="info">(最多设置 {{global.ArticleTagsMax}} 个标签){{article.tagsList}}</span></label> <textarea class="pure-input-1" name="文章标签" ng-model="article.tagsList" ng-list="/[,，、]/" ng-change="store(\'tagsList\')" ui-validate="{more:checkTag}" gen-tooltip="validateTooltip">\n                </textarea><mark>热门标签：</mark><a class="pure-button pure-button-link" ng-repeat="tag in global.tagsList" ng-click="getTag(tag)"><small>{{tag.tag}}</small></a><div class="well" gen-uploader="uploaderOptions" ng-if="global.upload"></div><div class="well"><button class="pure-button pure-button-small info-bg" ng-click="wmdPreview()">效果预览</button> <button type="submit" class="pure-button pure-button-small success-bg" ng-class="{\'pure-button-disabled\':!global.isLogin}" ng-click="submit()">提交</button> <button class="pure-button pure-button-small primary-bg" ng-click="goBack()">返回</button></div></form></div></div></div><div gen-modal="unSaveModal">确定要离开？未保存的数据将会丢失！</div>');

  $templateCache.put('article.html', '<div class="pure-g-r wrap margin-top40"><div class="pure-u-2-3"><div class="panel" id="{{article._id}}"><div class="article-header"><h3 class="right red no-margin-top">价格：￥ {{article.price.six}} 起</h3><h3>{{article.title}} <small><a ng-show="global.isEditor" ng-click="highlight(article)" ng-class="{info:article.status<2,warning:article.status==2}"><i class="fa fa-hand-o-up"></i>{{article.status==2 | switch:\'highlight\'}}</a></small></h3><div class="article-info"><a ng-href="{{article.refer.url}}" title="原文"><i class="fa fa-external-link--square success"></i>{{article.refer.url | cutText:25}}</a> <i class="fa fa-clock-o" data-original-title="{{article.date | formatDate:true}}发布" gen-tooltip>{{article.date | formatDate}}</i> <i class="fa fa-refresh" data-original-title="{{article.updateTime | formatDate:true}}更新" gen-tooltip>{{article.updateTime | formatDate}}</i> <i class="fa fa-eye" data-original-title="访问{{article.visitors}}次" gen-tooltip>{{article.visitors}}</i> <i class="fa fa-star-o" data-original-title="热度{{article.hots}}" gen-tooltip><span>{{article.hots}}</span></i> <i class="fa fa-comments-o" data-original-title="评论{{article.comments}}条" ng-show="article.comments" gen-tooltip>{{article.comments}}</i> <a ng-repeat="tag in article.tagsList" ng-href="{{\'/\'+tag._id}}" class="pure-button pure-button-link">{{tag.tag}}</a> <a class="success" ng-show="article.isAuthor||global.isEditor" ng-href="{{\'/\'+article._id+\'/edit\'}}"><i class="fa fa-pencil"></i> 编辑</a> <i class="fa fa-tag red right" title="{{article.discount}}">{{article.discount}}</i></div></div><div class="article-content" gen-parse-md="article.content"></div><div class="pure-g-r article-footer"><div class="pure-u-1-2 pure-hidden-phone"><div class="article-info" ng-show="article.favorsList"><i class="fa fa-thumbs-up">支持</i> <span ng-repeat="user in article.favorsList"><a ng-href="{{\'/\'+user._id}}">{{user.name}}</a></span></div><div class="article-info" ng-show="article.opposesList"><i class="fa fa-thumbs-down">反对</i> <span ng-repeat="user in article.opposesList"><a ng-href="{{\'/\'+user._id}}">{{user.name}}</a></span></div><div class="article-info" ng-show="article.markList"><i class="fa fa-bookmark">收藏</i> <span ng-repeat="user in article.markList"><a ng-href="{{\'/\'+user._id}}">{{user.name}}</a></span></div></div><div class="pure-u-1-2 text-right"><div class="pure-button-group "><button class="pure-button pure-button-small info-bg" title="好评" ng-click="setFavor(article)"><i ng-class="{\'fa fa-thumbs-up\':article.isFavor,\'fa fa-thumbs-o-up\':!article.isFavor}"></i> {{article.favorsList.length}}</button> <button class="pure-button pure-button-small info-bg" title="收藏" ng-click="setMark(article)"><i ng-class="{\'fa fa-bookmark\':article.isMark,\'fa fa-bookmark-o\':!article.isMark}"></i> {{article.markList.length}}</button> <button class="pure-button pure-button-small info-bg" title="差评" ng-click="setOppose(article)"><i ng-class="{\'fa fa-thumbs-down\':article.isOppose,\'fa fa-thumbs-o-down\':!article.isOppose}"></i> {{article.opposesList.length}}</button> <a href="/makeCake" class="pure-button error-bg" ng-click="global.selectCake = article">定做此款蛋糕</a></div></div></div></div><div class="panel" id="comments"><div class="inner" id="replyForm" gen-moving="replyMoving" ng-if="isComment"><h4 class="display-inline">{{comment.title}}</h4><div class="pure-button-group right "><button class="pure-button pure-button-small " ng-class="{\'info-bg\':!comment.isFavor,\'error-bg\':comment.isFavor}" title="好评" ng-click="comment.isFavor = !comment.isFavor"><i ng-class="{\'fa fa-thumbs-up\':comment.isFavor,\'fa fa-thumbs-o-up\':!comment.isFavor}"></i>好评</button> <button class="pure-button pure-button-small" ng-class="{\'info-bg\':!comment.isMark,\'error-bg\':comment.isMark}" title="中评" ng-click="comment.isMark = !comment.isMark"><i ng-class="{\'fa fa-bookmark\':comment.isMark,\'fa fa-bookmark-o\':!comment.isMark}"></i>中评</button> <button class="pure-button pure-button-small " ng-class="{\'info-bg\':!comment.isOppose,\'error-bg\':comment.isOppose}" title="差评" ng-click="comment.isOppose = !comment.isOppose"><i ng-class="{\'fa fa-thumbs-down\':comment.isOppose,\'fa fa-thumbs-o-down\':!comment.isOppose}"></i>差评</button></div><div class="wmd-preview article-content" ng-show="parent.wmdPreview" gen-parse-md="comment.content"></div><form class="pure-form" ng-hide="parent.wmdPreview"><div id="wmd-button-bar"></div><textarea class="wmd-input pure-input-1" id="wmd-input" name="评论内容" placeholder="{{global.isLogin?\'请您认真填写评论\':\'您还没有登录，不能发表评论哦\'}}" ng-model="comment.content" rows="6" ui-validate="{maxlength:checkContentMax,minlength:checkContentMin}" gen-tooltip="validateTooltip" required>\n                    </textarea></form><div class="article-info">[<a ng-click="wmdHelp()">编辑指南</a>，{{global.ContentMinLen}} 到 {{global.ContentMaxLen}} 字节，当前<strong class="hot">{{parent.contentBytes}}</strong>字节]</div><div class="text-right"><div class="pure-button-group"><button class="pure-button pure-button-small info-bg" ng-click="wmdPreview()">编辑 / 预览</button></div><div class="pure-button-group"><button class="pure-button pure-button-small info-bg" ng-if="comment.replyToComment" ng-click="reply(article)">返回</button> <button class="pure-button pure-button-small success-bg" ng-click="submit()">提交</button></div></div></div><ul class="media-list comments"><li class="media" ng-repeat="comment in article.commentsList"><a class="media-object left" ng-href="{{\'/\'+comment.author._id}}" ng-show="!global.isPocket"><img class="img-small" src="{{comment.author.avatar}}"></a><div class="media-body" id="{{comment._id}}"><div class="media-heading"><a ng-click="getComments(comment.refer._id, comment)">{{comment.title}}</a> <a class="right" title="删除评论" ng-show="comment.isAuthor||global.isEditor" ng-click="remove(comment)"><i class="fa fa-trash-o"></i></a></div><div class="media-content list-content" gen-parse-md="comment.content"></div><div class="pure-g-r media-footer"><div class="pure-u-1-2"><a ng-href="{{\'/\'+comment.author._id}}">{{comment.author.name}}</a> <span data-original-title="{{comment.date | formatDate:true}}发布" gen-tooltip>{{comment.date | formatDate}}发表</span></div><div class="pure-u-1-2 text-right"><div class="pure-button-group"><button class="pure-button pure-button-link" title="支持" ng-click="setFavor(comment)"><i ng-class="{\'fa fa-thumbs-up\':comment.isFavor,\'fa fa-thumbs-o-up\':!comment.isFavor}">{{comment.favorsList.length}}</i></button> <button class="pure-button pure-button-link" title="评论" ng-click="getComments(comment.commentsList, comment)"><i class="fa fa-comments-o"></i> {{comment.commentsList.length}}</button> <button class="pure-button pure-button-link" title="反对" ng-click="setOppose(comment)"><i ng-class="{\'fa fa-thumbs-down\':comment.isOppose,\'fa fa-thumbs-o-down\':!comment.isOppose}"></i> {{comment.opposesList.length}}</button></div><div class="pure-button-group" ng-if="global.user.role > 3"><button class="pure-button pure-button-link" ng-click="reply(comment)">回复<i class="fa fa-reply"></i></button></div></div></div></div></li></ul><ul class="media-list comments" id="commentForm" gen-moving="commentMoving"><li class="media" ng-repeat="comment in referComments"><a class="media-object left" ng-href="{{\'/\'+comment.author._id}}" ng-show="!global.isPocket"><img class="img-small" src="http://cdn.angularjs.cn/img/avatar.png" gen-src="{{comment.author.avatar}}"></a><div class="media-body"><div class="media-heading">{{comment.title}}</div><div class="media-content list-content" gen-parse-md="comment.content"></div><div class="pure-g-r media-footer"><div class="pure-u-1-2"><a ng-href="{{\'/\'+comment.author._id}}">{{comment.author.name}}</a> <span data-original-title="{{comment.date | formatDate:true}}发布" gen-tooltip>{{comment.date | formatDate}}发表</span></div><div class="pure-u-1-2 text-right"><div class="pure-button-group"><button class="pure-button pure-button-link" title="支持" ng-click="setFavor(comment)"><i ng-class="{\'fa fa-thumbs-up\':comment.isFavor,\'fa fa-thumbs-o-up\':!comment.isFavor}">{{comment.favorsList.length}}</i></button> <button class="pure-button pure-button-link" title="反对" ng-click="setOppose(comment)"><i ng-class="{\'fa fa-thumbs-down\':comment.isOppose,\'fa fa-thumbs-o-down\':!comment.isOppose}"></i> {{comment.opposesList.length}}</button></div></div></div></div></li></ul></div><div gen-pagination="pagination"></div></div><div class="pure-u-1-3 aside"><div class="panel"><div class="panel-heading">商家信息</div><div class="media inner"><a class="media-object left" ng-href="{{\'/\'+article.author._id}}"><img class="img-small" src="{{article.author.avatar}}"></a><div class="media-body"><div class="media-header"><a class="left font13" ng-href="{{\'/\'+article.author._id}}">{{article.author.nickname}}</a> <i class="fa fa-phone font13 grey">电话：{{article.author.phoneNumber}}</i></div><button class="pure-button success-bg" ng-show="!article.author.isMe" ng-click="followMe(article.author)">{{article.author.isFollow | switch:\'follow\'}}</button></div></div><ul class="inner list-inline article-info"><li><strong class="info">{{article.author.role | match:\'role\'}}</strong></li><li ng-show="article.author.score">积分：<strong>{{article.author.score}}</strong></li><li ng-show="article.author.fans">粉丝：<strong>{{article.author.fans}}</strong></li><li ng-show="article.author.follow">关注：<strong>{{article.author.follow}}</strong></li><li ng-show="article.author.articles">蛋糕/评论：<strong>{{article.author.articles}}</strong></li><li ng-show="article.author.collections">合集：<strong>{{article.author.collections}}</strong></li></ul></div><div class="panel" ng-show="article.author.articlesList.length>0"><div class="panel-heading">创意蛋糕</div><ul class="media-list comments"><li class="no-boxShadow" ng-repeat="item in article.author.articlesList"><span class="label">{{item.date | formatDate}}</span>&nbsp;<a ng-href="{{\'/\'+item._id}}" title="{{item.author.name+\'提供\'}}">{{item.title}}</a></li></ul></div><div class="panel pure-hidden-phone" ng-show="hotArticles.length>0"><div class="panel-heading">热卖蛋糕</div><ul class="media-list comments"><li class="media no-boxShadow" ng-repeat="item in hotArticles"><div class="media-body" id="{{item._id}}"><small class="hot" title="热度">{{item.hots}}</small>&nbsp; <span class="media-content"><a ng-href="{{\'/\'+item._id}}" title="{{item.author.name+\'提供\'}}">{{item.title}}</a></span></div></li></ul></div></div></div><div gen-modal="markdownModal"><div gen-parse-md="parent.markdownHelp"></div></div><div gen-modal="removeCommentModal">确定要删除评论《{{removeComment.title}}》？</div>');

  $templateCache.put('cake.html', '<div class="pure-g-r "><div class="center-bg"><img class="bg-top" src="http://cdn.pictcake.cn/static/img/bac3.jpg" width="100%" style="height:{{height}}px"></div><div class="top-left-brand"><img src="http://cdn.pictcake.cn/static/img/top-brand.png"></div><div class="transaction-item wrap cake" ng-if="!global.isPhone"><img src="http://cdn.pictcake.cn/static/img/left-blue-box.png" class="left-blue-box {{tip1}}"> <a ng-mouseover="tip1 = \'show\'" ng-mouseleave="tip1 = \'hidden\'"><img src="http://cdn.pictcake.cn/static/img/boy1.png" class="boy1"></a> <img src="http://cdn.pictcake.cn/static/img/right-brown-box.png" class="right-brown-box {{tip2}}"> <a ng-mouseover="tip2 = \'show\'" ng-mouseleave="tip2 = \'hidden\'"><img src="http://cdn.pictcake.cn/static/img/boy2.png" class="boy2"></a> <img src="http://cdn.pictcake.cn/static/img/left-red-box.png" class="left-red-box {{tip3}}"> <a ng-mouseover="tip3 = \'show\'" ng-mouseleave="tip3 = \'hidden\'"><img src="http://cdn.pictcake.cn/static/img/boy3.png" class="boy3"></a></div><div class="transaction-item wrap cakePhone" ng-if="global.isPhone"><img src="http://cdn.pictcake.cn/static/img/bottom-table1.png"></div><div class="my-bottom" ng-if="!global.isPhone"><div class="left-bottom pure-u-1-2"></div><div class="right-bottom pure-u-1-2"></div></div><div class="my-bottom-phone" ng-if="global.isPhone"><div class="left-bottom-phone pure-u-1-2"></div><div class="right-bottom-phone pure-u-1-2"></div></div></div><script type="text/javascript">\n    var fireworks = function(){\n        this.size = 20;\n        this.rise();\n    }\n    fireworks.prototype = {\n        color:function(){\n            var c = [\'0\',\'3\',\'6\',\'9\',\'c\',\'f\'];\n            var t = [c[Math.floor(Math.random()*100)%6],\'0\',\'f\'];\n            t.sort(function(){return Math.random()>0.5?-1:1;});\n            return \'#\'+t.join(\'\');\n        },\n        aheight:function(){\n            var h = document.documentElement.clientHeight-250;\n            return Math.abs(Math.floor(Math.random()*h-200))+201;\n        },\n        firecracker:function(){\n            var b = document.createElement(\'div\');\n            var w = document.documentElement.clientWidth;\n            b.style.position = \'absolute\';\n            b.style.color = this.color();\n            b.style.bottom = 0;\n            b.style.left = Math.floor(Math.random()*w)+1+\'px\';\n            document.body.appendChild(b);\n            return b;\n        },\n        rise:function(){\n            var o = this.firecracker();\n            var n = this.aheight();\n            var c = this.color;\n            var e = this.expl;\n            var s = this.size;\n            var k = n;\n            var m = function(){\n                o.style.bottom = parseFloat(o.style.bottom)+k*0.1+\'px\';\n                k-=k*0.1;\n                if(k<2){\n                    clearInterval(clear);\n                    e(o,n,s,c);\n                }\n            }\n            o.innerHTML = \'.\';\n            if(parseInt(o.style.bottom)<n){\n                var clear = setInterval(m,20);\n            }\n        },\n        expl:function(o,n,s,c){\n            var R=n/3,Ri=n/6,Rii=n/9;\n            var r=0,ri=0,rii=0;\n            for(var i=0;i<s;i++){\n                var span = document.createElement(\'span\');\n                var p = document.createElement(\'i\');\n                var a = document.createElement(\'a\');\n                span.style.position = \'absolute\';\n                span.style.fontSize = n/10+\'px\';\n                span.style.left = 0;\n                span.style.top = 0;\n                span.innerHTML = \'*\';\n                p.style.position = \'absolute\';\n                p.style.left = 0;\n                p.style.top = 0;\n                p.innerHTML = \'*\';\n                a.style.position = \'absolute\';\n                a.style.left = 0;\n                a.style.top = 0;\n                a.innerHTML = \'*\';\n                o.appendChild(span);\n                o.appendChild(p);\n                o.appendChild(a);\n            }\n            function spr(){\n                r += R*0.1;\n                ri+= Ri*0.06;\n                rii+= Rii*0.06;\n                sp = o.getElementsByTagName(\'span\');\n                p = o.getElementsByTagName(\'i\');\n                a = o.getElementsByTagName(\'a\');\n                for(var i=0; i<sp.length;i++){\n                    sp[i].style.color = c();\n                    p[i].style.color = c();\n                    a[i].style.color = c();\n                    sp[i].style.left=r*Math.cos(360/s*i)+\'px\';\n                    sp[i].style.top=r*Math.sin(360/s*i)+\'px\';\n                    sp[i].style.fontSize=parseFloat(sp[i].style.fontSize)*0.96+\'px\';\n                    p[i].style.left=ri*Math.cos(360/s*i)+\'px\';\n                    p[i].style.top=ri*Math.sin(360/s*i)+\'px\';\n                    p[i].style.fontSize=parseFloat(sp[i].style.fontSize)*0.96+\'px\';\n                    a[i].style.left=rii*Math.cos(360/s*i)+\'px\';\n                    a[i].style.top=rii*Math.sin(360/s*i)+\'px\';\n                    a[i].style.fontSize=parseFloat(sp[i].style.fontSize)*0.96+\'px\';\n                }\n                R-=R*0.1;\n                if(R<2){\n                    o.innerHTML = \'\';\n                    o.parentNode.removeChild(o);\n                    clearInterval(clearI);\n                }\n            }\n            var clearI = setInterval(spr,20);\n        }\n    }\n\n    window.happyNewYear = function  (){\n        new fireworks();\n    }\n\n\n</script>');

  $templateCache.put('cake1.html', '<div class="pure-g-r "><div class="center-bg"><img class="bg-top" src="http://cdn.pictcake.cn/static/img/header.jpg" width="100%" style="height:{{height}}px"></div><div class="top-left-brand"><img src="http://cdn.pictcake.cn/static/img/top-brand1.png"></div><div class="transaction-item wrap cake1" ng-if="!global.isPhone"></div><div class="transaction-item wrap cake1-phone" ng-if="global.isPhone"></div></div>');

  $templateCache.put('gen-modal.html', '<div class="pure-u modal fade" id="{{id}}" role="dialog"><div class="modal-dialog"><div class="modal-content"><div class="modal-header" ng-show="title"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button><h4 class="modal-title">{{title}}</h4></div><div class="modal-body" ng-transclude></div><div class="modal-footer" ng-show="confirmBtn || cancelBtn || deleteBtn"><button type="button" class="pure-button warning-bg pull-left" ng-show="deleteBtn" ng-click="deleteCb()">{{deleteBtn}}</button> <button type="button" class="pure-button primary-bg" ng-show="confirmBtn" ng-click="confirmCb()">{{confirmBtn}}</button> <button type="button" class="pure-button" ng-show="cancelBtn" ng-click="cancelCb()">{{cancelBtn}}</button></div></div></div></div>');

  $templateCache.put('gen-pagination.html', '<ul class="pagination" ng-show="total>perPages[0]"><li ng-class="{disabled: !prev}"><a ng-href="{{path&&prev?path+prev:\'\'}}" title="上一页" ng-click="paginationTo(prev)">&#171;</a></li><li ng-class="{active: n==pageIndex, disabled: n==\'…\'}" ng-repeat="n in showPages track by $index"><a ng-href="{{path&&n!=\'…\'&&n!=pageIndex?path+n:\'\'}}" title="{{n!=\'…\'?\'第\'+n+\'页\':\'\'}}" ng-click="paginationTo(n)">{{n}}</a></li><li ng-class="{disabled: !next}"><a ng-href="{{path&&next?path+next:\'\'}}" title="下一页" ng-click="paginationTo(next)">&#187;</a></li><li class="pure-hidden-phone" ng-class="{active: s==pageSize}" ng-repeat="s in perPages"><a ng-href="{{path&&s!=pageSize?path+\'1&s=\'+s:\'\'}}" title="每页{{s}}" ng-click="paginationTo(1, s)">{{s}}</a></li></ul>');

  $templateCache.put('gen-uploader.html', '<table class="pure-table pure-table-horizontal file-upload-info" ng-show="uploader.queue.length"><thead><tr><th width="35%">名称</th><th width="15%">大小</th><th width="30%">进度</th><th width="20%">总数：{{ uploader.queue.length }}</th></tr></thead><tbody><tr ng-repeat="item in uploader.queue"><td class="file-upload-filename"><strong>{{ item.file.name }}</strong></td><td nowrap>{{ item.file.size/1024|number:1 }} KB</td><td><div class="progress" style="margin-bottom: 0;"><div class="progress-bar" role="progressbar" ng-style="{ \'width\': item.progress + \'%\' }"></div></div></td><td nowrap><button type="button" class="pure-button pure-button-xsmall success-bg" ng-click="item.upload()" ng-disabled="item.isUploading"><span class="fa fa-upload"></span>上传</button> <button type="button" class="pure-button pure-button-xsmall warning-bg" ng-click="item.remove()"><span class="fa fa-trash-o"></span>删除</button></td></tr></tbody></table><div class="progress" ng-show="uploader.queue.length"><div class="progress-bar" role="progressbar" ng-style="{ \'width\': uploader.progress + \'%\' }"></div></div><div><button type="button" class="pure-button pure-button-small info-bg" ng-click="triggerUpload()"><span class="fa fa-plus-square-o"></span> 上传图片</button><input class="upload-input" type="file" uploader="uploader" nv-file-select multiple> <button type="button" class="pure-button pure-button-small success-bg" ng-click="uploader.uploadAll()" ng-show="uploader.queue.length" ng-disabled="!uploader.getNotUploadedItems().length"><span class="fa fa-upload"></span> 上传所有</button> <button type="button" class="pure-button pure-button-small warning-bg" ng-click="uploader.clearQueue()" ng-show="uploader.queue.length"><span class="fa fa-trash-o"></span> 删除所有</button></div><ul class="nav file-uploaded" ng-show="uploaded.length"><li ng-repeat="file in uploaded"><a class="file-thumbnail" style="background-image: url({{file.url}});" ng-click="clickImage(file)" title="{{file.name}}"></a></li></ul>');

  $templateCache.put('index-article.html', '<ul class="nav nav-tabs inner"><li ng-class="{active: parent.viewPath==\'latest\'}"><a href="/latest" title="新品尝鲜蛋糕">新品尝鲜</a></li><li ng-class="{active: parent.viewPath==\'hots\'}"><a href="/hots" title="热卖推荐蛋糕">热卖推荐</a></li><li ng-class="{active: parent.viewPath==\'update\'}"><a href="/update" title="活动促销蛋糕">活动促销</a></li><li ng-class="{active: !parent.viewPath}" ng-show="other._id"><a ng-href="/{{other._id}}">{{other.title}}</a></li><div class="pure-button-group right"><a href="/add" class="pure-button success-bg" ng-if="global.isLogin">发布蛋糕</a> <a class="pure-button list-model" title="{{parent.sumModel?\'摘要模式\':\'简洁模式\'}}" ng-if="!global.isPocket" ng-class="{\'info-bg\':parent.sumModel}" ng-click="setListModel()"><i class="fa fa-th-large"></i></a></div></ul><ul class="list-inline inner"><li ng-repeat="tag in global.tagsList"><a ng-href="{{\'/\'+tag._id}}" class="pure-button pure-button-xsmall info-bg">{{tag.tag}}</a></li><li><a href="/tag" class="pure-button pure-button-xsmall"><i class="fa fa-search"></i>更多</a></li></ul><ul class="media-list"><li class="media" ng-repeat="article in articleList"><div class="media-body" id="{{article._id}}"><div class="media-header"><a ng-href="{{\'/\'+article._id}}"><i class="primary" ng-class="{\'fa fa-hand-o-up\':article.status==2, \'fa fa-external-link\':article.status!=2}"></i>{{article.title}}</a> <i ng-show="article.status==1" class="fa fa-thumbs-up hot" title="推荐"></i> <i class="fa fa-star-o right hot hover-icon" title="热度" ng-show="!global.isPhone">{{article.hots}}</i></div><div class="media-content list-content" ng-show="parent.sumModel" gen-parse-md="article.content"></div><div class="media-footer"><a ng-href="{{\'/\'+article.author._id}}"><i class="fa fa-pencil success"></i>{{article.author.name}}</a> <i class="fa fa-clock-o" title="{{article.date | formatDate:true}}发布">{{article.date | formatDate}}</i> <i class="fa fa-refresh" title="{{article.updateTime | formatDate:true}}更新">{{article.updateTime | formatDate}}</i> <i class="fa fa-comments-o" title="评论" ng-show="article.comments">{{article.comments}}</i> <a ng-repeat="tag in article.tagsList" ng-href="{{\'/\'+tag._id}}" class="pure-button pure-button-link">{{tag.tag}}</a></div></div></li></ul>');

  $templateCache.put('index-cake.html', '<ul class="nav nav-tabs inner"><li ng-class="{active: parent.viewPath==\'latest\'}"><a href="/latest" title="新品尝鲜蛋糕">新品尝鲜</a></li><li ng-class="{active: parent.viewPath==\'hots\'}"><a href="/hots" title="热卖推荐蛋糕">热卖推荐</a></li><li ng-class="{active: parent.viewPath==\'update\'}"><a href="/update" title="活动促销蛋糕">活动促销</a></li><li ng-class="{active: !parent.viewPath}" ng-show="other._id"><a ng-href="/{{other._id}}">{{other.title}}</a></li><div class="pure-button-group right"><a href="/add" class="pure-button success-bg" ng-if="global.isEditor">发布蛋糕</a> <a class="pure-button list-model" title="{{parent.sumModel?\'摘要模式\':\'简洁模式\'}}" ng-if="!global.isPocket" ng-class="{\'info-bg\':parent.sumModel}" ng-click="setListModel()"><i class="fa fa-th-large"></i></a></div></ul><ul class="media-list indexCake"><li class="media" ng-repeat="article in articleList" ng-class="{floatLeft:parent.sumModel}"><div class="media-body" id="{{article._id}}" ng-class="{itemArticle:parent.sumModel}"><div class="media-content list-content text-center" ng-show="parent.sumModel"><a target="_blank" ng-href="{{\'/\'+article._id}}"><img class="itemPic" src="{{article.facePic}}"></a></div><div class="media-header" ng-mouseover="cover=false"><a target="_blank" ng-href="{{\'/\'+article._id}}"><i class="primary" ng-class="{\'fa fa-hand-o-up\':article.status==2, \'fa fa-external-link\':article.status!=2}"></i>{{article.title}}</a> <i ng-show="article.status==1" class="fa fa-thumbs-up hot" title="推荐"></i> <i class="fa fa-rmb right hot hover-icon margin-right15" title="价格">{{article.price.six}}</i></div><div class="media-content list-content text-center" ng-show="!parent.sumModel"><a target="_blank" ng-href="{{\'/\'+article._id}}"><img class="itemPic" src="{{article.facePic}}"></a></div><div class="media-footer" ng-mouseover="cover=false" ng-class="{myMediaFooter:parent.sumModel}"><a target="_blank" ng-href="{{\'/\'+article.author._id}}"><i class="fa fa-pencil success"></i>{{article.author.nickname}}</a><i class="fa fa-tag red" title="{{article.discount}}">{{article.discount}}</i> <i class="fa fa-comments-o" title="评论" ng-show="article.comments">{{article.comments}}</i> <i class="fa fa-star-o hot" title="热度">{{article.hots}}</i> <a target="_blank" ng-repeat="tag in article.tagsList" ng-show="!parent.sumModel" ng-href="{{\'/\'+tag._id}}" class="pure-button pure-button-link">{{tag.tag}}</a> <a href="/makeCake" class="right pure-button success-bg" ng-show="!parent.sumModel" ng-click="global.selectCake = article">选择此款蛋糕</a></div></div></li></ul>');

  $templateCache.put('index-tag.html', '<div class="inner page-header"><span>热门标签</span></div><ul class="inner list-inline"><li ng-repeat="tag in tagList" id="{{tag._id}}" class="text-center"><a class="pure-button pure-button-small" ng-href="{{\'/\'+tag._id}}"><strong>{{tag.tag}}</strong> <small class="muted">文章 {{tag.articles}}/会员 {{tag.users}}</small></a></li></ul>');

  $templateCache.put('index.html', '<div class="pure-g-r wrap"><div class="pure-u-2-3"><div class="panel" ng-include src="parent.getTpl"></div><div gen-pagination="pagination"></div></div><div class="pure-u-1-3"><div class="panel pure-hidden-phone"><div class="inner text-center"><img src="http://cdn.angularjs.cn/img/angularjs.png" alt="AngularJS"><div class="text-show text-left">使用超动感HTML &amp; JS开发WEB应用！</div><div class="text-show text-hot text-left">QQ交流群1 <strong class="hot">278252889(满)</strong></div><div class="text-show text-hot text-left">QQ交流群2 <strong class="hot">305739270(满)</strong></div><div class="text-show text-hot text-left">QQ交流群3 <strong class="hot">207542263</strong></div><div class="text-show text-hot text-left">QQ交流群4 <strong class="hot">240328422</strong></div><div class="text-show"><a href="https://github.com/angular/angular.js" class="pure-button pure-button-link" target="_blank"><i class="fa fa-github fa-2x"></i>Git Hub</a> <a href="http://weibo.com/angularjs/" class="pure-button pure-button-link" target="_blank"><i class="fa fa-weibo fa-2x"></i>WeiBo</a></div></div></div><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show-large"><strong>{jsGen}</strong></div><div class="text-show text-left">纯JavaScript构建的新一代开源社区网站系统，基于Node.js &amp; AngularJS！</div><div class="text-show"><a href="https://github.com/zensh/jsgen" class="pure-button pure-button-link" target="_blank"><i class="fa fa-github fa-2x"></i>GitHub</a> <a href="http://weibo.com/zensh" class="pure-button pure-button-link" target="_blank"><i class="fa fa-weibo fa-2x"></i>WeiBo</a></div></div></div><div class="panel site-link"><div class="panel-heading muted"><i class="fa fa-link"></i>友情链接</div><ul class="inner"><li><a href="https://coding.net" target="_blank">Coding.net</a></li><li class="muted"><i class="fa fa-thumb-tack"></i>仅链接AngularJS框架网站</li></ul></div><div class="panel"><div class="panel-heading muted"><i class="fa fa-dashboard"></i>网站状态</div><ul class="inner list-inline"><li>访问总数：{{global.visitors}}</li><li>文章总数：{{global.articles}}</li><li>评论总数：{{global.comments}}</li><li>会员总数：{{global.users}}</li><li>在线访客：{{global.onlineNum}}</li><li>在线会员：{{global.onlineUsers}}</li><li>在线记录：{{global.maxOnlineNum}}</li><li>时间：{{global.maxOnlineTime | date:\'yy-MM-dd HH:mm\'}}</li></ul></div></div></div>');

  $templateCache.put('login.html', '<div class="pure-g-r wrap margin-top40"><div class="pure-u-1-2"><div class="panel pure-hidden-phone"><div class="page-header text-center"><span class="hot">欢迎回到创意数码蛋糕坊</span></div><div class="inner text-center"><img src="http://cdn.pictcake.cn/static/img/login.jpg" alt="创意数码蛋糕欢迎您"><div class="text-show">为心爱的他/她制作一份惊喜吧！</div><div class="text-show text-hot"><strong>在线制作</strong>蛋糕 <strong>在线下单</strong></div><div class="text-show"><a class="pure-button pure-button-small zfb"></a> <a class="pure-button pure-button-small wx"></a></div><div class="text-show text-hot">支持 <strong>支付宝</strong> <strong>微信</strong> 在线支付</div></div></div></div><div class="pure-u-1-2"><div class="panel"><div class="page-header inner"><strong class="primary">用户登录</strong></div><form class="pure-form pure-form-aligned inner" novalidate><div class="pure-control-group"><label>登录名：</label> <input type="text" placeholder="name or Email or Uid" name="登录名" ng-model="login.logname" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>密码：</label> <input type="password" placeholder="password" name="密码" ng-model="login.logpwd" ng-minlength="6" ng-maxlength="20" gen-tooltip="validateTooltip" required></div><div class="pure-controls"><label for="auto-login" class="pure-checkbox"><input id="auto-login" type="checkbox" ng-model="login.logauto">3天内自动登录</label> <button class="pure-button primary-bg" ng-click="submit()">登录</button> <a class="pure-button warning-bg" ng-show="reset.title" ng-href="{{\'/reset?type=\'+reset.type}}">{{reset.title}}</a></div></form></div></div></div>');

  $templateCache.put('make-cake.html', '<div class="pure-g-r wrap "><div class="pure-u-3-4 margin-top40 right"><div class="panel height-865 text-center"><p class="border-dash-bottom margin-bottom20 no-margin-top padding-20 grey"><i class="fa fa-paw red margin-right15"></i>您可以上传照片，并通过拖拽、编辑将照片要显示的部分放在蛋糕模型中的黑底空白处，然后点击确定生成效果图</p><form action="/api/upload/uploadImage" method="post"><div class="parent-box"><img id="my-model" class="model-cake" src="{{global.selectCake.modelPic}}"><div id="overlay"></div><input type="file" name="file" id="thebox"></div><script type="text/javascript">\n                var afterLoad =  function(){\n                    $(".model-cake").css({"left": "50%","margin-left": -$(".model-cake").width()/2});\n                    $(".picedit_box").height($(".model-cake").height());\n                    $(".picedit_box").width($(".model-cake").width());\n                    $("#overlay").height($(".model-cake").height());\n                    $("#overlay").width($(".model-cake").width());\n                    $("#overlay").css({"margin-left": -$(".model-cake").width()/2});\n                    $(".parent-box").css({"height":$(".model-cake").width() -20});\n                }\n                $(function() {\n\n                    $(\'#thebox\').picEdit();\n                    $(".model-cake").attr("onload","afterLoad()");\n                });\n            </script><div class="text-center margin-top100 margin-bottom50"><a href="/webPs" target="_blank" class="pure-button success-bg margin-right15">在线PS修图</a> <a href="/hots" class="pure-button success-bg margin-right15">上一步</a> <a id="submit" class="pure-button success-bg " ng-class="{\'pure-button-disabled\':nextDisable}">下一步</a></div></form><a href="/orderCake" class="hidden" id="nextStep"></a></div></div><div class="pure-u-1-4 margin-top40 left"><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show text-center"><img src="http://cdn.pictcake.cn/static/img/banner.png" alt="创意数码蛋糕"></div><div class="text-show text-center border-dash-bottom"><h4 class="shine_red banner-title">心动不如行动</h4></div><div id="sideCatalog" class="sideCatalogBg"><div id="sideCatalog-catalog"><dl><dd class="no-margin-left margin-top30"><a class="make-cake-step active "><i class="fa fa-heart font20 margin-right15"></i>1.选择蛋糕模型</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step shine_red active"><i class="fa fa-heart font20 margin-right15"></i>2.上传图片制作</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step "><i class="fa fa-heart-o font20 margin-right15"></i>3.预览效果下单</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step "><i class="fa fa-heart-o font20 margin-right15"></i>4.电话联系送货</a></dd></dl></div></div></div></div><div class="panel site-link"><div class="panel-heading muted"><i class="fa fa-link"></i>手机客户端</div><ul class="inner text-center"><li><a href="http://www.baidu.com" target="_blank"><img class="width80" src="static/img/iphone.jpg" alt="创意数码蛋糕IPhone"></a> <a href="http://www.baidu.com" target="_blank"><img class="width95" src="static/img/android.jpg" alt="创意数码蛋糕Android"></a></li></ul></div><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show-large"><strong>关注有礼</strong></div><div class="text-show text-left">微信关注，神秘大礼哦</div><div class="text-show text-center"><img src="static/img/getqrcode.jpg" alt="创意数码蛋糕"></div></div></div></div></div>');

  $templateCache.put('order-cake.html', '<script type="text/javascript" src="http://api.map.baidu.com/api?v=2.0"></script><div class="pure-g-r wrap "><div class="pure-u-3-4 margin-top40 right"><div class="panel height-865 text-center"><p class="border-dash-bottom margin-bottom20 no-margin-top padding-20 grey"><i class="fa fa-birthday-cake red margin-right15"></i>在线支付立减3元（注意检查收款人【创意数码蛋糕】），会有短信提醒和商家主动电话联系，请注意保持手机通畅</p><div class="text-center"><img class="margin-bottom20" src="{{showPic}}"></div><div class="text-left"><div class="pay_info "><a class="pure-button pure-button-small " ng-class="{\'error-bg\':selectSize===6,\'info-bg\':selectSize!==6}" ng-click="selectSix()" ng-if="selectSize===6 || (global.selectCake && (global.selectCake.price.six !== 0))">6寸</a> <a class="pure-button pure-button-small " ng-class="{\'error-bg\':selectSize===8,\'info-bg\':selectSize!==8}" ng-click="selectEight()" ng-if="selectSize===8 || (global.selectCake && (global.selectCake.price.eight !== 0))">8寸</a> <a class="pure-button pure-button-small " ng-class="{\'error-bg\':selectSize===10,\'info-bg\':selectSize!==10}" ng-click="selectTen()" ng-if="selectSize===10 || (global.selectCake && (global.selectCake.price.ten !== 0))">10寸</a> <a class="pure-button pure-button-small " ng-class="{\'error-bg\':selectSize===12,\'info-bg\':selectSize!==12}" ng-click="selectTwelve()" ng-if="selectSize===12 || (global.selectCake && (global.selectCake.price.twelve !== 0))">12寸</a> <a class="pure-button pure-button-small " ng-class="{\'error-bg\':selectSize===14,\'info-bg\':selectSize!==14}" ng-click="selectFourteen()" ng-if="selectSize===14 || (global.selectCake && (global.selectCake.price.fourteen !== 0))">14寸</a> <a class="pure-button pure-button-small " ng-class="{\'error-bg\':selectSize===16,\'info-bg\':selectSize!==16}" ng-click="selectSixteen()" ng-if="selectSize===16 || (global.selectCake && (global.selectCake.price.sixteen !== 0))">16寸</a></div><div class="pay_info "><label>订单金额：</label> <i class="fa fa-rmb " title="价格">{{global.order.price || (num+3)}}</i></div><div class="pay_info "><label>支付方式：</label> <a class="pay_button alipay " ng-class="{\'selectAlipay\':selectIcon}" ng-click="selectAlipay()" title="支付宝支付"><i></i></a> <span class="minus_3 pos1"></span> <a class="pay_button weixin " ng-class="{\'selectWeixin\':!selectIcon}" ng-click="selectWeixin()" title="微信支付"><i></i></a> <span class="minus_3 pos2"></span></div><div class="pay_info "><label>附加说明：</label> <textarea cols="25" rows="3" ng-model="addOn"></textarea></div><div class="pay_info "><label>选择商店：</label> <a class="pure-button pure-button-small info-bg" ng-click="selectShop()">选择商店</a></div><div class="pay_info " ng-if="shopper"><i class="fa fa-location-arrow grey font13">{{shopper.nickname}}</i> <i class="fa fa-thumbs-up font13 red margin-right15">{{shopper.fans}}</i><i class="fa fa-phone grey font13">电话：{{shopper.phoneNumber}}</i></div><hr class="border-dash-bottom"><div class="pay_info "><label>手机号码：</label> <input class="phoneNumber" ng-model="phoneNumber"></div><div class="pay_info "><label>配送地址：</label> <textarea cols="25" rows="3" ng-model="location"></textarea></div></div><div class="text-center"><a href="/makeCake" class="pure-button success-bg margin-right15">上一步</a> <a class="pure-button success-bg" ng-click="makeOrder()" ng-class="{\'pure-button-disabled\':nextDisable}">支付订单</a></div><a href="/orderPayAlipay/" target="_blank" class="hidden" id="nextAlipay"><a href="/orderPayWeixin/" target="_blank" class="hidden" id="nextWeixin"></a></a></div></div><div class="pure-u-1-4 margin-top40 left"><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show text-center"><img src="http://cdn.pictcake.cn/static/img/banner.png" alt="创意数码蛋糕"></div><div class="text-show text-center border-dash-bottom"><h4 class="shine_red banner-title">心动不如行动</h4></div><div id="sideCatalog" class="sideCatalogBg"><div id="sideCatalog-catalog"><dl><dd class="no-margin-left margin-top30"><a class="make-cake-step active "><i class="fa fa-heart font20 margin-right15"></i>1.选择蛋糕模型</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>2.上传图片制作</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step shine_red active"><i class="fa fa-heart font20 margin-right15"></i>3.预览效果下单</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step "><i class="fa fa-heart-o font20 margin-right15"></i>4.电话联系送货</a></dd></dl></div></div></div></div><div class="panel site-link"><div class="panel-heading muted"><i class="fa fa-link"></i>手机客户端</div><ul class="inner text-center"><li><a href="http://www.baidu.com" target="_blank"><img class="width80" src="static/img/iphone.jpg" alt="创意数码蛋糕IPhone"></a> <a href="http://www.baidu.com" target="_blank"><img class="width95" src="static/img/android.jpg" alt="创意数码蛋糕Android"></a></li></ul></div><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show-large"><strong>关注有礼</strong></div><div class="text-show text-left">微信关注，神秘大礼哦</div><div class="text-show text-center"><img src="static/img/getqrcode.jpg" alt="创意数码蛋糕"></div></div></div></div></div><div gen-modal="selectShopModal"><div class="media inner" ng-repeat="user in shoppers"><a class="media-object left" ng-href="{{\'/\'+user._id}}"><img class="img-small" src="{{user.avatar}}"></a><div class="left"><a class="font20 margin-right15" target="_blank" ng-href="{{\'/\'+user._id}}">{{user.nickname}}</a> <i class="fa fa-thumbs-up red">{{user.fans}}</i><p class="no-margin-top grey">{{user.desc}}</p></div><button class="pure-button margin-top10  success-bg right" ng-click="selectShopperID(user)">选择该蛋糕店</button></div><div gen-pagination="pagination"></div></div><script type="text/javascript">\n    $(function() {\n        function myFun(result){\n            var cc = result.name;\n            window.city = cc.substring(0,cc.length - 1);\n            console.log("当前定位城市："+window.city);\n        }\n        var myCity = new BMap.LocalCity();\n        myCity.get(myFun);\n    });\n</script>');

  $templateCache.put('order-pay-alipay.html', '<div class="pure-g-r wrap "><div class="pure-u-3-4 margin-top40 right"><div class="panel height-865 text-center"><p class="border-dash-bottom margin-bottom20 no-margin-top padding-20 grey"><i class="fa fa-paw red margin-right15"></i>请您使用支付宝钱包扫描下方二维码支付，支付成功后系统会自动为您安排最优质的店家服务</p><div class="pay_info"><label>请您使用支付宝钱包扫描下方二维码，并备注订单号</label></div><div class="pay_info"><label>支付金额：</label><span>{{num}}（已减3元）</span></div><div class="pay_info"><label>订单号：</label><span>{{oid}}</span></div><div class="pay_info"><img class="margin-bottom20" src="{{global.alipayImg}}"></div></div></div><div class="pure-u-1-4 margin-top40 left"><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show text-center"><img src="http://cdn.pictcake.cn/static/img/banner.png" alt="创意数码蛋糕"></div><div class="text-show text-center border-dash-bottom"><h4 class="shine_red banner-title">心动不如行动</h4></div><div id="sideCatalog" class="sideCatalogBg"><div id="sideCatalog-catalog"><dl><dd class="no-margin-left margin-top30"><a class="make-cake-step active "><i class="fa fa-heart font20 margin-right15"></i>1.选择蛋糕模型</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>2.上传图片制作</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>3.预览效果下单</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>4.电话联系送货</a></dd></dl></div></div></div></div><div class="panel site-link"><div class="panel-heading muted"><i class="fa fa-link"></i>手机客户端</div><ul class="inner text-center"><li><a href="http://www.baidu.com" target="_blank"><img class="width80" src="static/img/iphone.jpg" alt="创意数码蛋糕IPhone"></a> <a href="http://www.baidu.com" target="_blank"><img class="width95" src="static/img/android.jpg" alt="创意数码蛋糕Android"></a></li></ul></div><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show-large"><strong>关注有礼</strong></div><div class="text-show text-left">微信关注，神秘大礼哦</div><div class="text-show text-center"><img src="static/img/getqrcode.jpg" alt="创意数码蛋糕"></div></div></div></div></div>');

  $templateCache.put('order-pay-weixin.html', '<div class="pure-g-r wrap "><div class="pure-u-3-4 margin-top40 right"><div class="panel height-865 text-center"><p class="border-dash-bottom margin-bottom20 no-margin-top padding-20 grey"><i class="fa fa-paw red margin-right15"></i>请您使用微信扫描下方二维码支付，支付成功后系统会自动为您安排最优质的店家服务</p><div class="pay_info"><label>请您使用微信扫描下方二维码，并备注订单号</label></div><div class="pay_info"><label>支付金额：</label><span>{{num}}（已减3元）</span></div><div class="pay_info"><label>订单号：</label><span>{{oid}}</span></div><div class="pay_info"><img class="margin-bottom20" src="{{global.weixinPayImg}}"></div></div></div><div class="pure-u-1-4 margin-top40 left"><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show text-center"><img src="http://cdn.pictcake.cn/static/img/banner.png" alt="创意数码蛋糕"></div><div class="text-show text-center border-dash-bottom"><h4 class="shine_red banner-title">心动不如行动</h4></div><div id="sideCatalog" class="sideCatalogBg"><div id="sideCatalog-catalog"><dl><dd class="no-margin-left margin-top30"><a class="make-cake-step active "><i class="fa fa-heart font20 margin-right15"></i>1.选择蛋糕模型</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>2.上传图片制作</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>3.预览效果下单</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>4.电话联系送货</a></dd></dl></div></div></div></div><div class="panel site-link"><div class="panel-heading muted"><i class="fa fa-link"></i>手机客户端</div><ul class="inner text-center"><li><a href="http://www.baidu.com" target="_blank"><img class="width80" src="static/img/iphone.jpg" alt="创意数码蛋糕IPhone"></a> <a href="http://www.baidu.com" target="_blank"><img class="width95" src="static/img/android.jpg" alt="创意数码蛋糕Android"></a></li></ul></div><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show-large"><strong>关注有礼</strong></div><div class="text-show text-left">微信关注，神秘大礼哦</div><div class="text-show text-center"><img src="static/img/getqrcode.jpg" alt="创意数码蛋糕"></div></div></div></div></div>');

  $templateCache.put('order-result.html', '<div class="pure-g-r wrap "><div class="pure-u-3-4 margin-top40 right"><div class="panel height-865 text-center"><p class="border-dash-bottom margin-bottom20 no-margin-top padding-20 grey"><i class="fa fa-paw red margin-right15"></i>请您稍等片刻，系统正在为您审核处理订单，为您安排最好、最快捷的服务</p><div class="pay_info text-left"><label>订单流水号：</label><span>CC800400{{global.selectCakeOrder._id}}</span></div><div class="pay_info text-left"><label>蛋糕名称：</label><span>{{global.selectCakeOrder.cakeId.title}}</span></div><div class="pay_info"><img width="300" class="margin-bottom20" src="{{global.selectCakeOrder.finalPic}}"></div><div class="pay_info text-left"><label>订单价格：</label> <i class="fa fa-rmb" title="价格">{{global.selectCakeOrder.price}}</i></div><div class="pay_info text-left"><label>订单时间：</label><span>{{global.selectCakeOrder.createTime}}</span></div><div class="pay_info text-left"><label>用户手机号：</label><span>{{global.selectCakeOrder.phoneNumber}}</span></div><div class="pay_info text-left"><label>配送地址：</label><span>{{global.selectCakeOrder.address}}</span></div><div class="pay_info text-left"><label>订单留言：</label><span>{{global.selectCakeOrder.addOn}}</span></div><hr class="border-dash-bottom"><div class="pay_info text-left"><label>蛋糕店名：</label> <span>{{global.selectCakeOrder.shopperId.nickname}}</span></div><div class="pay_info text-left"><label>联系电话：</label><span>{{global.selectCakeOrder.shopperId.phoneNumber}}</span></div><div class="pay_info text-left"><label>订单状态：</label><span>{{global.selectCakeOrder.orderStatus | match:\'orderStatus\'}}</span></div><p class="border-dash-top margin-top30 padding-20 grey"><i class="fa fa-phone red margin-right15"></i>亲，请您保持电话畅通</p></div></div><div class="pure-u-1-4 margin-top40 left"><div class="panel pure-hidden-phone "><div class="inner text-center"><div class="text-show text-center"><img src="http://cdn.pictcake.cn/static/img/banner.png" alt="创意数码蛋糕"></div><div class="text-show text-center border-dash-bottom"><h4 class="shine_red banner-title">心动不如行动</h4></div><div id="sideCatalog" class="sideCatalogBg"><div id="sideCatalog-catalog"><dl><dd class="no-margin-left margin-top30"><a class="make-cake-step active "><i class="fa fa-heart font20 margin-right15"></i>1.选择蛋糕模型</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>2.上传图片制作</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step active"><i class="fa fa-heart font20 margin-right15"></i>3.预览效果下单</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step shine_red active"><i class="fa fa-heart font20 margin-right15"></i>4.电话联系送货</a></dd></dl></div></div></div></div><div class="panel site-link"><div class="panel-heading muted"><i class="fa fa-link"></i>手机客户端</div><ul class="inner text-center"><li><a href="http://www.baidu.com" target="_blank"><img class="width80" src="static/img/iphone.jpg" alt="创意数码蛋糕IPhone"></a> <a href="http://www.baidu.com" target="_blank"><img class="width95" src="static/img/android.jpg" alt="创意数码蛋糕Android"></a></li></ul></div><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show-large"><strong>关注有礼</strong></div><div class="text-show text-left">微信关注，神秘大礼哦</div><div class="text-show text-center"><img src="static/img/getqrcode.jpg" alt="创意数码蛋糕"></div></div></div></div></div>');

  $templateCache.put('register.html', '<div class="pure-g-r wrap margin-top40"><div class="pure-u-1-2"><div class="panel pure-hidden-phone"><div class="page-header text-center"><span class="hot">欢迎回到创意数码蛋糕坊</span></div><div class="inner text-center"><img src="http://cdn.pictcake.cn/static/img/login.jpg" alt="创意数码蛋糕欢迎您"><div class="text-show">为心爱的他/她制作一份浪漫的惊喜吧！</div><div class="text-show text-hot"><strong>在线制作</strong>蛋糕 <strong>在线下单</strong></div><div class="text-show"><a class="pure-button pure-button-small zfb"></a> <a class="pure-button pure-button-small wx"></a></div><div class="text-show text-hot">支持 <strong>支付宝</strong> <strong>微信</strong> 在线支付</div></div></div></div><div class="pure-u-1-2"><div class="panel"><div class="page-header inner"><strong class="success">用户注册</strong></div><form class="pure-form pure-form-aligned inner" novalidate><div class="pure-control-group"><label>用户名：</label> <input type="text" placeholder="name" name="用户名" ng-model="user.name" ui-validate="{username:checkName,minname:checkMin,maxname:checkMax}" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>手机号：</label> <input placeholder="手机号" name="phoneNumber" ng-model="user.phoneNumber" ng-minlength="11" gen-tooltip="validateTooltip" ng-maxlength="14" required></div><div class="pure-control-group"><label>密码：</label> <input type="password" placeholder="password" name="密码" ng-model="user.passwd" ng-minlength="6" ng-maxlength="20" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>重复密码：</label> <input type="password" placeholder="password" name="重复密码" ng-model="user.passwd2" ui-validate="{repasswd:\'$value==user.passwd\'}" ui-validate-watch="\'user.passwd\'" gen-tooltip="validateTooltip" required></div><div class="pure-controls"><button class="pure-button success-bg" ng-click="submit()">注册</button></div></form></div></div></div>');

  $templateCache.put('reset.html', '<div class="pure-g-r wrap margin-top40"><div class="pure-u-1-2"><div class="panel pure-hidden-phone"><div class="page-header text-center"><span class="hot">欢迎回到创意数码蛋糕坊</span></div><div class="inner text-center"><img src="http://cdn.pictcake.cn/static/img/login.jpg" alt="创意数码蛋糕欢迎您"><div class="text-show">为心爱的他/她制作一份浪漫的惊喜吧！</div><div class="text-show text-hot"><strong>在线制作</strong>蛋糕 <strong>在线下单</strong></div><div class="text-show"><a class="pure-button pure-button-small zfb"></a> <a class="pure-button pure-button-small wx"></a></div><div class="text-show text-hot">支持 <strong>支付宝</strong> <strong>微信</strong> 在线支付</div></div></div></div><div class="pure-u-1-2" ng-show="parent.title"><div class="panel transparent"><div class="page-header inner"><strong class="warning">{{parent.title}}</strong></div><form class="pure-form pure-form-aligned inner" novalidate><div class="pure-control-group"><label>用户名/Uid：</label> <input type="text" placeholder="name or Uid" name="用户名/Uid" ng-model="reset.name" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>邮箱：</label> <input type="email" placeholder="email" name="邮箱" ng-model="reset.email" gen-tooltip="validateTooltip" required></div><div class="pure-controls"><button class="pure-button warning-bg" ng-click="submit()">提交</button></div></form></div></div><div gen-modal="timingModal">{{parent.timing}}秒钟后自动返回首页</div></div>');

  $templateCache.put('selectCake.html', '<div class="pure-g-r wrap "><div class="pure-u-3-4 right margin-top40 right"><div class="panel" ng-include src="parent.getTpl"></div><div gen-pagination="pagination"></div></div><div class="pure-u-1-4 margin-top40 left"><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show text-center"><img src="static/img/banner.png" alt="创意数码蛋糕"></div><div class="text-show text-center border-dash-bottom"><h4 ng-class="{\'shine_red active\':!special}" class="pure-u-1-2 banner-title" ng-click="special=false;">创作定制</h4><h4 ng-class="{\'shine_red active\':special}" ng-click="special=true;" class="pure-u-1-2 banner-title">主题</h4></div><div id="sideCatalog" class="sideCatalogBg"><div id="sideCatalog-catalog"><dl ng-if="!special"><dd class="no-margin-left margin-top30"><a class="make-cake-step shine_red active "><i class="fa fa-heart font20 margin-right15"></i>1.选择蛋糕模型</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step "><i class="fa fa-heart-o font20 margin-right15"></i>2.上传图片制作</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step "><i class="fa fa-heart-o font20 margin-right15"></i>3.预览效果下单</a></dd><dd class="no-margin-left margin-top30"><a class="make-cake-step "><i class="fa fa-heart-o font20 margin-right15"></i>4.电话联系送货</a></dd></dl><ul class="list-inline inner" ng-if="special"><li ng-repeat="tag in global.tagsList"><a ng-href="{{\'/\'+tag._id}}" class="pure-button pure-button-xsmall info-bg">{{tag.tag}}</a></li><li><a href="/tag" class="pure-button pure-button-xsmall"><i class="fa fa-search"></i>更多</a></li></ul></div></div></div></div><div class="panel site-link"><div class="panel-heading muted"><i class="fa fa-link"></i>手机客户端</div><ul class="inner text-center"><li><a href="http://www.baidu.com" target="_blank"><img class="width80" src="static/img/iphone.jpg" alt="创意数码蛋糕IPhone"></a> <a href="http://www.baidu.com" target="_blank"><img class="width95" src="static/img/android.jpg" alt="创意数码蛋糕Android"></a></li></ul></div><div class="panel pure-hidden-phone"><div class="inner text-center"><div class="text-show-large"><strong>关注有礼</strong></div><div class="text-show text-left">微信关注，神秘大礼哦</div><div class="text-show text-center"><img src="static/img/getqrcode.jpg" alt="创意数码蛋糕"></div></div></div></div></div>');

  $templateCache.put('user-article.html', '<div ng-controller="userArticleCtrl"><div class="page-header inner"><a class="pure-button list-model right" title="{{parent.sumModel?\'摘要模式\':\'简洁模式\'}}" ng-if="!global.isPocket" ng-class="{\'info-bg\':parent.sumModel}" ng-click="setListModel()"><i class="fa fa-th-large"></i></a> <strong>{{parent.title}}</strong></div><ul class="media-list"><li class="media" ng-repeat="article in articleList"><a class="media-object left" title="删除文章" ng-show="article.isAuthor||global.isEditor" ng-click="remove(article)"><i class="fa fa-trash-o"></i></a><div class="media-body" id="{{article._id}}" ng-class="{muted: article.read}"><div class="media-header"><a ng-href="{{\'/\'+article._id}}"><i class="primary" ng-class="{\'fa fa-hand-o-up\':article.status==2, \'fa fa-external-link\':article.status!=2}" ng-hide="article.isAuthor"></i>{{article.title}}</a> <i ng-show="article.status==1" class="fa fa-thumbs-up hot" title="推荐"></i> <a class="pure-button pure-button-link" ng-href="{{\'/\'+article._id+\'/edit\'}}" ng-show="isMe"><i class="fa fa-edit"></i></a> <i class="fa fa-star-o right hot hover-icon" title="热度" ng-show="!global.isPhone">{{article.hots}}</i></div><div class="media-content list-content" ng-show="parent.sumModel"><a target="_blank" ng-href="{{\'/\'+article._id}}"><img class="itemPic" src="{{article.facePic}}"></a></div><div class="media-footer"><a ng-href="{{\'/\'+article.author._id}}"><i class="fa fa-pencil success"></i>{{article.author.nickname}}</a> <i class="fa fa-clock-o" title="{{article.date | formatDate:true}}发布">{{article.date | formatDate}}</i> <i class="fa fa-refresh" title="{{article.updateTime | formatDate:true}}更新">{{article.updateTime | formatDate}}</i><div class="pure-button-group" ng-show="!parent.sumModel"><i class="fa fa-thumbs-up" title="好评">{{article.favorsList.length}}</i> <i class="fa fa-angellist" title="中评"></i> {{article.markList.length}} <i class="fa fa-thumbs-down" title="差评"></i> {{article.opposesList.length}}</div><i class="fa fa-comments-o" title="评论" ng-show="article.comments">{{article.comments}}</i> <a ng-repeat="tag in article.tagsList" ng-href="{{\'/\'+tag._id}}" class="pure-button pure-button-link">{{tag.tag}}</a></div></div></li></ul><p class="inner" ng-show="articleList.length==0">暂无</p><div gen-pagination="pagination"></div><div gen-modal="removeArticleModal">确定要删除文章《{{removeArticle.title}}》？</div></div>');

  $templateCache.put('user-edit.html', '<div ng-controller="userEditCtrl"><div class="page-header inner"><strong>用户设置</strong></div><form class="pure-form pure-form-aligned inner" novalidate><div class="pure-control-group"><label>&nbsp;</label> <img class="img-small pure-help-inline" src="{{user.avatar}}"></div><div class="pure-control-group"><label>头像URL：</label> <input class="pure-input-1-2" type="text" name="头像" ng-model="user.avatar" gen-tooltip="validateTooltip"></div><div class="pure-control-group"><label>用户名：</label> <input type="text" placeholder="登录名" name="用户名" ng-model="user.name" ui-validate="{username:checkName,minname:checkMin,maxname:checkMax}" gen-tooltip="validateTooltip" required></div><div class="pure-control-group"><label>昵称：</label> <input type="text" placeholder="昵称" name="用户名" ng-model="user.nickname"></div><div class="pure-control-group"><label>手机号：</label> <input type="text" placeholder="手机号" name="手机号" ng-model="user.phoneNumber" ng-minlength="11" gen-tooltip="validateTooltip" ng-maxlength="14" required></div><div class="pure-control-group"><label>邮箱：</label> <input type="email" placeholder="email" name="邮箱" ng-model="user.email" gen-tooltip="validateTooltip" required> <input type="button" class="pure-button pure-button-small success-bg" title="修改邮箱后会自动发送一封验证邮件，通过验证后才保存修改" ng-click="verifyEmail()" value="验证邮箱" gen-tooltip></div><div class="pure-control-group"><label>用户性别：</label><select ng-model="user.sex" ng-options="sex | match:\'gender\' for sex in sexArray"></select></div><div class="pure-control-group"><label>用户标签：</label> <textarea class="pure-input-1-2" name="用户标签" ng-model="user.tagsList" ng-list="/[,，、]/" ui-validate="{more:checkTag}" gen-tooltip="validateTooltip">\n            </textarea></div><div class="pure-controls-group"><a class="pure-button pure-button-link" ng-repeat="tag in global.tagsList" ng-click="getTag(tag)"><small>{{tag.tag}}</small></a></div><div class="pure-control-group"><label>描述：</label> <textarea class="pure-input-1-2" name="配送地址" ng-model="user.desc" ui-validate="{maxlength:checkDesc}" gen-tooltip="validateTooltip">\n            </textarea></div><div class="pure-control-group"><label>配送地址：</label> <textarea class="pure-input-1-2" name="配送地址" ng-model="user.location" ui-validate="{maxlength:checkDesc}" gen-tooltip="validateTooltip">\n            </textarea></div><div class="pure-control-group"><label>修改密码（不改留空）：</label> <input type="password" placeholder="password" name="密码" ng-model="user.passwd" ng-minlength="6" ng-maxlength="20" gen-tooltip="validateTooltip"></div><div class="pure-control-group"><label>再次输入密码：</label> <input type="password" placeholder="password" name="重复密码" ng-model="user.passwd2" ui-validate="{repasswd:checkPwd}" ui-validate-watch="\'user.passwd\'" gen-tooltip="validateTooltip"></div><div class="pure-controls"><button class="pure-button success-bg" type="submit" ng-click="submit()">保存</button> <button class="pure-button info-bg" ng-click="reset()">重置</button></div></form></div><div gen-modal="unSaveModal">确定要离开？未保存的数据将会丢失！</div>');

  $templateCache.put('user-list.html', '<div ng-controller="userListCtrl"><div class="page-header inner"><strong>{{parent.title}}</strong></div><ul class="media-list"><li class="media" ng-repeat="user in userList"><a class="media-object left" ng-href="{{\'/\'+user._id}}"><img class="img-small" src="{{user.avatar}}"></a><div class="media-body" id="{{user._id}}"><div class="media-heading"><div class="media-heading"><a ng-click="followMe(user)" class="pure-button pure-button-small success-bg right" ng-class="{\'success-bg\':!user.isFollow,\'primary-bg\':user.isFollow}" ng-hide="user.isMe">{{user.isFollow | switch:\'follow\'}}</a> <a ng-href="{{\'/\'+user._id}}">{{user.name}}</a> <small class="muted">{{user.date | formatDate:true}}注册 / {{user.lastLoginDate | formatDate:true}}最后登录</small><ul class="inner list-inline article-info"><li><strong class="hot">{{user.role | match:\'role\'}}</strong></li><li ng-show="user.email">UID：<strong>{{user._id}}</strong></li><li ng-show="user.sex">性别：<strong>{{user.sex | match:\'gender\'}}</strong></li><li ng-show="user.score">积分：<strong>{{user.score}}</strong></li><li ng-show="user.fans">粉丝：<strong>{{user.fans}}</strong></li><li ng-show="user.follow">关注：<strong>{{user.follow}}</strong></li><li ng-show="user.articles">文章/评论：<strong>{{user.articles}}</strong></li><li ng-show="user.collections">合集：<strong>{{user.collections}}</strong></li></ul></div></div><div class="media-content" gen-parse-md="user.desc"></div><div><ul class="list-inline"><li ng-repeat="tag in user.tagsList"><a ng-href="{{\'/\'+tag._id}}" class="pure-button pure-button-xsmall">{{tag.tag}}</a></li></ul></div></div></li></ul><p class="inner" ng-show="userList.length==0">暂无</p><div gen-pagination="pagination"></div></div>');

  $templateCache.put('user-order.html', '<div ng-controller="userOrderCtrl"><div class="page-header inner"><strong>{{parent.title}}</strong> <a class="pure-button success-bg right font13" ng-if="global.user.role > 3" ng-click="search()">搜索</a> <input type="text" placeholder="请输入订单号" class="pure-input-rounded right" ng-model="searchKey" ng-if="global.user.role > 3"></div><ul class="media-list"><li class="media" ng-repeat="order in ordersList"><div class="media-body"><div class="media-header"><a target="_blank" ng-href="{{\'/\'+order.cakeId}}"><i class="primary fa fa-home"></i>{{order.cakeName}}</a> <i>订单号：CC800400{{order._id}}</i> <i class="fa fa-rmb right hot hover-icon" title="价格">{{order.price}}</i></div><div class="media-content list-content"><div class="pure-u-1-2 text-center border-dash-right"><div class="pure-u-1-2 text-center"><div><img class="width-height100" src="{{order.uploadPic}}"></div><a title="右键另存为" target="_blank" href="{{order.uploadPic}}" gen-tooltip>下载上传图</a></div><div class="pure-u-1-2 text-center"><div><img class="width-height100" src="{{order.finalPic}}"></div><a target="_blank" href="{{order.finalPic}}" title="右键另存为" gen-tooltip>下载效果图</a></div></div><div class="pure-u-1-2 text-center margin-bottom10"><i class="fa fa-twitch margin-right15" data-original-title="{{order.addOn}}" gen-tooltip>附注留言</i> <i class="fa fa-birthday-cake">订单状态：{{order.orderStatus | match:\'orderStatus\'}}</i><br><i class="margin-top10">尺寸：{{order.size}}&nbsp;寸</i> <i class="fa fa-phone " data-original-title="{{order.phoneNumber}}" gen-tooltip>电话：{{order.phoneNumber}}</i><br><i class="fa fa-location-arrow margin-top10">配送：{{order.address}}</i><br><div class="border-dash-top margin-top10 padding-top10" ng-if="global.user.role<3"><a class="red margin-right15" ng-click="payOrder($index )" ng-if="order.orderStatus < 3"><i class="fa fa-money "></i>我要付款</a><a class="red margin-right15" ng-click="cancelOrder($index,order._id)" ng-if="order.orderStatus < 3"><i class="fa fa-trash"></i>取消交易</a> <a class="red margin-right15" ng-click="verifyOrder($index,order._id)" ng-if="order.orderStatus < 9 && order.orderStatus > 2 && order.orderStatus != 6"><i class="fa fa-check"></i>确认收货</a> <a class="red margin-right15" ng-click="commentOrder($index,order._id)" target="_blank" ng-href="{{\'/\'+order.cakeId+\'/\'+ order.shopperId +\'/comment#comments\'}}" ng-if="order.orderStatus == 9"><i class="fa fa-thumbs-o-up"></i>我要点评</a></div><div class="border-dash-top margin-top10 padding-top10" ng-if="global.user.role==3"><a class="red margin-right15" ng-click="lostContact($index,order._id)" ng-if="order.orderStatus == 3"><i class="fa fa-phone "></i>联系不到买家</a> <a class="red margin-right15" ng-click="makeCake($index,order._id)" ng-if="order.orderStatus == 3 || order.orderStatus == 4"><i class="fa fa-birthday-cake"></i>开始制作蛋糕</a> <a class="red margin-right15" ng-click="sendCake($index,order._id)" ng-if="order.orderStatus == 5"><i class="fa fa-exchange"></i>配送蛋糕</a> <a class="red margin-right15" ng-click="cancelShopperOrder($index,order._id)" ng-if="order.orderStatus < 9 && order.orderStatus > 2"><i class="fa fa-trash"></i>取消订单</a> <a class="red margin-right15" target="_blank" ng-href="{{\'/\'+order.cakeId+\'/\'+ order.shopperId +\'/comment#comments\'}}" ng-if="order.orderStatus == 12"><i class="fa fa-thumbs-o-up"></i>回评买家</a></div><div class="border-dash-top margin-top10 padding-top10" ng-if="global.user.role>3"><a class="red margin-right15" ng-click="handlePay($index,order._id)" ng-if="order.orderStatus < 3"><i class="fa fa-recycle "></i>收到支付</a><a class="red margin-right15" ng-click="handleBack($index,order._id)" ng-if="order.orderStatus === 6"><i class="fa fa-recycle "></i>处理退款</a> <a class="red margin-right15" ng-click="finBack($index,order._id)" ng-if="order.orderStatus === 7"><i class="fa fa-check"></i>退款成功</a> <a ng-if="order.orderStatus < 9" class="red margin-right15" ng-click="delOrder($index,order._id)"><i class="fa fa-trash"></i>取消交易</a> <a class="red margin-right15" target="_blank" ng-href="{{\'/\'+order.cakeId+\'/\'+ order.shopperId +\'/comment#comments\'}}" ng-if="order.orderStatus == 12"><i class="fa fa-thumbs-o-up"></i>回评买家</a></div></div></div><div class="media-footer"><i class="fa fa-clock-o" title="下单时间">下单时间{{order.createTime | date:\'yy-MM-dd HH:mm:ss\'}}</i> <a target="_blank" ng-if="global.user.role != 3 " ng-href="{{\'/\'+order.shopperId._id}}"><i class="fa fa-birthday-cake"></i>查看店家</a> <a target="_blank" ng-if="global.user.role > 2" ng-href="{{\'/\'+order.ownerId}}"><i class="fa fa-meh-o"></i>查看买家</a> <i class="fa right fa-phone margin-right15" data-original-title="{{order.shopperId.phoneNumber}}" gen-tooltip>店家电话：{{order.shopperId.phoneNumber}}</i></div></div></li></ul><p class="inner" ng-if="ordersList.length === 0">暂无蛋糕订单</p><div gen-pagination="pagination"></div></div>');

  $templateCache.put('user.html', '<div class="pure-g-r wrap margin-top40"><div class="pure-u-2-3"><div class="panel" ng-include src="parent.getTpl"></div></div><div class="pure-u-1-3 aside"><div class="panel"><div class="media inner"><a class="media-object left"><img class="img-small" src="{{user.avatar}}"></a><div class="media-body"><div class="media-header"><a ng-href="{{\'/\'+user._id}}">{{user.nickname}}</a> <button ng-show="!parent.isMe" ng-click="followMe(user)" class="pure-button pure-button-small success-bg right">{{user.isFollow | switch:\'follow\'}}</button></div><p class="no-margin-top">{{user.desc}}</p></div></div><ul class="inner list-inline article-info"><li><strong class="hot">{{user.role | match:\'role\'}}</strong></li><li ng-show="user.email">Email：<strong>{{user.email}}</strong></li><li ng-show="user.sex">性别：<strong>{{user.sex | match:\'gender\'}}</strong></li><li ng-show="user.score">积分：<strong>{{user.score}}</strong></li><li ng-show="user.fans">粉丝：<strong>{{user.fans}}</strong></li><li ng-show="user.follow">关注：<strong>{{user.follow}}</strong></li><li ng-show="user.collect">收藏：<strong>{{user.collect}}</strong></li><li ng-show="user.articles">蛋糕/评论：<strong>{{user.articles}}</strong></li><li ng-show="user.collections">合集：<strong>{{user.collections}}</strong></li><br><li ng-show="user.date"><strong>{{user.date | formatDate:true}}</strong>注册<br><strong>{{user.lastLoginDate | formatDate:true}}</strong>最后登录</li></ul><div class="inner article-info"><i class="fa fa-location-arrow ">地址：{{user.location}}</i><br><i class="fa fa-phone ">电话：{{user.phoneNumber}}</i><br><i class="fa fa-tags ">标签</i><div><a ng-repeat="tag in user.tagsList" ng-href="{{\'/\'+tag._id}}" class="pure-button pure-button-link">{{tag.tag}}</a></div></div></div><div class="panel pure-menu pure-menu-open"><ul class="text-center" ng-show="parent.isMe"><li ng-class="{active: parent.viewPath==\'index\'}"><a href="/home"><i class="fa fa-chevron-left left"></i>我的订单</a></li><li ng-class="{active: parent.viewPath==\'follow\'}"><a href="/home/follow"><i class="fa fa-chevron-left left"></i>我的关注</a></li><li ng-class="{active: parent.viewPath==\'fans\'}"><a href="/home/fans"><i class="fa fa-chevron-left left"></i>我的粉丝</a></li><li ng-class="{active: parent.viewPath==\'mark\'}"><a href="/home/mark"><i class="fa fa-chevron-left left"></i>我的收藏</a></li><li ng-if="global.isShopper" ng-class="{active: parent.viewPath==\'article\'}"><a href="/home/article"><i class="fa fa-chevron-left left"></i>我的蛋糕</a></li><li ng-if="global.isShopper" ng-class="{active: parent.viewPath==\'comment\'}"><a href="/home/comment"><i class="fa fa-chevron-left left"></i>评论我的</a></li><li ng-if="!global.isShopper" ng-class="{active: parent.viewPath==\'comment\'}"><a href="/home/comment"><i class="fa fa-chevron-left left"></i>我的评论</a></li><li ng-class="{active: parent.viewPath==\'detail\'}"><a href="/home/detail"><i class="fa fa-chevron-left left"></i>用户设置</a></li></ul><ul class="text-center" ng-hide="parent.isMe"><li ng-class="{active: parent.viewPath==\'article\'}"><a ng-href="/{{user._id}}/article"><i class="fa fa-chevron-left left"></i>{{user.nickname}}的蛋糕</a></li><li ng-class="{active: parent.viewPath==\'fans\'}"><a ng-href="/{{user._id}}/fans"><i class="fa fa-chevron-left left"></i>{{user.nickname}}的粉丝</a></li></ul></div><div class="panel"><div class="panel-heading muted"><i class="fa fa-dashboard"></i>网站状态</div><ul class="inner list-inline"><li>访问总数：{{global.visitors}}</li><li>文章总数：{{global.articles}}</li><li>评论总数：{{global.comments}}</li><li>会员总数：{{global.users}}</li><li>在线访客：{{global.onlineNum}}</li><li>在线会员：{{global.onlineUsers}}</li><li>在线记录：{{global.maxOnlineNum}}</li><li>时间：{{global.maxOnlineTime | date:\'yy-MM-dd HH:mm\'}}</li></ul></div></div></div>');

  $templateCache.put('webPs.html', '<div class="pure-g-r wrap "><div class="pure-u-1 margin-top40"><div class="panel height-865 text-center"><p class="border-dash-bottom margin-bottom20 no-margin-top padding-20 grey"><i class="fa fa-paw red margin-right15"></i>在线PS修图之后，<span class="red">先将图片保存到本地</span>，然后在制作蛋糕页面<span class="red">上传PS保存的图片</span>，也可以直接<span class="red">粘贴复制</span></p><div><embed width="100%" height="800px" src="http://cdn.pictcake.cn/pintu.swf?loc=cn" quality="high" wmode="Window" devicefont="false" id="editor" bgcolor="#606060" name="editor" menu="false" allowfullscreen="true" allowscriptaccess="always" allownetworking="all" allowfullscreeninteractive="true" type="application/x-shockwave-flash"></div></div></div></div>');

}]);