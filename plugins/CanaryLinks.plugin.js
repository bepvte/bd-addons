/**
 * @name Canary Links
 * @description Makes "copy message link" not begin with canary.discord.com or ptb.discord.com
 * @version 0.0.7
 * @author bep
 * @authorId 147077474222604288
 * @authorLink https://github.com/bepvte
 * @website https://github.com/bepvte/bd-addons
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
const config = {
    main: "index.js",
    name: "Canary Links",
    author: "bep",
    authorId: "147077474222604288",
    authorLink: "https://github.com/bepvte",
    version: "0.0.7",
    description: "Makes \"copy message link\" not begin with canary.discord.com or ptb.discord.com",
    github: "https://github.com/bepvte/bd-addons",
    github_raw: "https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/CanaryLinks.plugin.js",
    changelog: [
        {
            title: "Fixes",
            type: "fixed",
            items: [
                "Fixes the plugin for revamped discord! You will need the latest 0PluginLibrary for it to work"
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
     const plugin = (Plugin, Library) => {
  const { Patcher, Filters } = Library;
  const Webpack = BdApi.Webpack;
  return class CanaryLinks extends Plugin {
    onStart() {
      // discords copy to clipboard function
      this.copy = Webpack.getModule(
        Filters.combine(
          (m) => m?.length === 1,
          Filters.byString("ClipboardUtils.copy()")
        ),
        { searchExports: true }
      );

      this.Domain = "discord.com";
      this.Routes = Webpack.getModule(
        Filters.byProperties(["CHANNEL", "MESSAGE_REQUESTS"]),
        {
          searchExports: true,
        }
      );

      // message link copy
      Webpack.waitForModule(Filters.byString("COPY_MESSAGE_LINK"), {
        defaultExport: false,
      }).then((copyLinkItem) => {
        Patcher.after(copyLinkItem, "Z", this.messageCopyLink.bind(this));
      });

      // channel link copy
      Webpack.waitForModule(Filters.byString('id:"channel-copy-link"'), {
        defaultExport: false,
      }).then((copyLinkItem) => {
        Patcher.after(copyLinkItem, "Z", this.channelCopyLink.bind(this));
      });

      // the shift click menu and 3 dots menu on message hover
      const msgMenuExport = Webpack.getModule(
        Filters.byCode(/\)\(\w\.guild_id,\w\.id,\w\.id/),
        { searchExports: true }
      );
      const msgMenuItems = Webpack.getModule((x) =>
        Object.values(x).includes(msgMenuExport)
      );
      const [msgMenuExportName] = Object.entries(msgMenuItems).find(
        (entry) => entry[1] === msgMenuExport
      );
      Patcher.instead(msgMenuItems, msgMenuExportName, this.buttonCopyLink.bind(this));
    }
    onStop() {
      Patcher.unpatchAll();
    }

    // modify things that make react elements
    messageCopyLink(_thisobj, args, reactElement) {
      // `useMessageCopyLinkItem` returns undefined if its not a `SUPPORTS_COPY`
      if (reactElement) {
        // original action:
        // return (0, o.copy)(location.protocol + "//" + location.host + u.Routes.CHANNEL(t.guild_id, t.id, e.id))
        reactElement.props.action = () => {
          this.copyLink(args[1], args[0]);
        };
      }
      return reactElement;
    }
    channelCopyLink(_thisobj, args, reactElement) {
      // skipping original tracking metadata thing
      reactElement.props.action = () => {
        this.copyLink(args[0]);
      };
      return reactElement;
    }

    // function that is stored in the shift button menu giant list of functions
    buttonCopyLink(_thisobj, args) {
      this.copyLink(args[0], args[1]);
    }

    // utility
    copyLink(channel, message) {
      let url;
      if (message === undefined || message["id"] === undefined) {
        url =
          location.protocol +
          "//" +
          this.Domain +
          this.Routes.CHANNEL(channel.guild_id, channel.id);
      } else {
        url =
          location.protocol +
          "//" +
          this.Domain +
          this.Routes.CHANNEL(channel.guild_id, channel.id, message.id);
      }
      this.copy(url);
    }
  };
};
     return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));
/*@end@*/