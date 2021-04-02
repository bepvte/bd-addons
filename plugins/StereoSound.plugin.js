/**
 * @name StereoSound
 * @version 0.0.2
 * @authorLink https://github.com/bepvte
 * @source https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/StereoSound.plugin.js
 */
/*@cc_on
@if (@_jscript)
	
	// Offer to self-install for clueless users that try to run this directly.
	var shell = WScript.CreateObject("WScript.Shell");
	var fs = new ActiveXObject("Scripting.FileSystemObject");
	var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
	var pathSelf = WScript.ScriptFullName;
	// Put the user at ease by addressing them in the first person
	shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
	if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
		shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
	} else if (!fs.FolderExists(pathPlugins)) {
		shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
	} else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
		fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
		// Show the user where to put plugins in the future
		shell.Exec("explorer " + pathPlugins);
		shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
	}
	WScript.Quit();

@else@*/

module.exports = (() => {
    const config = {"main":"index.js","info":{"name":"StereoSound","authors":[{"name":"bep","discord_id":"147077474222604288","github_username":"bepvte"}],"authorLink":"https://github.com/bepvte","version":"0.0.2","description":"Adds stereo sound to voice calls. Not well tested. Does not have any visual indicator that it is working, just ask a friend or check logs. Make sure to disable noise cancellation, noise reduction, echo reduction, etc.","github":"https://github.com/bepvte/bd-addons","github_raw":"https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/StereoSound.plugin.js"}};

    return !global.ZeresPluginLibrary ? class {
        constructor() {this._config = config;}
        getName() {return config.info.name;}
        getAuthor() {return config.info.authors.map(a => a.name).join(", ");}
        getDescription() {return config.info.description;}
        getVersion() {return config.info.version;}
        load() {
            BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() {}
        stop() {}
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Library) => {
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
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();


/*@end@*/