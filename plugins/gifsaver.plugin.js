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
				github_username: "bepvte"
			}, {
				name: "TheGameratorT",
				github_username: "TheGameratorT"
			}],
			version: "0.1.0",
			description: "Automatically backs up your favorited GIFs in your plugins folder, and then restores them if Discord erases them.",
			github: "https://github.com/bepvte/bd-addons",
			github_raw: "https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/gifsaver.plugin.js"
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
		this.worthRestoring = true; // Prevents reading the backup file multiple times if there are no favorites backed up
		this.patchAccountManager();
		this.patchGifManager();
		this.checkIfNeedsBackup(); // If the user already has favorites but the backup doesn't, backup them
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
			this.worthRestoring = true;
		});
	}

	// Patches the GIF manager in order to save the GIF backup
	patchGifManager() {
		Patcher.after(this.gifstore, "getFavorites", (self, args, retval) => {
			if (retval.length == 0 && this.worthRestoring) {
				this.worthRestoring = false;
				const restored = this.restoreGifs();
				if (restored.length > 0) {
					return restored;
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

	checkIfNeedsBackup() {
		const favBak = this.getGifBackup();
		if (favBak.length == 0) {
			const fav = this.gifstore.getFavorites();
			if (fav.length > 0) {
				this.backupGifsFromData(fav);
			}
			this.worthRestoring = false; // Set in advance that there is no point in trying to restore the backup since it's empty
		}
	}

	backupGifs() {
		const favorites = this.gifstore.getFavorites();
		this.backupGifsFromData(favorites);
	}

	backupGifsFromData(favorites) {
		const userID = this.getTargetUserID();
		PluginUtilities.saveData(this.getName(), userID, favorites);
	}

	getGifBackup() {
		const userID = this.getTargetUserID();
		return PluginUtilities.loadData(this.getName(), userID, []);
	}

	restoreGifs() {
		const favorites = this.getGifBackup();
		
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
