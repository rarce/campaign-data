var Cookies = require('js-cookie');

module.exports = function() {
  // Object.assign polyfill
  if (typeof Object.assign != 'function') {
    Object.assign = function(target, varArgs) { // .length of function is 2
      'use strict';
      if (target == null) { // TypeError if undefined or null
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource != null) { // Skip over if undefined or null
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }

  var SESSION_TIMEOUT = 30*60; // 30 minutes
  var CAMPAIGN_TIMEOUT = 15768000; // 6 months
  var dirtCookie = false;

  var cookie = Cookies.withConverter({
    read: function (value, name) {
      return decodeURIComponent(value);
    },
    write: function (value, name) {
      return encodeURIComponent(String(value));
    }
  });
  
  var getParameterByName = function (name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results == null ? undefined : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }

  var expireInSeconds = function(seconds){
    var date = new Date();
    date.setTime(date.getTime()+(seconds*1000));
    return(date);
  }

  var getCookieDomain = function(domain){
    return domain.match(/^[\d.]+$|/)[0]||(domain.match('localhost')||[''])[0]||('.'+(domain.match(/[^.]+\.(\w{2,3}\.\w{2}|\w{2,})$/)||[domain])[0])
  }

  var saveCampaignData = function (data) {
    cookie.set(
      'campaign_data',
      Object.assign({}, data, {
        created_at: (new Date()).getTime()
      }),
      {
        expires: expireInSeconds(CAMPAIGN_TIMEOUT),
        path: '/',
        domain: getCookieDomain(location.hostname)
      }
    );
    dirtCookie = true;
  };

  var renewCampaignDataCookie = function(){
    saveCampaignData(cookie.getJSON('campaign_data'));
  }

  var referrer = (document.referrer.indexOf(location.protocol + '//' + location.host) === -1 && document.referrer !== '' && document.referrer !== '0' && document.referrer !== '-' ? document.referrer : undefined);

  // https://developers.google.com/analytics/devguides/collection/gajs/gaTrackingTraffic?hl=en#searchEngine
  var searchEngineData = 'daum:q eniro:search_word naver:query pchome:q images.google:q google:q yahoo:p yahoo:q msn:q bing:q aol:query aol:q lycos:q lycos:query ask:q altavista:q search.netscape:query cnn:query about:terms alltheweb:q voila:rdata virgilio:qs baidu:wd baidu:word alice:qs yandex:text najdi:q mamma:query seznam:q search:q wp:szukaj online.onetcenter:qt szukacz:q yam:k pchome:q kvasir:q sesam:q ozu:q terra:query mynet:q ekolay:q rambler:words'.split(' ');

  var getHostName = function(url) {
    // scheme : // [username [: password] @] hostame [: port] [/ [path] [? query] [# fragment]]
    var e = new RegExp('^(?:(?:https?|ftp):)/*(?:[^@]+@)?(www.)?([^:/#]+)');
    var matches = e.exec(url);

    return matches ? matches[2] : url;
  }

  var isSearchEngine = function(){
    for(var i=0;i < searchEngineData.length;i++) {
      if (getHostName(referrer).indexOf(searchEngineData[i].split(':')[0])!==-1) {
        return searchEngineData[i].split(':')[0];
      }
    }
    return false;
  }

  var SocialData = ['facebook','twitter','t.co','blogspot'];

  var isSocial = function(){
    for(var i=0;i < SocialData.length;i++) {
      if (getHostName(referrer).indexOf(SocialData[i])!==-1) {
        return true;
      }
    }
    return false;
  }

  var getKeyword = function(){
    var value;
    for (var i = 0; i < searchEngineData.length; i++) {
      if (getHostName(referrer).indexOf(searchEngineData[i].split(':')[0]) !== -1) {
        value = getParameterByName(searchEngineData[i].split(':')[1]);
        if (value) return value;
      }
    }
    return '(not provided)'
  }

  var getPath = function(url) {
    // scheme : // [username [: password] @] hostame [: port] [/ [path] [? query] [# fragment]]
    var e = new RegExp('^(?:(?:https?|ftp):)/*(?:[^@]+@)?([^:/#]+):?([0-9]+)?(.*)');
    var matches = e.exec(url);

    return matches ? matches[3] : url;
  }

  var sessionNotExpired = function(){
    var now = new Date();
    var createdAt = new Date();

    createdAt.setTime(cookie.getJSON('campaign_data').created_at);
    return createdAt.getTime() + SESSION_TIMEOUT * 1000 > now.getTime();
  }

  var anotherSession = function(){
    return !(cookie.get('campaign_data') && sessionNotExpired());
  }

  var haveUtmCampaignCookie = function(){
    return !!(cookie.get('__utmz'));
  }

  var haveCampaignCookie = function(){
    return !!(cookie.get('campaign_data'));
  }

  var getParamFromUtmCampaignCookie = function(param){
    var e = new RegExp(param + '=(.*?)($|\\|)');
    var matches = e.exec(cookie.get('__utmz'));
    return matches ? matches[1] : null;
  }

  var getDataFromUtm = function(){
    if (getParamFromUtmCampaignCookie('utmgclid')) {
      return {
        location: document.location.href,
        referrer: referrer,
        campaign_source: 'google',
        campaign_medium: 'cpc',
        gclid: getParamFromUtmCampaignCookie('utmgclid')
      }
    } else {
      return {
        location: document.location.href,
        referrer: referrer,
        campaign_source: getParamFromUtmCampaignCookie('utmcsr'),
        campaign_medium: getParamFromUtmCampaignCookie('utmcmd') || '(not set)',
        campaign_name: getParamFromUtmCampaignCookie('utmccn') || '(not set)',
        campaign_content: getParamFromUtmCampaignCookie('utmcct') || '(not set)',
        campaign_term: getParamFromUtmCampaignCookie('utmctr') || '(not set)'
      }
    }
  }

  var processedDocumentData = function(){
    // Follow: https://developers.google.com/analytics/devguides/platform/campaign-flow?hl=es
    if (getParameterByName('gclid')) {
      return {
        location: document.location.href,
        referrer: referrer,
        campaign_source: 'google',
        campaign_medium: 'cpc',
        gclid: getParameterByName('gclid')
      }
    } else if (getParameterByName('utm_source')) {
      return {
        location: document.location.href,
        referrer: referrer,
        campaign_source: getParameterByName('utm_source'),
        campaign_medium: getParameterByName('utm_medium') || '(not set)',
        campaign_name: getParameterByName('utm_campaign') || '(not set)',
        campaign_content: getParameterByName('utm_content') || '(not set)',
        campaign_term: getParameterByName('utm_term') || '(not set)'
      }
    } else if (referrer && isSearchEngine() && anotherSession()) {
      return {
        location: document.location.href,
        referrer: referrer,
        campaign_source: isSearchEngine(),
        campaign_medium: 'organic',
        campaign_name: '(not set)',
        campaign_content: '(not set)',
        campaign_term: getKeyword()
      }
    } else if (referrer && isSocial() && anotherSession()) {
      return {
        location: document.location.href,
        referrer: referrer,
        campaign_source: getHostName(referrer),
        campaign_medium: 'social',
        campaign_name: '(not set)',
        campaign_content: '(not set)',
        campaign_term: '(not set)'
      }
    } else if (referrer && anotherSession()) {
      return {
        location: document.location.href,
        referrer: referrer,
        campaign_source: getHostName(referrer),
        campaign_medium: 'referral',
        campaign_name: '(referral)',
        campaign_content: getPath(referrer),
        campaign_term: '(not set)'
      }
    }
    // old visitor
    else if (haveUtmCampaignCookie() && !haveCampaignCookie()) {
      return getDataFromUtm();
    }
    else {
      return null;
    }
  }

  var documentLocationData = processedDocumentData();

  // save on cookie campaign data
  var captureCampaignData = function () {
    if (documentLocationData) {
      saveCampaignData(documentLocationData);
    } else if (!cookie.get('campaign_data')) {
      saveCampaignData({
        location: document.location.href,
        campaign_source: '(direct)',
        campaign_medium: '(none)',
        campaign_name: '(direct)',
        campaign_content: '(not set)',
        campaign_term: '(not set)'
      });
    }
  }

  captureCampaignData();
  if (!dirtCookie) renewCampaignDataCookie();
}
