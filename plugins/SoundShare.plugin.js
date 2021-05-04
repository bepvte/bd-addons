/**
 * @name SSPatch
 * @version 0.0.1
 * @author bep
 * @authorLink https://github.com/bepvte
 * @description Small patch to fix screenshare on windows '7'
 */

module.exports = class SSPatch {
  getVersion() {
    return config.info.version;
  }
  start() {
    this.capsModule = BdApi.findModuleByProps("supportsExperimentalSoundshare");
    if (!this.capsModule.supportsExperimentalSoundshare()) {
      return;
    }
    this.originalFunction = this.capsModule.supportsExperimentalSoundshare;
    this.capsModule.supportsExperimentalSoundshare = function () {
      return true;
    };
  }
  stop() {
    if (!this.originalFunction) {
      return;
    }
    this.capsModule.supportsExperimentalSoundshare = this.originalFunction;
  }
};
