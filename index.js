var Service, Characteristic
var wol = require('wake_on_lan')
var ping = require('ping')
var inherits = require('util').inherits

module.exports = function(homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic

  Characteristic.Volume = function() {
		Characteristic.call(this, 'Volume','ec628f75-7092-4b94-99aa-9646ba00032a')
		this.setProps({
			format: Characteristic.Formats.INT,
			unit: Characteristic.Units.NONE,
			maxValue: 100,
			minValue: 0,
			minStep: 1,
			perms: [
        Characteristic.Perms.READ,
        Characteristic.Perms.WRITE,
        Characteristic.Perms.NOTIFY
      ]
		})
		this.value = this.getDefaultValue()
	}
	inherits(Characteristic.Volume, Characteristic)
	Characteristic.Volume.UUID = 'ec628f75-7092-4b94-99aa-9646ba00032a'

  Characteristic.ChannelNumber = function() {
		Characteristic.call(this, 'Channel Number','bfe04d88-9743-49b4-ab53-d9e809eeff4b')
		this.setProps({
			format: Characteristic.Formats.STRING,
			// unit: Characteristic.Units.NONE,
			// maxValue: 999,
			// minValue: 1,
			// minStep: 1,
			perms: [
        Characteristic.Perms.READ,
        // Characteristic.Perms.WRITE,
        // Characteristic.Perms.NOTIFY
      ]
		})
		this.value = this.getDefaultValue()
	}
	inherits(Characteristic.ChannelNumber, Characteristic)
	Characteristic.ChannelNumber.UUID = 'bfe04d88-9743-49b4-ab53-d9e809eeff4b'

  Characteristic.ChannelName = function() {
		Characteristic.call(this, 'Channel Name','ce82b4c3-b754-4041-bc7b-6933adbd6ce6')
		this.setProps({
			format: Characteristic.Formats.STRING,
			perms: [
        Characteristic.Perms.READ
      ]
		})
		this.value = this.getDefaultValue()
	}
	inherits(Characteristic.ChannelName, Characteristic)
	Characteristic.ChannelName.UUID = 'ce82b4c3-b754-4041-bc7b-6933adbd6ce6'

  homebridge.registerAccessory('homebridge-lgtv2', 'LGTv2', LGTv2)
}

function LGTv2(log, config, api) {
  this.log = log
  this.ip = config['ip']
  this.name = config['name']
  this.mac = config['mac']
  this.keyFile = config['keyFile']
  this.powered = false

  this.service = new Service.Switch(this.name)

  this.service.getCharacteristic(Characteristic.On)
    .on('get', this.getState.bind(this))
    .on('set', this.setState.bind(this))

  this.service.addCharacteristic(Characteristic.ChannelNumber)
  this.service.addCharacteristic(Characteristic.ChannelName)
  this.service.addCharacteristic(Characteristic.Volume)

  this.service.getCharacteristic(Characteristic.Volume)
    .on('get', this.getVolume.bind(this))
    .on('set', this.setVolume.bind(this))

  this.service.getCharacteristic(Characteristic.ChannelNumber)
    .on('get', this.getChannelNumber.bind(this))
    // .on('set', this.setChannelNumber.bind(this))

  this.service.getCharacteristic(Characteristic.ChannelName)
    .on('get', this.getChannelName.bind(this))

  this.accessoryInformationService = new Service.AccessoryInformation()
    .setCharacteristic(Characteristic.Manufacturer, 'LG Electronics Inc.')
    .setCharacteristic(Characteristic.Model, 'webOS TV')
    .setCharacteristic(Characteristic.SerialNumber, '-')

  this.log("Initialized LGTV")
	
}

LGTv2.prototype.connect = function(callback) {
  var self = this
  var cb = false
  this.log("Connecting to LGTV")
  var lgtv = require('lgtv2')({
    url: 'ws://' + this.ip + ':3000',
    keyFile: this.keyFile,
    timeout: 4000,
    reconnect: 0
  })
  lgtv.on('prompt', function(key) {
    self.log('This is your LGTv2 key: '+key)
  })
  lgtv.on('error', function() {
	  self.log("lg tv error")
    self.powered = false
    if (!cb) {
      cb = true
      return callback(new Error('LGTv2 not connected'))
    }
  })
  lgtv.on('connect', function() {
	  self.log("lg tv connect")
    self.powered = true
    if (!cb) {
      cb = true
      return callback(null, lgtv)
    }
  })
  
  this.log("Connected to LGTV")
}

LGTv2.prototype.getState = function(callback) {
  var self = this
  
  this.log("Getting LGTV State")
  ping.sys.probe(this.ip, function(isAlive) {
    if (!isAlive) {
      this.log("LGTV is not alive")
      self.powered = false
      return callback(null, false)
    } else {
      this.log("LGTV is alive")
      self.powered = true
      return callback(null, true)
    }
  })
}

LGTv2.prototype.getVolume = function(callback) {
	this.log("Getting volume")
  var self = this
  if (this.powered) {
    this.connect(function(err, lgtv) {
      if (err) return callback(err)
      lgtv.request('ssap://audio/getVolume', function(err, res) {
        lgtv.disconnect()
        return callback(null, res.volume)
      })
    })
  } else {
    return callback(new Error('TV not powered on'))
  }
}

LGTv2.prototype.getChannelNumber = function(callback) {
	this.log("Getting channel number")
  var self = this
  if (this.powered) {
    this.connect(function(err, lgtv) {
      if (err) return callback(err)
      lgtv.request('ssap://tv/getCurrentChannel', function(err, res) {
        lgtv.disconnect()
        return callback(null, res.channelNumber)
      })
    })
  } else {
    return callback(new Error('TV not powered on'))
  }
}

LGTv2.prototype.getChannelName = function(callback) {
	this.log("Getting channel name")
  var self = this
  if (this.powered) {
    this.connect(function(err, lgtv) {
      if (err) return callback(err)
      lgtv.request('ssap://tv/getCurrentChannel', function(err, res) {
        lgtv.disconnect()
        return callback(null, res.channelName)
      })
    })
  } else {
    return callback(new Error('TV not powered on'))
  }
}

LGTv2.prototype.identify = function(callback) {
  var self = this
  this.log("LGTV is being identified")
  if (this.powered) {
    this.connect(function(err, lgtv) {
      if (err) return callback(err)
      lgtv.request('ssap://system.notifications/createToast', {
        message: 'This is your TV!'
      }, function(err, res) {
        lgtv.disconnect()
        return callback()
      })
    })
  } else {
    return callback(new Error('TV not powered on'))
  }
}

LGTv2.prototype.checkInterval = function(callback) {
	this.log("check interval")
  var self = this
  ping.sys.probe(this.ip, function(isAlive) {
    if (!isAlive) {
      self.powered = false
      setTimeout(self.checkInterval.bind(self, callback), 5000)
    } else {
      self.powered = true
      return callback(null, true)
    }
  })
}

LGTv2.prototype.setVolume = function(state, callback) {
	this.log("Setting volume")
  var self = this
  if (this.powered) {
    this.connect(function(err, lgtv) {
      if (err) return callback(err)
      lgtv.request('ssap://audio/setVolume', {
        volume: state
      }, function(err, res) {
        lgtv.disconnect()
        return callback(null, true)
      })
    })
  } else {
    return callback(new Error('TV not powered on'))
  }
}

LGTv2.prototype.setChannelNumber = function(state, callback) {
	this.log("Setting channel number")
  var self = this
  if (this.powered) {
    return callback(null, true)
  } else {
    return callback(new Error('TV not powered on'))
  }
}

LGTv2.prototype.setState = function(state, callback) {
	this.log("Setting state")
  var self = this
  if (state) {
    if (this.powered) {
      return callback(null, true)
    } else {
      wol.wake(this.mac, function(err) {
        setTimeout(self.checkInterval.bind(self, callback), 5000)
      })
    }
  } else {
    if (this.powered) {
      this.connect(function(err, lgtv) {
        if (err) return callback(err)
        lgtv.request('ssap://system/turnOff', function(err, res) {
          lgtv.disconnect()
          self.powered = false
          return callback(null, true)
        })
      })
    } else {
      return callback(null, false)
    }
  }
}

LGTv2.prototype.getServices = function() {
	this.log("Getting services")
  return [
    this.service,
    this.accessoryInformationService
  ]
}
