module.exports = (Plugin, Library) => {
  const { WebpackModules, Patcher, Toasts } = Library;

  return class StereoSound extends Plugin {
    onStart() {
      const voiceSettingsStore = WebpackModules.getByProps("getEchoCancellation");
      if (
        voiceSettingsStore.getNoiseSuppression() ||
        voiceSettingsStore.getNoiseCancellation() ||
        voiceSettingsStore.getEchoCancellation()
      ) {
        if (this.settings.enableToasts) {
          Toasts.show(
            "Please disable echo cancellation, noise reduction, and noise suppression for StereoSound",
            { type: "warning", timeout: 5000 }
          );
        }
        // This would not work, noise reduction would be stuck to on
        // const voiceSettings = WebpackModules.getByProps("setNoiseSuppression");
        // 2nd arg is for analytics
        // voiceSettings.setNoiseSuppression(false, {});
        // voiceSettings.setEchoCancellation(false, {});
        // voiceSettings.setNoiseCancellation(false, {});
      }

      const voiceModule = WebpackModules.getByPrototypes("setSelfDeaf");
      Patcher.after(voiceModule.prototype, "initialize", this.replacement.bind(this));
    }
    replacement(thisObj, _args, ret) {
      const setTransportOptions = thisObj.conn.setTransportOptions;
      thisObj.conn.setTransportOptions = function (obj) {
        if (obj.audioEncoder) {
          obj.audioEncoder.params = {
            stereo: "2",
          };
          obj.audioEncoder.channels = 2;
        }
        if (obj.fec) {
          obj.fec = false;
        }
        setTransportOptions.call(thisObj, obj);
      };
      if (this.settings.enableToasts) {
        Toasts.info("Stereo calling enabled");
      }
      return ret;
    }
    onStop() {
      Patcher.unpatchAll();
    }
    getSettingsPanel() {
      const panel = this.buildSettingsPanel();
      return panel.getElement();
    }
  };
};
