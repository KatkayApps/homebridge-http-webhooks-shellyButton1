const Constants = require('../../Constants');
const Util = require('../../Util');

function HttpWebHookLightBulbAccessory(ServiceParam, CharacteristicParam, platform, lightConfig) {
  Service = ServiceParam;
  Characteristic = CharacteristicParam;

  this.platform = platform;
  this.log = platform.log;
  this.storage = platform.storage;

  this.id = lightConfig["id"];
  this.type = "lightbulb";
  this.name = lightConfig["name"];
  this.onURL = lightConfig["on_url"] || "";
  this.onMethod = lightConfig["on_method"] || "GET";
  this.onBody = lightConfig["on_body"] || "";
  this.onForm = lightConfig["on_form"] || "";
  this.onHeaders = lightConfig["on_headers"] || "{}";
  this.offURL = lightConfig["off_url"] || "";
  this.offMethod = lightConfig["off_method"] || "GET";
  this.offBody = lightConfig["off_body"] || "";
  this.offForm = lightConfig["off_form"] || "";
  this.offHeaders = lightConfig["off_headers"] || "{}";
  this.brightnessURL = lightConfig["brightness_url"] || "";
  this.brightnessMethod = lightConfig["brightness_method"] || "GET";
  this.brightnessBody = lightConfig["brightness_body"] || "";
  this.brightnessForm = lightConfig["brightness_form"] || "";
  this.brightnessHeaders = lightConfig["brightness_headers"] || "{}";
  this.brightnessFactor = lightConfig["brightness_factor"] || 1;

  this.informationService = new Service.AccessoryInformation();
  this.informationService.setCharacteristic(Characteristic.Manufacturer, "HttpWebHooksPlatform");
  this.informationService.setCharacteristic(Characteristic.Model, "HttpWebHookLightAccessory-" + this.name);
  this.informationService.setCharacteristic(Characteristic.SerialNumber, "HttpWebHookLightAccessory-" + this.id);

  this.service = new Service.Lightbulb(this.name);
  this.changeHandler = (function(newState, newBrightness) {
    var brightnessToSet = Math.ceil(newBrightness / this.brightnessFactor);
    this.log("Change HomeKit state for light to '%s'.", newState);
    this.log("Change HomeKit brightness for light to '%s'.", brightnessToSet);
    this.service.getCharacteristic(Characteristic.On).updateValue(newState, undefined, Constants.CONTEXT_FROM_WEBHOOK);
    this.service.getCharacteristic(Characteristic.Brightness).updateValue(brightnessToSet, undefined, Constants.CONTEXT_FROM_WEBHOOK);
  }).bind(this);
  this.service.getCharacteristic(Characteristic.On).on('get', this.getState.bind(this)).on('set', this.setState.bind(this));
  this.service.getCharacteristic(Characteristic.Brightness).on('get', this.getBrightness.bind(this)).on('set', this.setBrightness.bind(this));
}

HttpWebHookLightBulbAccessory.prototype.getState = function(callback) {
  this.log("Getting current state for '%s'...", this.id);
  var state = this.storage.getItemSync("http-webhook-" + this.id);
  if (state === undefined) {
    state = false;
  }
  callback(null, state);
};

HttpWebHookLightBulbAccessory.prototype.setState = function(powerOn, callback, context) {
  this.log("Light state for '%s'...", this.id);
  this.storage.setItemSync("http-webhook-" + this.id, powerOn);
  var urlToCall = this.onURL;
  var urlMethod = this.onMethod;
  var urlBody = this.onBody;
  var urlForm = this.onForm;
  var urlHeaders = this.onHeaders;
  if (!powerOn) {
    urlToCall = this.offURL;
    urlMethod = this.offMethod;
    urlBody = this.offBody;
    urlForm = this.offForm;
    urlHeaders = this.offHeaders;
  }
  Util.callHttpApi(urlToCall, urlMethod, urlBody, urlForm, urlHeaders, callback, context);
};

HttpWebHookLightBulbAccessory.prototype.getBrightness = function(callback) {
  this.log("Getting current brightness for '%s'...", this.id);
  var state = this.storage.getItemSync("http-webhook-" + this.id);
  if (state === undefined) {
    state = false;
  }
  var brightness = 0;
  if (state) {
    brightness = this.storage.getItemSync("http-webhook-brightness-" + this.id);
    if (brightness === undefined) {
      brightness = 100;
    }
  }
  callback(null, parseInt(brightness));
};

HttpWebHookLightBulbAccessory.prototype.setBrightness = function(brightness, callback, context) {
  this.log("Light brightness for '%s'...", this.id);
  var newState = brightness > 0;
  this.storage.setItemSync("http-webhook-" + this.id, newState);
  this.storage.setItemSync("http-webhook-brightness-" + this.id, brightness);
  var brightnessFactor = this.brightnessFactor;
  var brightnessToSet = Math.ceil(brightness * brightnessFactor);
  var urlToCall = this.replaceVariables(this.brightnessURL, newState, brightnessToSet);
  var urlMethod = this.brightnessMethod;
  var urlBody = this.brightnessBody;
  var urlForm = this.brightnessForm;
  var urlHeaders = this.brightnessHeaders;

  if (urlForm) {
    urlForm = this.replaceVariables(urlForm, newState, brightnessToSet);
  }
  else if (urlBody) {
    urlBody = this.replaceVariables(urlBody, newState, brightnessToSet);
  }

  Util.callHttpApi(urlToCall, urlMethod, urlBody, urlForm, urlHeaders, callback, context);
};

HttpWebHookLightBulbAccessory.prototype.replaceVariables = function(text, state, brightness) {
  return text.replace("%statusPlaceholder", state).replace("%brightnessPlaceholder", brightness);
};

HttpWebHookLightBulbAccessory.prototype.getServices = function() {
  return [ this.service, this.informationService ];
};

module.exports = HttpWebHookLightBulbAccessory;