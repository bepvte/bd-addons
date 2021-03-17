/**
 * @name GifSaver
 * @description Backups the list of favorited gifs inside your plugins folder.
 * @author bepvte
 * @authorLink https://github.com/bepvte
 * @source https://github.com/bepvte/bd-addons
 * */
// this jscript code was borrowed from Zerebros plugins
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

module.exports = class GifSaver {
  getVersion() {
    return "0.0.5";
  }
  getChangelog() {
    return "**Version 0.0.5**: Clarified some text from the popups";
  }

  load() {
    // check for updates if we have zlibrary
    if (window.ZeresPluginLibrary) {
      ZeresPluginLibrary.PluginUpdater.checkForUpdate(
        "GifSaver",
        this.getVersion(),
        "https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/gifsaver.plugin.js"
      );
    }
  }
  backup(...ignore) {
    this.fs.writeFile(
      this.path,
      JSON.stringify(
        {
          _state: this.gifstore.getState(),
          _version: this.gifstore._version,
        },
        null,
        2
      ),
      "utf8",
      (err) => {
        if (err) {
          BdApi.alert("Gif backup failed: " + err.message);
        }
      }
    );
  }
  restore() {
    this.fs.readFile(this.path, "utf8", (err, data) => {
      if (err) {
        if (err.code == "ENOENT") {
          BdApi.alert(
            "Gif Saver",
            "You dont seem to have a gif favorites backup in your plugins folder 😅.\n\n" +
            "If this is your first time using this plugin, you can ignore this message. Your favorites will be backed up anyway once you add any."
          );
          return;
        }
        console.dir(err);
        BdApi.alert("Gif Saver", "Error reading gifstore: " + err.message);
        return;
      }
      const store = JSON.parse(data);
      this.localstorage.set("GIFFavoritesStore", store);
      BdApi.showConfirmationModal(
        "Gif Saver",
        "Your gifs have been restored. Reload for it to take effect.",
        {
          confirmText: "Reload",
          onConfirm: () => {
            location.reload();
          },
        }
      );
    });
  }
  start() {
    this.localstorage = BdApi.findModuleByProps("ObjectStorage").impl;
    this.gifstore = BdApi.findModuleByProps("getRandomFavorite");
    this.fs = require("fs");
    this.path = require("path").join(BdApi.Plugins.folder, "gifbackup.json");
    if (typeof this.gifstore === "undefined") {
      throw new Error(
        "Failed to find Discord's gifstore. Plugin's probably out of date or broken. Sorry!"
      );
    }
    let state = this.gifstore.getState();
    if (typeof state.favorites === "undefined" || state.favorites.length == 0) {
      // time to restore gifs
      BdApi.showConfirmationModal(
        "Gif Saver",
        "You seem to have lost your gif favorites. Would you like me to attempt to restore them?",
        {
          confirmText: "Restore",
          onConfirm: this.restore.bind(this),
        }
      );
    } else {
      // We do it here because we want to be sure not to backup empty gif list
      this.backup();
      // this changelog loves to fight with the other modals
      if (window.ZeresPluginLibrary) {
        let lastVersion = BdApi.getData("gifsaver", "version");
        if (!lastVersion || window.ZeresPluginLibrary.PluginUpdater.defaultComparator(lastVersion, this.getVersion())) {
          BdApi.alert("GifSaver Changelog", this.getChangelog());
        }
        BdApi.saveData("gifsaver", "version", this.getVersion());
      }
    }
    this.boundbackup = this.backup.bind(this);
    this.gifstore.addChangeListener(this.boundbackup);
  }
  stop() {
    this.gifstore.removeChangeListener(this.boundbackup);
    delete this.localstorage;
    delete this.gifstore;
    delete this.fs;
    delete this.path;
    delete this.boundbackup;
  }
};
/*@end@*/
