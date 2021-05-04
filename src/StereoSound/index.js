/*
thanks to everyone who discovered these things about discords audio and the weird mess that is webrtc
most of what ive done here is write wrappers over and upgrade methods from
many other stereo plugins that people have sent me because they want me to fix them
*/
module.exports = (Plugin, Library) => {
  const { WebpackModules, Patcher, Toasts, Logger } = Library;

  return class StereoSound extends Plugin {
    onStart() {
      this.settingsWarning();
      const voiceModule = WebpackModules.getByPrototypes("setSelfDeaf");
      Patcher.after(voiceModule.prototype, "initialize", this.newConstructor.bind(this));
      Patcher.after(voiceModule.prototype, "getCodecOptions", this.newGetCodecOptions);
      // Patcher.after(voiceModule.prototype, "setLocalPan", this.newSetLocalPan);
      // Patcher.before(voiceModule.prototype, "setSpeakingFlags", this.newSetSpeakingFlags);
    }
    settingsWarning() {
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
        return true;
      } else return false;
    }
    newConstructor(thisObj, _args, ret) {
      const setTransportOptions = thisObj.conn.setTransportOptions;
      thisObj.conn.setTransportOptions = function (obj) {
        if (obj.audioEncoder) {
          // 90% of these dont even do anything but who knows which ones do
          obj.audioEncoder.params = {
            propstereo: true,
            stereo: "1",
            propstereo: true,
            useinbandfec: 1,
            tracks: 2,
            channels: 2,
          };
          obj.audioEncoder.channels = 2;
        }
        if (obj.fec) {
          obj.fec = false;
        }
        setTransportOptions.call(thisObj, obj);
      };
      if (!this.settingsWarning()) {
        if (this.settings.enableToasts) {
          Toasts.info("Stereo calling enabled");
        }
      }
      return ret;
    }
    // after
    newGetCodecOptions(_thisObj, _args, ret) {
      ret.audioEncoder.channels = 2;
      Logger.log("getCodecOptions returning ", ret);
      return ret;
    }
    /* these all dont seem to have any effect
    // after
    newSetLocalPan(thisObj, args, _ret) {
      Logger.log("localpan called: ", args, thisObj);
      thisObj.localPans = {
        left: 1,
        right: 1,
      };
    }
    // before
    // doesnt seem to work
    newSetSpeakingFlags(_thisObj, args) {
      Logger.log("setSpeakingFlags called with ", args);
      if (args.localSpeakingFlags.speakflags.SOUNDSHARE != 1) {
        args.localSpeakingFlags.speakflags.SOUNDSHARE = 1;
      }
    }
    */
    onStop() {
      Patcher.unpatchAll();
    }
    getSettingsPanel() {
      const panel = this.buildSettingsPanel();
      return panel.getElement();
    }
  };
};
