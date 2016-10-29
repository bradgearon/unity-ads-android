import rwc from 'random-weighted-choice';
import _ from 'lodash';
import interpolate from '../interpolate';

function HomeCtrl($location, $cookies, $scope, $interval, $window,
  Analytics, Culture, Word, Config, Level, Books) {
    'ngInject';

    const vm = this;
    $scope.vm = vm;

    var debug = false;

    vm.isWebView = window.webviewbridge;
    vm.prefix = '';
    // vm.id = 'Jn-14-1';
    const lang = 'nb';

    var setupTimer = () => $interval((i) => {
      vm.timer = 5 - i;
      if(i == 5) {
        vm.showClose = true;
      }
    }, 1000, 5, true);

    var setupBridge = () => {

      var loaded = [
          ['com.unity3d.ads.api.Sdk', 'loadComplete', [], 'onLoadComplete']
      ];
      var init = false;

      window.nativebridge = {
          handleCallback: (params) => {
              console.log('handleCallback: ' + JSON.stringify(params));

              _.forEach(params, (paramArray) => {
                  if (paramArray[0] == 'onLoadComplete') {
                      console.log('onLoadComplete invoked: ' + JSON.stringify(paramArray));
                      var config = paramArray[2];
                      $scope.$apply((scope) => {
                          vm.prefix = config[config.length - 1];
                          scope.$root.baseUrl = vm.prefix;
                      });
                  }
              });

              if (!init) {
                  var inited = [
                      ['com.unity3d.ads.api.Sdk', 'initComplete', [], 'onInitComplete']
                  ];
                  window.webviewbridge
                      .handleInvocation(JSON.stringify(inited));
                  var ready = [
                      ['com.unity3d.ads.api.Listener', 'sendReadyEvent', ['defaultVideoAndPictureZone'], 'CALLBACK_01'],
                      ['com.unity3d.ads.api.Placement', 'setDefaultPlacement', ['defaultVideoAndPictureZone'], 'CALLBACK_03'],
                      ['com.unity3d.ads.api.Placement', 'setPlacementState', ['defaultVideoAndPictureZone', 'READY'], 'CALLBACK_02']
                  ];
                  window.webviewbridge
                      .handleInvocation(JSON.stringify(ready));
              }
              init = true;

          },
          handleInvocation: (params) => {
              console.log('handleInvocation', params);
              if (params[0] == 'webview' && params[1] == 'show') {
                  var openAdUnit = [
                      ['com.unity3d.ads.api.AdUnit', 'open', [1, ['webview'], -1], 'CALLBACK_02']
                  ];
                  window.webviewbridge
                      .handleInvocation(JSON.stringify(openAdUnit));
                  console.log('opened adunit');

                  window.webviewbridge
                      .handleCallback(params[2], 'OK', JSON.stringify([]));

                  $scope.$apply((scope) => {
                    scope.close = () => {
                      var closeAdUnit = [
                          ['com.unity3d.ads.api.AdUnit', 'close', [], 'onClosed']
                      ];
                      window.webviewbridge
                        .handleInvocation(JSON.stringify(closeAdUnit));
                      // reset timer
                      vm.showClose = false;
                      delete vm.timer;
                      delete vm.word;
                    };

                    vm.pick();
                    setupTimer();
                  });
              }
          },
          handleEvent: (params) => {
              console.log('handleEvent', params);
          }
      };
      window.webviewbridge
          .handleInvocation(JSON.stringify(loaded));
    }

    var readByWeight = _.reduce(vm.read, (result, value, key) => {
        result[value.weight] = (result[value.weight] || 0) + value.value;
        return result;
    }, {});

    var setRead = (element, value) => {
      vm.read[element.id] = {
          value: value,
          weight: element.rank
      };
      $cookies.putObject('read', vm.read);
      if(window.webviewbridge) {
        var updateRead = [
            ['com.unity3d.ads.api.Read', 'read', [], 'onReadUpdated']
        ];
        window.webviewbridge
          .handleInvocation(JSON.stringify(updateRead));
      }

      if(debug) {
        return;
      }

      Analytics.trackEvent('word', 'read', element.id, value);
    };

    var onRead = (element, value) => {
      setRead(element, value);

      if(!vm.isWebView) {
        return;
      }

      var launchWeb = [
          ['com.unity3d.ads.api.Intent', 'launch', [{
            action: 'android.intent.action.VIEW',
            uri: vm.readUrl
          }], 'onReadUpdated']
      ];
      window.webviewbridge
        .handleInvocation(JSON.stringify(launchWeb));
    };



    $scope.read = element => onRead(element, 1);
    $scope.$on('read', ($evt) => setRead(vm.element, .5));

    var setReadUrl = (version) => {
      var location = vm.id.split('-');
      var book = null;
      var offset = 0;

      // loop through old testament and new testament
      do {
        book = _.find(vm.books[offset++], {abbr: location[0]});
      } while(!book);

      if(_.isArray(version)) {
        version = version[offset - 1];
      }

      var readParams = {
        abbr: location[0],
        chapter: location[1],
        verse: location[2],
        version: version,
        ord: book.ord
      };

      vm.readUrl = interpolate(vm.config.url, readParams);
      return version;
    };

    $scope.$watchGroup(['vm.config.version', 'vm.element'], val => {
        if (!val[0] || !(val[0] && val[1])) return;

        var version = setReadUrl(vm.config.version);

        vm.word = Word.get({
            version: version,
            element: vm.id,
        }, () => {
          if(vm.word.url) {
            vm.readUrl = vm.word.url;
          }

          if(vm.word.version) {
            setReadUrl(vm.word.version);
          }
        });

        vm.image = vm.id;

        if(debug) {
          return;
        }

        Analytics.trackPage('/word/' + vm.lang + '/' + vm.id);
    });

    // todo: move this?
    $scope.$watchCollection('vm.levels', val => {
        if (!val || val.length == 0) return;
        $scope.$watch('vm.read', val => {
          console.log('read updated');
          if(!vm.levels) {
            return;
          }

          var addWeight = 0;
          vm.weightTable = _.reduce(vm.levels, (result, level, idx) => {
              var nextLevelDiff = vm.levels.length > idx + 1 ?
                  level.rank - vm.levels[idx + 1].rank : level.rank / 2;
              _.each(level.elements, id => {
                  var subtractWeight = (vm.read[id] || {
                      value: 0
                  }).value * nextLevelDiff;
                  result.push({
                      rank: level.rank,
                      weight: level.rank + addWeight - subtractWeight,
                      id: id
                  });
              });

              var percentComplete = (readByWeight[level.rank] / level.elements.length);
              addWeight = nextLevelDiff * percentComplete || 0;
              return result;
          }, []);
          if(window.webviewbridge) {
            return;
          }
        }, true);

        vm.pick();
        vm.read = $cookies.getObject('read') || {};
        console.log('read cookie: ' + JSON.stringify(vm.read));
    });

    vm.pick = () => {
      if(!vm.weightTable) {
        return;
      }

      var randomId = rwc(vm.weightTable);
      vm.element = _.find(vm.weightTable, {
          id: randomId
      });

      vm.id = randomId;
      delete vm.word;
    };

    $scope.$watch('vm.prefix', val => {
      vm.culture.$promise.then(() => {
        vm.lang = lang;
        var detectedLang = $window.navigator.language.split('-')[0];
        if(!debug) {
          console.log("setting vm.lang", "to", vm.culture[detectedLang]);
          vm.lang = vm.culture[detectedLang] ? detectedLang : vm.lang;
        }

        var params = {
          lang: vm.lang
        };

        vm.config = Config.get(params, config => {
          if(config.url) {
            return;
          }

          config.url = vm.defaultConfig.url;
        });

        if(window.webviewbridge) {
          return;
        }

        vm.config.$promise.then(vm.pick);
      });
    });

    var loadDefaultConfig = () => {
      vm.culture = Culture.get();
      vm.defaultConfig = Config.get({ lang: 'default' });
      vm.books = Books.query();
      vm.levels = Level.query();
    };

    if(window.webviewbridge) {
      setupBridge();
    } else {
      setupTimer();
    }

    $scope.$root.$watch('baseUrl', (val) => {
      if(!val) {
        return;
      }
      loadDefaultConfig();
    });

    loadDefaultConfig();
}

export default {
    name: 'HomeCtrl',
    fn: HomeCtrl
};
