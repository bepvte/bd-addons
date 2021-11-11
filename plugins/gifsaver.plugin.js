/**
 * @name GifSaver
 * @version 2.0.0
 * @description Feel free to delete, remainder of gifsaver
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
			version: "2.0.0",
			description: "Feel free to delete, remainder of gifsaver",
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
			title: "Network GIF backup is now part of discord!!",
			items: ["GIFSaver will no longer function due to these changes being part of discord",
                    "There is unfortunately now a 250 gif limit, which might have hidden some of your gifs",
                    "Because of this, I have exported your last Gif Backup to your plugins folder as `gifs_export.html`",
                    "Restart discord for this to work."]
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

	return class GifSaver extends Plugin {

	// When the plugin starts
	onStart() {
        const path = require("path");
        const fs = require("fs");
        const loc = path.resolve(BdApi.Plugins.folder, "gifsaver.config.json");
        const data = JSON.parse(fs.readFileSync(loc));
        let outbuf = `<!doctype html>
<title>Gif export</title>
<body>
`;
        for (const x in data) {
            if (x === "default") {
                outbuf += "<h3>The main users gifs:</h3>\n<ul>\n";
                for (const y of data["default"]) {
                    outbuf += `<li><a href="${y.url}">${y.url}</a>\n<br/>`;
                    if (y.format === "VIDEO") {
                        outbuf += `<video controls loop autoplay muted src="${y.src}"></video>`;
                    } else {
                        outbuf += `<img src="${y.src}"/>`;
                    }
                    outbuf += `</li>`;
                }
                outbuf += "</ul>\n";
            }
            if (!isNaN(x)) {
                outbuf += `<h3>The gifs of user ${x}:</h3>\n<ul>\n`;
                for (const y of data[x]) {
                    outbuf += `<li><a href="${y.url}">${y.url}</a>\n<br/>`;
                    if (y.format === "VIDEO") {
                        outbuf += `<video controls loop autoplay muted src="${y.src}"></video>`;
                    } else {
                        outbuf += `<img src="${y.src}"/>`;
                    }
                    outbuf += `</li>`;
                }
                outbuf += "</ul>\n";
            }
        }
        outbuf += "</body>";
        const outpath = path.resolve(BdApi.Plugins.folder, "gifs_export.html");
        fs.writeFileSync(outpath, outbuf);

        BdApi.showConfirmationModal("GIF backup exported", "Your gif backup has been exported safely. Do you want to open it in your browser?\nTo disable this notice, disable or remove GifSaver.",
                                    {confirmText: "Open", cancelText: "Cancel",
                                     onConfirm: () => {
										 const shell = require("electron").shell;
										 const open = shell.openItem || shell.openPath;
										 open(outpath);
                                     }});

		// Dispatcher.subscribe(ActionTypes.CONNECTION_OPEN, this.initialize); // Recover favorites after login
	}

	};
	};
	
	return plugin(Plugin, Api);
	})(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/
