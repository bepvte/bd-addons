/**
 * @name GifSaver
 * @version 0.1.0
 * @description Backups the list of favorited gifs inside your plugins folder.
 * @author bepvte
 * @authorLink https://github.com/bepvte
 * @source https://github.com/bepvte/bd-addons
 * */

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
	const config = {
		info: {
			name: "GifSaver",
			authors: [{
				name: "bepvte",
				github_username: "bepvte",
				github: "https://github.com/bepvte/bd-addons",
				github_raw: "https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/gifsaver.plugin.js"
			}, {
				name: "TheGameratorT",
				github_username: "TheGameratorT",
				github: "https://github.com/TheGameratorT/BetterDiscordAddons",
			}],
			version: "0.1.0",
			description: "Automatically backs up your favorited GIFs in your plugins folder, and then restores them if Discord erases them."
		},
		defaultConfig: [{
			type: "switch",
			id: "shareFavorites",
			name: "Share Favorites",
			note: "Makes it so all users use the same backup.",
			value: true
		}],
		changelog: [{
			title: "Plugin Status",
			type: "fixed",
			items: ["Added support for automatically restoring GIFs and different GIF backups per account."]
		}],
		main: "index.js"
	};

	return !global.ZeresPluginLibrary ? class {

	constructor() { this._config = config; }
	getName() { return config.info.name; }
	getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
	getDescription() { return config.info.description; }
	getVersion() { return config.info.version; }
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

	/* ================ CLASS START ================ */

	const plugin = (Plugin, Api) => {

	const {
		Patcher,
		WebpackModules,
		DiscordModules,
		PluginUtilities,
		Modals
	} = Api;

	const UserStore = DiscordModules.UserStore;

	return class GifSaver extends Plugin {

	onStart() {
		if (!this.findModules()) {
			BdApi.Plugins.disable(this.getName());
			return;
		}
		this.allowRestore = true; // Prevents reading the backup file multiple times if there are no favorites backed up
		this.patchAccountManager();
		this.patchGifManager();
	}

	onStop() {
		Patcher.unpatchAll();
	}
	
    getSettingsPanel() {
        const panel = this.buildSettingsPanel();
        panel.addListener((id, value) => {
            if (id == "shareFavorites") {
				this.backupGifs();
            }
        });
        return panel.getElement();
    }

	findModules() {
		this.storage = WebpackModules.getByProps(["ObjectStorage"]);
		if (!this.storage) {
			this.alertMissingModule("ObjectStorage");
			return false;
		}
		this.gifstore = WebpackModules.getByProps(["getRandomFavorite"]);
		if (!this.gifstore) {
			this.alertMissingModule("GIFStore");
			return false;
		}
		this.gifmanager = WebpackModules.getModule(m => m.addFavoriteGIF && m.removeFavoriteGIF);
		if (!this.gifmanager) {
			this.alertMissingModule("GIFManager");
			return false;
		}
		return true;
	}

	// Patches the logout so a restore can be attempted in the next account
	patchAccountManager() {
		const AccountManager = WebpackModules.getByProps(["login", "logout"]);
		Patcher.before(AccountManager, "logout", () => {
			this.allowRestore = true;
		});
	}

	// Patches the GIF manager in order to save the GIF backup
	patchGifManager() {
		Patcher.after(this.gifstore, "getFavorites", (self, args, retval) => {
			if (retval.length == 0) {
				if (this.allowRestore) {
					const restored = this.restoreGifs();
					if (restored.length > 0) {
						return restored;
					}
					this.allowRestore = false;
				}
			}
		});

		Patcher.after(this.gifmanager, "addFavoriteGIF", () => {
			this.backupGifs();
		});

		Patcher.after(this.gifmanager, "removeFavoriteGIF", () => {
			this.backupGifs();
		});
	}

	backupGifs() {
		const userID = this.getTargetUserID();
		const favorites = this.gifstore.getFavorites();
		PluginUtilities.saveData(this.getName(), userID, favorites);
	}

	restoreGifs() {
		const userID = this.getTargetUserID();
		const favorites = PluginUtilities.loadData(this.getName(), userID, []);

		const state = {
			favorites: favorites,
			timesFavorited: favorites.length
		};

		this.storage.impl.set("GIFFavoritesStore", {
			_state: state,
			_version: 2
		});
		
		this.gifstore.initialize(state);

		return favorites;
	}

	getTargetUserID() {
		return this.settings.shareFavorites ? -1 : UserStore.getCurrentUser().id;
	}

	alertMissingModule(moduleName) {
		Modals.showAlertModal("Could not find module", `'${moduleName}' could not be found, maybe the plugin is outdated.`);
	}

	};
	};
	
	return plugin(Plugin, Api);
	})(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/
