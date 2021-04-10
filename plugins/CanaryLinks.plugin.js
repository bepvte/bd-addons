/**
 * @name CanaryLinks
 * @version 0.0.3
 * @authorLink https://github.com/bepvte
 * @source https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/CanaryLinks.plugin.js
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
    const config = {"main":"index.js","info":{"name":"Canary Links","authors":[{"name":"bep","discord_id":"147077474222604288","github_username":"bepvte"}],"authorLink":"https://github.com/bepvte","version":"0.0.3","description":"Makes \"copy message link\" not begin with canary.discord.com or ptb.discord.com","github":"https://github.com/bepvte/bd-addons","github_raw":"https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/CanaryLinks.plugin.js","changelog":[{"title":"Fixes","type":"fixed","items":["Makes the plugin work properly in DMs"]}]}};

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
  const { Patcher, WebpackModules, Filters } = Library;
  return class CanaryLinks extends Plugin {
    onStart() {
      // the ClipboardUtils module has no displayname and is only recognizable
      // through its singular `copy` function, but many modules have a `copy` property
      this.ClipboardUtils = WebpackModules.getModule((obj) => {
        const keys = Object.keys(obj);
        // so we find a module with only `copy`
        return keys.length === 1 && keys[0] === "copy";
      }, true);

      // we have to use getByIndex to get the 'raw' module, because the module exports just a function
      // this is the thing in the right click menu
      const copyLinkItem = WebpackModules.getByIndex(
        WebpackModules.getIndex(Filters.byDisplayName("useMessageCopyLinkItem"))
      );
      Patcher.after(
        copyLinkItem,
        "default",
        this.inlineMenuCopyLink.bind(this)
      );

      // the shift click menu and 3 dots menu on message hover
      const msgMenuItems = WebpackModules.getByProps("copyLink", "pinMessage");
      Patcher.instead(msgMenuItems, "copyLink", this.contextMenuCopyLink.bind(this));
    }
    inlineMenuCopyLink(_that, args, reactElement) {
      // `useMessageCopyLinkItem` returns undefined if its not a `SUPPORTS_COPY`
      if (reactElement) {
        // original action:
        // return (0, o.copy)(location.protocol + "//" + location.host + u.Routes.CHANNEL(t.guild_id, t.id, e.id))
        reactElement.props.action = () => {
          this.copyLink(args[1], args[0]);
        };
      }
    }
    contextMenuCopyLink(_that, args) {
      this.copyLink(args[0], args[1]);
    }
    copyLink(channel, message) {
      this.ClipboardUtils.copy(
        `https://discord.com/channels/${channel.guild_id ? channel.guild_id : '@me'}/${channel.id}/${message.id}`
      );
    }
    onStop() {
      Patcher.unpatchAll();
    }
  };
};
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();


/*@end@*/