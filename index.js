// Fibaro Melcloud Platform plugin for HomeBridge
//
// Remember to add platform to config.json. Example:
// "platforms": [
//     {
//            "platform": "Melcloud",
//            "name": "Melcloud",
//            "username": "PUT USERNAME OF YOUR MELCLOUD ACCOUNT HERE",
//            "password": "PUT PASSWORD OF YOUR MELCLOUD ACCOUNT HERE"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict';

var Service, Characteristic;
var request = require("request");

function MelcloudPlatform(log, config){
  	this.log          = log;
  	this.language = config["language"];
  	this.username = config["username"];
  	this.password = config["password"];
	this.ContextKey = null;
	this.UseFahrenheit = null;
	this.CurrentHeatingCoolingStateUUID = (new Characteristic.CurrentHeatingCoolingState()).UUID;
	this.TargetHeatingCoolingStateUUID = (new Characteristic.TargetHeatingCoolingState()).UUID;
	this.CurrentTemperatureUUID = (new Characteristic.CurrentTemperature()).UUID;
	this.TargetTemperatureUUID = (new Characteristic.TargetTemperature()).UUID;
	this.TemperatureDisplayUnitsUUID = (new Characteristic.TemperatureDisplayUnits()).UUID;
	this.RotationSpeedUUID = (new Characteristic.RotationSpeed()).UUID;
	this.CurrentHorizontalTiltAngleUUID = (new Characteristic.CurrentHorizontalTiltAngle()).UUID;
	this.TargetHorizontalTiltAngleUUID = (new Characteristic.TargetHorizontalTiltAngle()).UUID;
	this.CurrentVerticalTiltAngleUUID = (new Characteristic.CurrentVerticalTiltAngle()).UUID;
	this.TargetVerticalTiltAngleUUID = (new Characteristic.TargetVerticalTiltAngle()).UUID;
	this.currentAirInfoExecution = 0;
	this.airInfoExecutionPending = [];
  }

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  homebridge.registerPlatform("homebridge-melcloud", "Melcloud", MelcloudPlatform);
}

MelcloudPlatform.prototype = {
  accessories: function(callback) {
    this.log("Fetching Melcloud devices...");
    var that = this;
	// Login
	var url = "https://app.melcloud.com/Mitsubishi.Wifi.Client/Login/ClientLogin";
	var form = {
			AppVersion: "1.9.3.0",
			CaptchaChallenge: "",
			CaptchaResponse: "",
			Email: this.username,
			Language: this.language,
			Password: this.password,
			Persist: "true"
	};
	var method = "post";
	var that = this;
	request({
		url: url,
		form: form,
		method: method
	}, function(err, response) {
	  if (err) {
		that.log("There was a problem sending login to: " + url);
		that.log(err);
		callback([]);
	  } else {
		var r = eval("(" + response.body + ")");
		that.ContextKey = r.LoginData.ContextKey;
		that.UseFahrenheit = r.LoginData.UseFahrenheit;
		that.log("ContextKey: " + that.ContextKey);
		that.getDevices(callback);
	  }
	});
  },
  getDevices: function(callback) {
	var url = "https://app.melcloud.com/Mitsubishi.Wifi.Client/User/ListDevices";
	var method = "get";
	var that = this;
	request({
		url: url,
		method: method,
		headers: {
		"X-MitsContextKey" : this.ContextKey
		}
	}, function(err, response) {
	  if (err) {
		that.log("There was a problem getting devices from: " + url);
		that.log(err);
	  } else {
		var r = eval("(" + response.body + ")");
		var foundAccessories = [];
		for (var b = 0; b < r.length; b++) {
			var building = r[b];
			var devices = building.Structure.Devices;
			that.createAccessories(building, devices, foundAccessories);
			for (var f = 0; f < building.Structure.Floors.length; f++) {
				var devices = building.Structure.Floors[f].Devices;
				that.createAccessories(building, devices, foundAccessories);
				for (var a = 0; a < building.Structure.Floors[f].Areas.length; a++) {
					var devices = building.Structure.Floors[f].Areas[a].Devices;
					that.createAccessories(building, devices, foundAccessories);
				}
			}
			for (var a = 0; a < building.Structure.Areas.length; a++) {
				var devices = building.Structure.Areas[a].Devices;
				that.createAccessories(building, devices, foundAccessories);
			}
		}
        callback(foundAccessories);
	  }
	});
  },
  createAccessories: function(building, devices, foundAccessories) {
	for (var d = 0; d < devices.length; d++){
		var device = devices[d];
		var accessory = new MelcloudBridgedAccessory([
			{
				controlService: new Service.Thermostat(device.DeviceName),
				characteristics: [
					Characteristic.CurrentHeatingCoolingState,
					Characteristic.TargetHeatingCoolingState,
					Characteristic.CurrentTemperature,
					Characteristic.TargetTemperature,
					Characteristic.TemperatureDisplayUnits,
					Characteristic.RotationSpeed,
					Characteristic.CurrentHorizontalTiltAngle,
					Characteristic.TargetHorizontalTiltAngle,
					Characteristic.CurrentVerticalTiltAngle,
					Characteristic.TargetVerticalTiltAngle
				]
			}
		]);
		accessory.platform 			= this;
		accessory.remoteAccessory	= device;
		accessory.id 				= device.DeviceID;
		accessory.name				= device.DeviceName;
		accessory.model				= "";
		accessory.manufacturer		= "Mitsubishi";
		accessory.serialNumber		= device.SerialNumber;
		accessory.airInfo			= null;
		accessory.buildingId		= building.ID;
		this.log("Found device: " + device.DeviceName);
		foundAccessories.push(accessory);
	}

  },
  proxyAirInfo: function(callback, characteristic, service, homebridgeAccessory, value, operation) {
  	if (homebridgeAccessory.airInfo != null) {
	  	this.log("Data already available for: " + homebridgeAccessory.name + " - " + characteristic.displayName);
  		operation(callback, characteristic, service, homebridgeAccessory, value);
		if (this.airInfoExecutionPending.length) {
			var args = this.airInfoExecutionPending.shift()
			this.log("Dequeuing remote request for. " + args[3].name + " - " + args[1].displayName);
			this.proxyAirInfo.apply(this, args);
		}			
  		return;
  	}
  	this.log("Getting data for: " + homebridgeAccessory.name + " - " + characteristic.displayName);
	if (this.currentAirInfoExecution < 1) {
		homebridgeAccessory.airInfoRequestSent = true;
		this.currentAirInfoExecution++;
		var url = "https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=" + homebridgeAccessory.id + "&buildingID=" + homebridgeAccessory.buildingId;
		var method = "get";
		var that = this;
		request({
			url: url,
			method: method,
			headers: {
			"X-MitsContextKey" : homebridgeAccessory.platform.ContextKey
			}
		}, function(err, response) {
		  if (err || response.body.search("<!DOCTYPE html>") != -1) {
			that.log("There was a problem getting info from: " + url);
			that.log("for device: " + homebridgeAccessory.name);
			that.log("Error: " + err);
			homebridgeAccessory.airInfo = null;
			callback();
		  } else {
			homebridgeAccessory.airInfo = eval("(" + response.body + ")");
			operation(callback, characteristic, service, homebridgeAccessory, value);
			// Cache airInfo data for 1 minutes
			setTimeout( function(){
				homebridgeAccessory.airInfo = null;
			}, 60*1000 );
		  }
  		  that.currentAirInfoExecution--;
		  if (that.airInfoExecutionPending.length) {
			var args = that.airInfoExecutionPending.shift()
			that.log("Dequeuing remote request for: " + args[3].name + " - " + args[1].displayName);
			that.proxyAirInfo.apply(that, args);
		  }			
		});
	} else {
	  	this.log("Queing remote request data for: " + homebridgeAccessory.name + " - " + characteristic.displayName);
		this.airInfoExecutionPending.push(arguments);		
	}
  },
  getAccessoryValue: function(callback, characteristic, service, homebridgeAccessory, value) {
  	var r = homebridgeAccessory.airInfo;
	if (characteristic.UUID == homebridgeAccessory.platform.CurrentHeatingCoolingStateUUID) {
		if (r.Power == false) {
			callback(undefined, Characteristic.CurrentHeatingCoolingState.OFF);
			return;
		} else {
			switch (r.OperationMode) {
				case 1:
					callback(undefined, Characteristic.CurrentHeatingCoolingState.HEAT);
					return;
				case 3:
					callback(undefined, Characteristic.CurrentHeatingCoolingState.COOL);
					return;
				default:
					// Melcloud can return also 2 (deumidity), 7 (Ventilation), 8 (auto)
					// We try to return 5 which is undefined in homekit
					callback(undefined, 5);
					return;
			}
		}
	} else if (characteristic.UUID == homebridgeAccessory.platform.TargetHeatingCoolingStateUUID) {
		if (r.Power == false) {
			callback(undefined, Characteristic.TargetHeatingCoolingState.OFF);
			return;
		} else {
			switch (r.OperationMode) {
				case 1:
					callback(undefined, Characteristic.TargetHeatingCoolingState.HEAT);
					return;
				case 3:
					callback(undefined, Characteristic.TargetHeatingCoolingState.COOL);
					return;
				case 8:
					callback(undefined, Characteristic.TargetHeatingCoolingState.AUTO);
					return;
				default:
					// Melcloud can return also 2 (deumidity), 7 (Ventilation)
					// We try to return 5 which is undefined in homekit
					callback(undefined, 5);
					return;
			}
		}
	} else if (characteristic.UUID == homebridgeAccessory.platform.CurrentTemperatureUUID) {
		callback(undefined, r.RoomTemperature);
		return;
	} else if (characteristic.UUID == homebridgeAccessory.platform.TargetTemperatureUUID) {
		callback(undefined, r.SetTemperature);
		return;
	} else if (characteristic.UUID == homebridgeAccessory.platform.TemperatureDisplayUnitsUUID) {
		if (homebridgeAccessory.platform.UseFahrenheit) {
			callback(undefined, Characteristic.TemperatureDisplayUnits.FAHRENHEIT);
		} else {
			callback(undefined, Characteristic.TemperatureDisplayUnits.CELSIUS);
		}
		return;
	} else if (characteristic.UUID == homebridgeAccessory.platform.RotationSpeedUUID) {
		var SetFanSpeed = r.SetFanSpeed,
			NumberOfFanSpeeds = r.NumberOfFanSpeeds;
		var fanSpeed = SetFanSpeed/NumberOfFanSpeeds*100.0;
		callback(undefined, fanSpeed);
		return;
	} else if (characteristic.UUID == homebridgeAccessory.platform.CurrentHorizontalTiltAngleUUID ||
			   characteristic.UUID == homebridgeAccessory.platform.TargetHorizontalTiltAngleUUID) {
		var VaneHorizontal = r.VaneHorizontal;
		var HorizontalTilt = -90.0 + 45.0 * (VaneHorizontal - 1);
		callback(undefined, HorizontalTilt);
		return;
	} else if (characteristic.UUID == homebridgeAccessory.platform.CurrentVerticalTiltAngleUUID ||
			   characteristic.UUID == homebridgeAccessory.platform.TargetVerticalTiltAngleUUID) {
		var VaneVertical = r.VaneVertical;
		var VerticallTilt = 90.0 - 45.0 * (5 - VaneVertical);
		callback(undefined, VerticallTilt);
		return;
	} else {
		callback(undefined, 0);
		return;
	}
  },
  setAccessoryValue: function(callback, characteristic, service, homebridgeAccessory, value) {
	var r = homebridgeAccessory.airInfo;
	if (characteristic.UUID == homebridgeAccessory.platform.TargetHeatingCoolingStateUUID) {
		switch (value) {
			case Characteristic.TargetHeatingCoolingState.OFF:
				r.Power = false;
				r.EffectiveFlags = 1;
				break;
			case Characteristic.TargetHeatingCoolingState.HEAT:
				r.Power = true;
				r.OperationMode = 1;
				r.EffectiveFlags = 1 + 2;
				break;
			case Characteristic.TargetHeatingCoolingState.COOL:
				r.Power = true;
				r.OperationMode = 3;
				r.EffectiveFlags = 1 + 2;
				break;
			case Characteristic.TargetHeatingCoolingState.AUTO:
				r.Power = true;
				r.OperationMode = 8;
				r.EffectiveFlags = 1 + 2;
				break;
			default:
				callback();
				return;			
		}
	} else if (characteristic.UUID == homebridgeAccessory.platform.TargetTemperatureUUID) {
		r.SetTemperature = value;
		r.EffectiveFlags = 4;
	} else if (characteristic.UUID == homebridgeAccessory.platform.TemperatureDisplayUnitsUUID) {
		var UseFahrenheit=false;
		if (value == Characteristic.TemperatureDisplayUnits.FAHRENHEIT)
			UseFahrenheit = true;
		homebridgeAccessory.platform.updateApplicationOptions(UseFahrenheit);
		homebridgeAccessory.platform.UseFahrenheit = UseFahrenheit;
		callback();
		return;			
	} else if (characteristic.UUID == homebridgeAccessory.platform.RotationSpeedUUID) {
		r.SetFanSpeed = (value/100.0 * r.NumberOfFanSpeeds).toFixed(0);
		r.EffectiveFlags = 8;
	} else if (characteristic.UUID == homebridgeAccessory.platform.TargetHorizontalTiltAngleUUID) {
		r.VaneHorizontal = ((value + 90.0)/45.0 + 1.0).toFixed(0);
		r.EffectiveFlags = 256;
	} else if (characteristic.UUID == homebridgeAccessory.platform.TargetVerticalTiltAngleUUID) {
		r.VaneVertical = ((value + 90.0) / 45.0 + 1.0).toFixed(0);
		r.EffectiveFlags = 16;
	} else {
		callback();
		return;
	}
  	var url = "https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAta";
	var method = "post";
	var body = JSON.stringify(homebridgeAccessory.airInfo);
	var that = this;
	request({
		url: url,
		method: method,
    	body: body,
		headers: {
			"X-MitsContextKey": homebridgeAccessory.platform.ContextKey,
			"content-type": "application/json"
		}
	}, function(err, response) {
	  if (err) {
		that.log("There was a problem setting info to: " + url);
		that.log(err);
	  }
	  callback();
    });
  },
  updateApplicationOptions: function(UseFahrenheit) {
  	var url = "https://app.melcloud.com/Mitsubishi.Wifi.Client/User/UpdateApplicationOptions";
	var method = "post";
  	var body = "{UseFahrenheit:" + UseFahrenheit + ",EmailOnCommsError:false,EmailOnUnitError:false,EmailCommsErrors:1,EmailUnitErrors:1,RestorePages:false,MarketingCommunication:false,AlternateEmailAddress:\"\",Fred:4}";
	var that = this;
	request({
		url: url,
		method: method,
    	body: body,
		headers: {
			"X-MitsContextKey": this.ContextKey,
			"content-type": "application/json"
		}
	}, function(err, response) {
	  if (err) {
		that.log("There was a problem setting Application Option to: " + url);
		that.log(err);
	  }
    });
  },
  getInformationService: function(homebridgeAccessory) {
    var informationService = new Service.AccessoryInformation();
    informationService
                .setCharacteristic(Characteristic.Name, homebridgeAccessory.name)
				.setCharacteristic(Characteristic.Manufacturer, homebridgeAccessory.manufacturer)
			    .setCharacteristic(Characteristic.Model, homebridgeAccessory.model)
			    .setCharacteristic(Characteristic.SerialNumber, homebridgeAccessory.serialNumber);
  	return informationService;
  },
  bindCharacteristicEvents: function(characteristic, service, homebridgeAccessory) {
  	var readOnly = true;
  	for (var i = 0; i < characteristic.props.perms.length; i++)
		if (characteristic.props.perms[i] == "pw")
			readOnly = false;
	if (!readOnly) {
    	characteristic
    	    .on('set', function(value, callback, context) {
        	            	if( context !== 'fromMelcloud') {
						  		homebridgeAccessory.platform.proxyAirInfo(callback, characteristic, service, homebridgeAccessory, value, homebridgeAccessory.platform.setAccessoryValue);
							} 
        	           }.bind(this) );
    }
    characteristic
        .on('get', function(callback) {
				  		homebridgeAccessory.platform.proxyAirInfo(callback, characteristic, service, homebridgeAccessory, null, homebridgeAccessory.platform.getAccessoryValue);
                   }.bind(this) );
  },
  getServices: function(homebridgeAccessory) {
  	var services = [];
  	var informationService = homebridgeAccessory.platform.getInformationService(homebridgeAccessory);
  	services.push(informationService);
  	for (var s = 0; s < homebridgeAccessory.services.length; s++) {
		var service = homebridgeAccessory.services[s];
		for (var i=0; i < service.characteristics.length; i++) {
			var characteristic = service.controlService.getCharacteristic(service.characteristics[i]);
			if (characteristic == undefined)
				characteristic = service.controlService.addCharacteristic(service.characteristics[i]);
			homebridgeAccessory.platform.bindCharacteristicEvents(characteristic, service, homebridgeAccessory);
		}
		services.push(service.controlService);
    }
    return services;
  }  
}

function MelcloudBridgedAccessory(services) {
    this.services = services;
}

MelcloudBridgedAccessory.prototype = {
  	getServices: function() {
		var services = [];
		var informationService = this.platform.getInformationService(this);
		services.push(informationService);
		for (var s = 0; s < this.services.length; s++) {
			var service = this.services[s];
			for (var i=0; i < service.characteristics.length; i++) {
				var characteristic = service.controlService.getCharacteristic(service.characteristics[i]);
				if (characteristic == undefined)
					characteristic = service.controlService.addCharacteristic(service.characteristics[i]);
				this.platform.bindCharacteristicEvents(characteristic, service, this);
			}
			services.push(service.controlService);
		}
		return services;
	}
}