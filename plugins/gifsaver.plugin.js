/**
 * @name GifSaver
 * @version 1.0.0
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
				name: "bep",
				discord_id: "147077474222604288",
				github_username: "bepvte"
			}, {
				name: "TheGameratorT",
				discord_id: "355434532893360138",
				github_username: "TheGameratorT"
			}],
			version: "1.0.0",
			description: "Automatically backs up your favorited GIFs in your plugins folder, and then restores them if Discord erases them.",
			github: "https://github.com/bepvte/bd-addons",
			github_raw: "https://raw.githubusercontent.com/bepvte/bd-addons/main/plugins/gifsaver.plugin.js"
		},
		defaultConfig: [{
			type: "switch",
			id: "shareFavorites",
			name: "Share Favorites",
			note: "Makes it so all users use the same backup. (non-destructive)",
			value: true
		}, {
			type: "switch",
			id: "enableToasts",
			name: "Show Toasts",
			note: "Show a small message when GIFs are restored.",
			value: true
		}],
		changelog: [{
			title: "Rewritten!",
			type: "improved",
			items: ["GIFs are now automatically restored", "GIFs are now able to be saved per-account in settings"]
		}, {
			title: "Notes",
			items: [
				"We no longer check the `gifbackup.json` file, and now use the `GifSaver.config.json`",
				"Feel free to delete `gifbackup.json`",
				"We now require Zere's plugin library",
				"If you see any bugs or are annoyed by any new behavior, feel free to leave a message" +
					" on the https://github.com/bepvte/bd-addons/issues or ping me in the support server"
			]
		}]
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

	const plugin = (Plugin, Api) => {

	const {
		WebpackModules,
		DiscordModules,
		PluginUtilities,
		Toasts
	} = Api;

	const {
		UserStore,
		Dispatcher,
		DiscordConstants
	} = DiscordModules;

	const ActionTypes = DiscordConstants.ActionTypes;

	return class GifSaver extends Plugin {

	// When the plugin starts
	onStart() {
		this.objectStorage = WebpackModules.getByProps("ObjectStorage");
		this.gifStore = WebpackModules.getByProps("getRandomFavorite");

		Dispatcher.subscribe(ActionTypes.CONNECTION_OPEN, this.initialize); // Recover favorites after login
		this.gifStore.addChangeListener(this.onGifStoreChange); // Backup favorites on GIF store interaction

		/**
		 * Initialization needs to be here as well, because plugins
		 * are only loaded after CONNECTION_OPEN.
		 * The CONNECTION_OPEN subscription is only there
		 * to allow favorites to be restored right after logging in.
		 */
		this.initialize();
	}

	// When the plugin stops
	onStop() {
		Dispatcher.unsubscribe(ActionTypes.CONNECTION_OPEN, this.initialize);
		this.gifStore.removeChangeListener(this.onGifStoreChange);
	}

	// When interacting with the settings
	getSettingsPanel() {
		const panel = this.buildSettingsPanel();
		panel.addListener((id, value) => {
			if (id == "shareFavorites") {
				// Switch between shared and per-user
				const favorites = this.readBackup();
				this.restoreData(favorites);
				this.showToast(2, value);
			}
			if (id == "enableToasts") {
				// Toast only shown when enabling
				this.showToast(3, 0);
			}
		});
		return panel.getElement();
	}

	// Function that runs on plugin start and login
	initialize = () => {
		/**
		 * Read the backup and get the favorites.
		 *
		 * If there are no favorites, assume they
		 * got lost and try to restore them if
		 * the backup isn't empty.
		 *
		 * Otherwise, if the backup is empty
		 * but there are favorites, assume that
		 * it's the first use of the plugin and
		 * save the favorites in the backup.
		 */
		const backup = this.readBackup();
		const favorites = this.gifStore.getFavorites();

		if (favorites.length == 0 && backup.length > 0) { // No favorites but backup
			this.restoreData(backup);
			this.showToast(0, backup.length);
		}
		else if (backup.length == 0 && favorites.length > 0) { // No backup but favorites
			this.backupData(favorites);
			this.showToast(1, favorites.length);
		}
	}

	// Backup the favorites on store change
	onGifStoreChange = () => {
		const favorites = this.gifStore.getFavorites();
		this.backupData(favorites);
	}

	// Writes the favorites to the backup
	backupData(favorites) {
		const key = this.getSaveKey();
		PluginUtilities.saveData(this.getName(), key, favorites);
	}

	// Writes the favorites to the internal storage and re-initializes them
	restoreData(favorites) {
		const state = {
			favorites: favorites,
			timesFavorited: favorites.length
		};
		const store = {
			_state: state,
			_version: 2
		};
		this.objectStorage.impl.set("GIFFavoritesStore", store);
		this.gifStore.initialize(state);
	}

	// Gets the save key and returns the backup
	readBackup() {
		const key = this.getSaveKey();
		return PluginUtilities.loadData(this.getName(), key, []);
	}

	// Shows a toast if toasts are enabled
	showToast(id, value) {
		if (this.settings.enableToasts) {
			var msg;
			switch (id) {
				case 0: { msg = `Restored ${value} favorite GIFs.`; break; }
				case 1: { msg = `Backed up ${value} favorites GIFs.`; break; }
				case 2: { msg = `Switched to ${value ? "shared" : "per-user"} favorite GIFs.`; break; }
				case 3: { msg = "Enabled toasts."; break; }
			}

			setTimeout(() => Toasts.success(msg), 1);
		}
	}

	// Returns the key to use when acessing the backup
	getSaveKey() {
		return this.settings.shareFavorites ? "default" : UserStore.getCurrentUser().id;
	}

	};
	};
	
	return plugin(Plugin, Api);
	})(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/
