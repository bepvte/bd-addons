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
				name: "bepvte",
				github_username: "bepvte"
			}, {
				name: "TheGameratorT",
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
		}],
		changelog: [{
			title: "Improved",
			type: "improved",
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
		WebpackModules,
		DiscordModules,
		PluginUtilities
	} = Api;

	const {
		UserStore,
		Dispatcher,
		DiscordConstants
	} = DiscordModules;

	const ActionTypes = DiscordConstants.ActionTypes;

	return class GifSaver extends Plugin {

	onStart() {
		this.objectStorage = WebpackModules.getByProps("ObjectStorage");
		this.gifStore = WebpackModules.getByProps("getRandomFavorite");

		Dispatcher.subscribe(ActionTypes.CONNECTION_OPEN, this.initialize); // Recover favorites after login
		this.gifStore.addChangeListener(this.backup); // Backup favorites on GIF store interaction
		
		/**
		 * Initialization needs to be here as well, because plugins
		 * are only loaded after CONNECTION_OPEN.
		 * The CONNECTION_OPEN subscription is only there
		 * to allow favorites to be restored right after logging in.
		 */
		this.initialize();
	}

	onStop() {
		Dispatcher.unsubscribe(ActionTypes.CONNECTION_OPEN, this.initialize);
		this.gifStore.removeChangeListener(this.backup);
	}
	
	getSettingsPanel() {
		const panel = this.buildSettingsPanel();
		panel.addListener((id, value) => {
			if (id == "shareFavorites") {
				this.restore(); // Switch between shared and per-user
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
		}
		else if (backup.length == 0 && favorites.length > 0) { // No backup but favorites
			this.backupData(favorites);
		}
	}

	// Gets the favorites and writes them to backup
	backup = () => {
		const favorites = this.gifStore.getFavorites();
		this.backupData(favorites);
	}

	// Gets the favorites in the backup and restores them
	restore = () => {
		const favorites = this.readBackup();
		this.restoreData(favorites);
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
