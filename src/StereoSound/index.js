module.exports = (Plugin, Library) => {
  const { WebpackModules, Logger } = Library;

  return class StereoSound extends Plugin {
    onStart() {
      this.voiceModule = WebpackModules.getByPrototypes("setSelfDeaf");

      // not using patcher because we are just copying from PC plugin
      // I dont want to think about `this` or anything
      const initialize = this.voiceModule.prototype.initialize;
      this.originalInitialize = initialize;
      this.voiceModule.prototype.initialize = function () {
        initialize.call(this, ...arguments);
        const setTransportOptions = this.conn.setTransportOptions;
        this.conn.setTransportOptions = function (obj) {
          if (obj.audioEncoder) {
            obj.audioEncoder.params = {
              stereo: "2",
            };
            obj.audioEncoder.channels = 2;
          }
          if (obj.fec) {
            obj.fec = false;
          }
          setTransportOptions.call(this, obj);
          Logger.info("Initialization worked for this voice call");
        };
      };
    }
    onStop() {
      this.voiceModule.prototype.initialize = this.originalInitialize;
    }
  };
};
