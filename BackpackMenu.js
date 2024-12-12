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
};

const sendTextType = Object.freeze({
    /** 原始消息 */
    Raw: 0x0,
    /** 聊天消息 */
    Chat: 0x1,
    /** 翻译消息 */
    Translate: 0x2,
    /** 弹出消息 */
    Popup: 0x3,
    /** 唱片机消息 */
    JukeboxPopup: 0x4,
    /** 提示消息 */
    Tip: 0x5,
    /** 系统消息 */
    SystemMessage: 0x6,
    Whisper: 0x7,
    /** 公告消息 */
    Announcement: 0x8,
    TextObjectWhisper: 0x9,
    TextObject: 0xA,
    TextObjectAnnouncement: 0xB,
});

i18n.load(`${global.pluginDir}/lang`); // 加载语言包

/** 消息转字符串 @type {function(any): string} */
const msgToString = msg => {
    try {
        if (typeof (msg) == "string") return msg;
        if (msg instanceof Error) return global.config.errorBeautify
            ? `§e${msg.name}§6: §4${msg.message}\n${msg.stack
                .replace(/at /g, "§eat §d")
                .replace(/\(/g, "§c(§b")
                .replace(/\)/g, "§c)§r")
            }`
            : `${msg.name}: ${msg.message}\n${msg.stack}`;
        if (msg instanceof Array) return msg.map(msgToString).join("");
        if (msg?.toSNBT != undefined) return msg.toSNBT(4);
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
                args = args.map(msgToString);
                let msg = i18n.tr(args[0], ...args.slice(1)).trim();
                if (msg === args[0]) msg = args.map(str => i18n.tr(str)).join(" ").trim();
                if (
                    msg === "" ||
                    global.logTemp.includes(msg)
                ) return;
                global.logTemp.push(msg);
                setTimeout(() => {
                    global.logTemp.splice(global.logTemp.indexOf(msg), 1);
                }, typeof global.config.logTempCleanTime === "number" ? global.config.logTempCleanTime : 1000 * 10);
                msg.split("\n").forEach(line => originLog[name](line));
            } catch (error) { originLog.error(error); }
        };
    });

    log = logger.log;
})();

// 替换发送信息
(function ReplaceSendMsg() {
    LLSE_Player.prototype.tell = LLSE_Player.prototype.sendText = function (key, type = 0, ...args) {
        try {
            let msg = i18n.trl(this.langCode, msgToString(key), ...args.map(msgToString));
            if (msg !== msgToString(key)) args = []; // 如果有翻译则不传参数
            // logger.debug("{0} {1}", msg, args);
            const bs = new GMLIB_BinaryStream();
            bs.writePacketHeader(/* MinecraftPacketIds::Text */0x9);
            bs.writeByte(args.length && type == 0 ? 2 : type);
            bs.writeBool(true);
            bs.writeString(msg);
            if ([0, 2, 3, 4].includes(type) && args.length) {
                bs.writeUnsignedVarInt(args.length);
                args.forEach(arg => bs.writeString(msgToString(arg)));
            }
            bs.writeString("");
            bs.writeString("");
            bs.writeString("");
            bs.sendTo(this);
        } catch (error) {
            logger.error("Failed to send message. Player: {0}\n{1}", this.realName, error);
        }
    };
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














// 以下为发包示例


// /**
//  * 发送打开背包数据包
//  * @param {Player} player
//  */
// const openInventory = player => {
//     const bs = new GMLIB_BinaryStream();
//     bs.writePacketHeader(/* MinecraftPacketIds::ContainerOpen */0x2E); // Packet Header
//     bs.writeByte(/* ContainerID::Inventory */0); // Container ID
//     bs.writeByte(/* ContainerType::Inventory */-1); // Container Type
//     bs.writeBlockPos(player.blockPos); // Container Position
//     bs.writeVarInt64(-1); // Container Entity ID
//     bs.sendTo(player);
// };

// /**
//  * 发送关闭背包数据包
//  * @param {Player} player
//  */
// const closeInventory = player => {
//     const bs = new GMLIB_BinaryStream();
//     bs.writePacketHeader(/* MinecraftPacketIds::ContainerClose */0x2F); // Packet Header
//     bs.writeByte(/* ContainerID::Inventory */0); // Container ID
//     bs.writeByte(/* ContainerType::Inventory */-1); // Container Type
//     bs.writeBool(true); // Server Initiated Close
//     bs.sendTo(player);
// };

// /**
//  * 更新背包物品
//  * @param {Player} player
//  * @param {number} slot
//  * @param {Item} item
//  */
// const updateItem = (player, slot, item) => {
//     const bs = new GMLIB_BinaryStream();
//     bs.writePacketHeader(/* MinecraftPacketIds::InventorySlot */0x32); // Packet Header
//     bs.writeUnsignedVarInt(0); // Container ID
//     bs.writeUnsignedVarInt(slot); // Slot ID
//     bs.writeItem(item); // Item
//     bs.sendTo(player);
// }