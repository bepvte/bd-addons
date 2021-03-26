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
		defaultConfig: [
			{
				type: "switch",
				id: "shareFavorites",
				name: "Share Favorites",
				note: "Makes it so all users use the same backup.",
				value: true
			},
			{
				type: "switch",
				id: "skipConfirmations",
				name: "Skip Confirmations",
				note: "This will cause gifs to restore without any confirmation. Could potentially overwrite something by accident.",
				value: false,
			},
		],
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
		WebpackModules,
		DiscordModules,
		PluginUtilities,
		Modals
	} = Api;

	const {
		UserStore,
		Dispatcher,
		DiscordConstants
	} = DiscordModules;

	return class GifSaver extends Plugin {

	onStart() {
		this.storage = WebpackModules.getByProps("ObjectStorage");
		this.gifstore = WebpackModules.getByProps("getRandomFavorite");

		// Patches:
		// Patches the logout so a restore can be attempted in the next account
		// if we arent logged in yet
		if (!BdApi.findModuleByProps("isAuthenticated").isAuthenticated()) {
			// try again after login
			Dispatcher.subscribe(DiscordConstants.ActionTypes.CONNECTION_OPEN, () => {
				if (BdApi.Plugins.isEnabled("GifSaver")) {
					BdApi.Plugins.reload("GifSaver");
				}
			});
			return;
		}

		let state = gifstore.getState();
		if (typeof state.favorites === "undefined" || state.favorites.length == 0) {
			this.restoreGifs();
		} else {
			this.checkIfNeedsBackup();
		}
		this.gifstore.addChangeListener(this.backupGifs);
	}

	onStop() {
		this.gifstore.removeChangeListener(this.backupGifs);
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

	checkIfNeedsBackup() {
		// if we have no gifs backed up
		const backupData = this.getGifBackup();
		if (!backupData || backupData._state.favorites.length == 0) {
			// and no favorites
			const favorites = this.gifstore.getFavorites();
			if (favorites.length > 0) {
				this.backupGifs();
			}
		}
	}

	// arrow function because we use backupGifs outside the class, where `this` changes, and arrow functions always have the same `this`
	backupGifs = () => {
		const data = {
			_state: this.gifstore.getState(),
			_version: this.gifstore._version
		}
		const userID = this.getTargetUserID();
		PluginUtilities.saveData(this.getName(), userID, data);
	}

	getGifBackup() {
		const userID = this.getTargetUserID();
		return PluginUtilities.loadData(this.getName(), userID, []);
	}

	restoreGifs = () => {
		const store = this.getGifBackup();
		this.storage.impl.set("GIFFavoritesStore", store);
		this.gifstore.initialize(store._state);
	}

	getTargetUserID() {
		return this.settings.shareFavorites ? -1 : UserStore.getCurrentUser().id;
	}

	};
	};
	
	return plugin(Plugin, Api);
	})(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/
