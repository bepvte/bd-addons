/**
 * @name NoSpotifyPause
 * @description Prevents Discord from pausing your Spotify when streaming or gaming.
 * @version 0.0.6
 * @author bep
 * @authorId 147077474222604288
 * @authorLink https://github.com/bepvte
 * @website https://github.com/bepvte/bd-addons
 * @source https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/NoSpotifyPause.plugin.js
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
const config = {
    main: "index.js",
    name: "NoSpotifyPause",
    author: "bep",
    authorId: "147077474222604288",
    authorLink: "https://github.com/bepvte",
    version: "0.0.6",
    description: "Prevents Discord from pausing your Spotify when streaming or gaming.",
    github: "https://github.com/bepvte/bd-addons",
    github_raw: "https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/NoSpotifyPause.plugin.js",
    changelog: [
        {
            title: "Fixes",
            type: "fixed",
            items: [
                "Fixes the plugin for revamped BetterDiscord! You will need the latest 0PluginLibrary for it to work",
                "Finally hides the spotify auto pause notice"
            ]
        }
    ]
};
class Dummy {
    constructor() {this._config = config;}
    start() {}
    stop() {}
}
 
if (!global.ZeresPluginLibrary) {
    BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.name ?? config.info.name} is missing. Please click Download Now to install it.`, {
        confirmText: "Download Now",
        cancelText: "Cancel",
        onConfirm: () => {
            require("request").get("https://betterdiscord.app/gh-redirect?id=9", async (err, resp, body) => {
                if (err) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                if (resp.statusCode === 302) {
                    require("request").get(resp.headers.location, async (error, response, content) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), content, r));
                    });
                }
                else {
                    await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                }
            });
        }
    });
}
 
module.exports = !global.ZeresPluginLibrary ? Dummy : (([Plugin, Api]) => {
     const plugin = (Plugin, _Library) => {
  const { Patcher, Webpack, React } = BdApi;
  return class NoSpotifyPause extends Plugin {
    onStart() {
      const target = Webpack.getByKeys("pause", "play", "SpotifyAPI");
      // we dont want to hide the notice if its not working
      if (target !== undefined) {
        this.notices = Webpack.getByRegex(/"div",\{className:.\(.\.notice,\{\[.\.isMobile/, {defaultExport: false});
        Patcher.instead("NoSpotifyPause", this.notices, "default", function (_this, [props], originalFunction) {
          if (props.children.some(x => x?.props?.noticeType === "SPOTIFY_AUTO_PAUSED")) {
            return React.createElement(React.Fragment, null);
          } else {
            return originalFunction(props)
          }
        })
      }
      Patcher.instead("NoSpotifyPause", target, "pause", () => {});
    }
    onStop() {
      Patcher.unpatchAll("NoSpotifyPause");
    }
  };
};
     return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));
/*@end@*/