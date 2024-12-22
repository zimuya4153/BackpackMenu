/// <reference path='d:/dts/dts/helperlib/src/index.d.ts'/> 
/// <reference path='main.d.ts'/>
/// <reference path='../../GMLIB-LegacyRemoteCallApi/lib/BEPlaceholderAPI-JS.d.ts'/> 
/// <reference path='../../GMLIB-LegacyRemoteCallApi/lib/EventAPI-JS.d.ts'/>
/// <reference path='../../GMLIB-LegacyRemoteCallApi/lib/GMLIB_API-JS.d.ts'/>

// File.getFilesList(`./plugins/GMLIB-LegacyRemoteCallApi/lib/`).filter(name => name.endsWith('.js')).forEach(path => {
//     Object.entries(require(`../GMLIB-LegacyRemoteCallApi/lib/${path}`)).forEach(([name, value]) => this[name] = value);
// });
const { Event } = require(`../GMLIB-LegacyRemoteCallApi/lib/EventAPI-JS.js`);
const { GMLIB_BinaryStream } = require(`../GMLIB-LegacyRemoteCallApi/lib/GMLIB_API-JS.js`);

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
    /** 物品缓存 */
    itemCache: {air: mc.newItem("minecraft:air", 1)},
    /** 所有菜单实例 */
    allMenus: {},
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
// (function ReplaceLog() {
//     /** 原输出函数 @type {Object.<string, function(...any): void>} */
//     const originLog = {};

//     ["log", "debug", "info", "warn", "error", "fatal"].forEach(name => {
//         originLog[name] = logger[name];
//         logger[name] = (...args) => {
//             try {
//                 args = args.map(toString);
//                 let msg = i18n.tr(args[0], ...args.slice(1)).trim();
//                 if (msg === args[0]) msg = args.map(str => i18n.tr(str)).join(" ").trim();
//                 if (
//                     msg === "" ||
//                     global.logTemp.includes(msg)
//                 ) return;
//                 if (typeof global.config.logTempCleanTime === "number" && global.config.logTempCleanTime > 0) global.logTemp.push(msg);
//                 setTimeout(() => {
//                     global.logTemp.splice(global.logTemp.indexOf(msg), 1);
//                 }, typeof global.config.logTempCleanTime === "number" ? global.config.logTempCleanTime : 1000 * 10);
//                 msg.split("\n").forEach(line => originLog[name](line));
//             } catch (error) { originLog.error(error); }
//         };
//     });

//     log = logger.log;
// })();

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


// 事件: 操作菜单
Event.listen("onHandleRequestAction", (player, actionType, count, sourceContainerNetId, sourceSlot) => {
    //log('物品操作类型: ', actionType, ' 操作数量:', count, ' 容器类型:', sourceContainerNetId, ' 槽位:', sourceSlot)
    if (sourceContainerNetId != 'HotbarContainer' && sourceContainerNetId != 'InventoryContainer'){return;}
    if (global.allMenus[player.uuid] == undefined){return;}
    
    let playerMenu = global.allMenus[player.uuid];
    let callback = playerMenu.getButton(sourceSlot).callback;
    // 按钮音效
    if (playerMenu.getButton(sourceSlot).sound){
        mc.runcmdEx(`playsound ${playerMenu.getButton(sourceSlot).sound} ${player.realName}`);
    }
    // 点击按钮自动清空菜单
    if (playerMenu.getButton(sourceSlot).isAutoClear){
        playerMenu.clear();
    }
    // 执行按钮回调
    callback ? callback(player) : undefined;
    return false;
});

// 事件: 关闭菜单
Event.listen("onSendContainerClosePacket", (player)=>{
    if (global.allMenus[player.uuid] == undefined){return;}
    player.refreshItems();
    delete global.allMenus[player.uuid];
});

// 类: 背包菜单
function BackpackMenu(player){
    if (player == null){return;}
    return global.allMenus[player.uuid] ?? new (class{
        #mUuid;
        #mButtons = Array(36).fill({item: global.itemCache['air']});
    
        constructor(player){
            this.#mUuid = player.uuid;
            //mc.getPlayer(this.#mUuid) = player;
            this.buttonDefault = {}; // 默认按钮设置
            this.#open();
            global.allMenus[player.uuid] = this;
        }
    
        /**
         * @description: 打开菜单
         * @return {*}
         */    
        #open(){
            const bs = new GMLIB_BinaryStream();
            bs.writePacketHeader(/* MinecraftPacketIds::ContainerOpen */0x2E); // Packet Header
            bs.writeByte(/* ContainerID::Inventory */0); // Container ID
            bs.writeByte(/* ContainerType::Inventory */-1); // Container Type
            bs.writeBlockPos(mc.getPlayer(this.#mUuid).blockPos); // Container Position
            bs.writeVarInt64(-1); // Container Entity ID
            bs.sendTo(mc.getPlayer(this.#mUuid));
            //this.clear();
        } 
    
        /**
         * @description: 获取按钮配置
         * @param {number} slot 物品栏槽位
         * @return {*}
         */    
        getButton(slot){
            return this.#mButtons[slot];
        }
    
        /**
         * @description: 更新按钮
         * @param {object} args
         * @param {number} args.slot 物品栏槽位
         * @param {item} [args.item] 物品对象
         * @param {string} [args.type] 物品类型
         * @param {number} [args.count] 堆叠数量
         * @param {string} [args.displayName] 物品名称 
         * @param {Array.<string>} [args.loreNames] 物品lore
         * @param {Array} [args.enchants] 附魔表
         * @param {string} [args.sound] 按钮音效
         * @param {boolean} [args.isAutoClear] 按下按钮后是否自动清空菜单
         * @param {function} [callback] 按钮回调函数
         * @return {*}
         */    
        setButton({slot, item, type, count, displayName, loreNames, enchants, sound, isAutoClear}, callback){
            
            type ??= this.buttonDefault.type ?? "minecraft:air";
            count ??= this.buttonDefault.count ?? 1;
            displayName ??= this.buttonDefault.displayName ?? "";
            loreNames ??=  this.buttonDefault.loreNames ?? [];
            enchants ??= this.buttonDefault.enchants;
    
            sound = sound ?? this.buttonDefault.sound;
            isAutoClear = isAutoClear ?? (this.buttonDefault.isAutoClear?? true);
            callback = callback ?? this.buttonDefault.callback;
            if (item == undefined){
                const nbt = new NbtCompound({
                    "Name": new NbtString(type),
                    "Count": new NbtByte(count),
                    "tag": new NbtCompound({
                        "display": new NbtCompound({
                            "Name": new NbtString(displayName),
                            "Lore": new NbtList(loreNames.map(lore => new NbtString(lore)))
                        })
                    })
                });
                if (enchants !== undefined) {
                    nbt.getTag("tag").setTag("ench", new NbtList(
                        enchants.map(enchant => new NbtCompound({
                            "id": new NbtShort(enchant.id),
                            "lvl": new NbtShort(enchant.lvl)
                        }))
                    ));
                }
                item = mc.newItem(nbt);
                //return global.itemCache[toString(data)] = mc.newItem(nbt);
            }
            //item = item ?? (this.buttonDefault.item ?? mc.newItem(type, count));
            this.#mButtons[slot] = {item: item, sound: sound, isAutoClear:isAutoClear, callback: callback};
        }
    
        /**
         * @description: 实时更新按钮图标
         * @param {number} slot 物品栏槽位
         * @param {item} item 物品对象
         * @return {*}
         */    
        updateButton(slot, item){
            const bs = new GMLIB_BinaryStream();
            bs.writePacketHeader(/* MinecraftPacketIds::InventorySlot */0x32); // Packet Header
            bs.writeUnsignedVarInt(0); // Container ID
            bs.writeUnsignedVarInt(slot); // Slot ID
            bs.writeItem(item); // Item
            bs.sendTo(mc.getPlayer(this.#mUuid));
        }
    
        /**
         * @description: 刷新所有按钮
         * @return {*}
         */    
        updateAllButtons(){
            const bs = new GMLIB_BinaryStream();
            bs.writePacketHeader(/* MinecraftPacketIds::InventoryContent */0x31);
            bs.writeUnsignedVarInt(0);
            bs.writeUnsignedVarInt(36);
            for (let i = 0; i < 36; i++) {
                bs.writeItem(this.#mButtons[i].item);
            }
            bs.sendTo(mc.getPlayer(this.#mUuid));
        }
        
        /**
         * @description: 清空菜单
         * @return {*}
         */    
        clear(){
            this.buttonDefault = {}; // 清空已设定的默认值
            this.#mButtons = Array(36).fill({item: global.itemCache['air']});
            this.updateAllButtons();
        }
    
        /**
         * @description: 关闭菜单
         * @return {*}
         */   
        close(){
            const player = mc.getPlayer(this.#mUuid);
            const sendSetGameTypePacket = (player, gameType) => {
                const bs = new GMLIB_BinaryStream();
                bs.writePacketHeader(/* MinecraftPacketIds::SetPlayerGameType */0x3e);
                bs.writeVarInt(gameType);
                bs.sendTo(player);
            };
            const sendUpdateAbilitesPacket = (player) => {
                player.setAbility(/* AbilitiesIndex::Teleport */0x7, Boolean(player.getAbilities().teleport));
            };
    
    
            if (player != null && !player.isGliding) {
                const gamemode = player.gameMode;
                sendSetGameTypePacket(player, 6);
                setTimeout(() => {
                    sendSetGameTypePacket(player, gamemode);
                    sendUpdateAbilitesPacket(player);
                }, 1);
            }
            delete global.allMenus[this.#mUuid];
            mc.getPlayer(this.#mUuid)?.refreshItems();
        }
    })(player);
}


module.exports = {
    BackpackMenu
};
