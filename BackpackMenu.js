/// <reference path='d:/dts/dts/helperlib/src/index.d.ts'/> 
/// <reference path='BackpackMenu.d.ts'/>
/// <reference path='../GMLIB-LegacyRemoteCallApi/lib/BEPlaceholderAPI-JS.d.ts'/> 
/// <reference path='../GMLIB-LegacyRemoteCallApi/lib/EventAPI-JS.d.ts'/>
/// <reference path='../GMLIB-LegacyRemoteCallApi/lib/GMLIB_API-JS.d.ts'/>

File.getFilesList(`./plugins/GMLIB-LegacyRemoteCallApi/lib/`).filter(name => name.endsWith('.js')).forEach(path => {
    Object.entries(require(`./GMLIB-LegacyRemoteCallApi/lib/${path}`)).forEach(([name, value]) => this[name] = value);
});

/** 全局变量 */
const global = {
    /** 配置 */
    config: {
        /** 防刷屏缓存清理时间 */
        logTempCleanTime: 1000 * 10,
        /** 报错美化 */
        errorBeautify: true,
    },
    /** 防刷屏缓存 */
    logTemp: [],
    /** 插件目录 */
    pluginDir: `./plugins/BackpackMenu`,
    /** 占位物品 */
    placeholderItem: {},
    /** 打开菜单数据 */
    openMenuData: {},
    /** 物品缓存 */
    itemCache: {},
};

i18n.load(`${global.pluginDir}/lang`); // 加载语言包

/** 转字符串 @type {function(any): string} */
const toString = msg => {
    try {
        if (typeof (msg) == "string") return msg;
        if (msg instanceof Error) return global.config.errorBeautify
            ? `§e${msg.name}§6: §4${msg.message}\n${msg.stack
                .replace(/at /g, "§eat §d")
                .replace(/\(/g, "§c(§b")
                .replace(/\)/g, "§c)§r")
            }`
            : `${msg.name}: ${msg.message}\n${msg.stack}`;
        if (Array.isArray(msg)) return msg.map(toString).join("");
        if (msg?.toSNBT != undefined) return msg.toSNBT(4);
        if (Object.prototype.toString.call(msg) === "[object Object]") return JSON.stringify(msg, null, 4);
        if (msg?.toString != undefined) return msg.toString();
    } catch (error) { logger.error(error); }
    return "";
};

// 替换日志输出
(function ReplaceLog() {
    /** 原输出函数 @type {Object.<string, function(...any): void>} */
    const originLog = {};

    ["log", "debug", "info", "warn", "error", "fatal"].forEach(name => {
        originLog[name] = logger[name];
        logger[name] = (...args) => {
            try {
                args = args.map(toString);
                let msg = i18n.tr(args[0], ...args.slice(1)).trim();
                if (msg === args[0]) msg = args.map(str => i18n.tr(str)).join(" ").trim();
                if (
                    msg === "" ||
                    global.logTemp.includes(msg)
                ) return;
                if (typeof global.config.logTempCleanTime === "number" && global.config.logTempCleanTime > 0) global.logTemp.push(msg);
                setTimeout(() => {
                    global.logTemp.splice(global.logTemp.indexOf(msg), 1);
                }, typeof global.config.logTempCleanTime === "number" ? global.config.logTempCleanTime : 1000 * 10);
                msg.split("\n").forEach(line => originLog[name](line));
            } catch (error) { originLog.error(error); }
        };
    });

    log = logger.log;
})();

// 加载配置文件
(function loadConfig() {
    const configPath = `${global.pluginDir}/config/config.json`;
    try {
        logger.debug("Loading configuration file...");
        if (!File.exists(configPath) || File.checkIsDir(configPath)) throw new Error("Configuration file not found.");
        const config = JSON.parse(File.readFrom(configPath));
        Object.entries(config).forEach(([key, value]) => {
            do {
                if (!global.config[key]) continue;
                if (Object.prototype.toString.call(global.config[key]) !== Object.prototype.toString.call(value)) continue;
                return global.config[key] = value;
            } while (false);
            logger.error("Invalid configuration {0}.", key);
        });
    } catch (error) {
        if (File.exists(configPath)) File.rename(configPath, `${configPath}.bak`); // 备份
        logger.error("Failed to load configuration file.\n{0}", error);
    }
    try {
        File.writeTo(configPath, JSON.stringify(global.config, null, 4));
    } catch (error) {
        logger.error("Failed to save configuration file.\n{0}", error);
    }
})();

function spawnItem(data = {}) {
    if (data instanceof LLSE_Item) return data;
    if (global.itemCache[toString(data)]) return global.itemCache[toString(data)];

    const nbt = new NbtCompound({
        "Name": new NbtString(data?.type ?? ""),
        "Count": new NbtByte(data?.amount ?? 1),
        "tag": new NbtCompound({
            "display": new NbtCompound({
                "Name": new NbtString(toString(data?.displayName ?? "")),
                "Lore": new NbtList(data?.lores?.map(lore => new NbtString(toString(lore))) ?? [])
            })
        })
    });

    if (data["enchants"] !== undefined) {
        nbt.getTag("tag").setTag("ench", new NbtList(
            data.enchants.map(enchant => new NbtCompound({
                "id": new NbtShort(enchant.id),
                "lvl": new NbtShort(enchant.lvl)
            }))
        ));
    }

    return global.itemCache[toString(data)] = mc.newItem(nbt);
}

function BackpackMenu(player, callback) {
    const menu = global.openMenuData[player.uuid] ??= new (class {
        /** @type {string} */
        #mUuid;
        /** @type {boolean} */
        #mIsOpen = false;
        /** @type {function(any, player, number): void} */
        #mCallback = undefined;
        /** @type {{ slot: number, item: Item, callback: function(any, player): void}[]} */
        #mButtons = [];

        constructor(player) {
            this.#mUuid = player.uuid;
        }

        setCallback(...args) {
            switch (args.length) {
                case 1: {
                    if (typeof args[0] !== "function") throw new Error("Invalid arguments.");
                    this.#mCallback = args[0];
                    break;
                }
                case 2: {
                    if (typeof args[0] !== "number" || typeof args[1] !== "function") throw new Error("Invalid arguments.");
                    this.getSlot(args[0]).callback = args[1];
                    break;
                }
                default: throw new Error("Invalid arguments.");
            }
            return this;
        }

        getSlot(slot) {
            const result = this.#mButtons.find(button => button.slot === slot);
            if (result) return result;
            this.#mButtons.push({
                slot: slot,
                item: spawnItem(global.placeholderItem),
                callback: undefined
            });
            return this.getSlot(slot);
        }

        setButton(slot, item, callback) {
            item = spawnItem(item);

            this.getSlot(slot).item = item;
            this.getSlot(slot).callback = callback;

            if (this.isOpen()) this.#updateButton(slot, item);

            return this;
        }

        #updateButton(slot, item) {
            const bs = new GMLIB_BinaryStream();
            bs.writePacketHeader(/* MinecraftPacketIds::InventorySlot */0x32);
            bs.writeUnsignedVarInt(0);
            bs.writeUnsignedVarInt(slot);
            bs.writeItem(item);
            bs.sendTo(mc.getPlayer(this.#mUuid));
            return this;
        }

        #updateAllButton() {
            const bs = new GMLIB_BinaryStream();
            bs.writePacketHeader(/* MinecraftPacketIds::InventoryContent */0x31);
            bs.writeUnsignedVarInt(0);
            bs.writeUnsignedVarInt(36);
            for (let i = 0; i < 36; i++) {
                bs.writeItem(this.getSlot(i).item);
            }
            bs.sendTo(mc.getPlayer(this.#mUuid));
            return this;
        }

        open() {
            if (this.isOpen()) return this;
            this.#mIsOpen = true;

            const bs = new GMLIB_BinaryStream();
            bs.writePacketHeader(/* MinecraftPacketIds::ContainerOpen */0x2E);
            bs.writeByte(/* ContainerID::Inventory */0);
            bs.writeByte(/* ContainerType::Inventory */-1);
            bs.writeBlockPos(mc.getPlayer(this.#mUuid).blockPos);
            bs.writeVarInt64(-1);
            bs.sendTo(mc.getPlayer(this.#mUuid));

            setTimeout(() => this.#updateAllButton(), 100);
            return this;
        }

        close(isClient = false) {
            if (!this.isOpen()) return this;
            this.#mIsOpen = false;

            const sendSetGameTypePacket = (player, gameType) => {
                const bs = new GMLIB_BinaryStream();
                bs.writePacketHeader(/* MinecraftPacketIds::SetPlayerGameType */0x3e);
                bs.writeVarInt(gameType);
                bs.sendTo(player);
            };
            const sendUpdateAbilitesPacket = (player) => {
                player.setAbility(/* AbilitiesIndex::Teleport */0x7, Boolean(player.getAbilities().teleport));
            };

            const player = mc.getPlayer(this.#mUuid);

            if (!isClient && !player.isGliding) {
                sendSetGameTypePacket(player, 6);
                setTimeout(() => {
                    sendSetGameTypePacket(player,player.gameMode);
                    sendUpdateAbilitesPacket(player);
                }, 1);
            }

            this.#mButtons = [];
            player.refreshItems();
            return this;
        }

        isOpen() {
            return this.#mIsOpen;
        }

        getPlayer() {
            return mc.getPlayer(this.#mUuid);
        }

        callback(slot) {
            (this.getSlot(slot).callback ?? this.#mCallback)?.(this, mc.getPlayer(this.#mUuid), slot);
            return this;
        }

        clear() {
            this.#mButtons = [];
            this.#updateAllButton();
            return this;
        }
    })(player);
    if (callback) menu.setCallback(callback);
    return menu;
}

Event.listen(
    "onHandleRequestAction",
    (
        player,
        _actionType,
        _amount,
        containerType,
        slot
    ) => {
        if (containerType !== 'HotbarContainer' && containerType !== 'InventoryContainer') return;
        if (!global.openMenuData?.[player.uuid]?.isOpen()) return;
        global.openMenuData[player.uuid].callback(slot);
        return false;
    }
);

Event.listen("onSendContainerClosePacket", (player) => {
    global.openMenuData?.[player.uuid]?.close(true);
});

mc.listen("onJoin", player => {
    global.openMenuData?.[player.uuid]?.close(true);
});

module.exports = {
    BackpackMenu,
    spawnItem
}

// 测试代码

mc.listen("onUseItem", function (pl, item) {
    if (item.type === "minecraft:iron_ingot") {
        setTimeout( () => mainMenu(pl), 100);
    }
});


function mainMenu(player) {

    const menu = BackpackMenu(player);

    menu.setButton(13, {
        type: "minecraft:bedrock",
        displayName: "§r§d选一个吧, 年轻人",
        enchants: []
    });

    menu.setButton(21, {
        type: "minecraft:golden_apple"
    }, (menu, player) => {
        menu.close();
        player.giveItem(mc.newItem("minecraft:golden_apple", 1));
    });

    menu.setButton(23, {
        type: "minecraft:enchanted_golden_apple"
    }, (menu, player) => {
        menu.close();
        player.giveItem(mc.newItem("minecraft:enchanted_golden_apple", 1));
    });

    menu.setButton(8, {
        type: "minecraft:deny",
        displayName: "§r§c退出"
    }, (menu) => menu.close());

    menu.open();
}