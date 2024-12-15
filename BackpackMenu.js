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
// (function ReplaceLog() {
//     /** 原输出函数 @type {Object.<string, function(...any): void>} */
//     const originLog = {};

//     ["log", "debug", "info", "warn", "error", "fatal"].forEach(name => {
//         originLog[name] = logger[name];
//         logger[name] = (...args) => {
//             try {
//                 args = args.map(msgToString);
//                 let msg = i18n.tr(args[0], ...args.slice(1)).trim();
//                 if (msg === args[0]) msg = args.map(str => i18n.tr(str)).join(" ").trim();
//                 if (
//                     msg === "" ||
//                     global.logTemp.includes(msg)
//                 ) return;
//                 global.logTemp.push(msg);
//                 setTimeout(() => {
//                     global.logTemp.splice(global.logTemp.indexOf(msg), 1);
//                 }, typeof global.config.logTempCleanTime === "number" ? global.config.logTempCleanTime : 1000 * 10);
//                 msg.split("\n").forEach(line => originLog[name](line));
//             } catch (error) { originLog.error(error); }
//         };
//     });

//     log = logger.log;
// })();

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



/**
 * 发送打开背包数据包
 * @param {Player} player
 */
const openInventory = player => {
    const bs = new GMLIB_BinaryStream();
    bs.writePacketHeader(/* MinecraftPacketIds::ContainerOpen */0x2E); // Packet Header
    bs.writeByte(/* ContainerID::Inventory */0); // Container ID
    bs.writeByte(/* ContainerType::Inventory */-1); // Container Type
    bs.writeBlockPos(player.blockPos); // Container Position
    bs.writeVarInt64(-1); // Container Entity ID
    bs.sendTo(player);
};

/**
 * 发送关闭背包数据包
 * @param {Player} player
 */
const closeInventory = player => {
    
    const mode = player.gameMode;
    let bs = new GMLIB_BinaryStream();
    bs.writePacketHeader(/* MinecraftPacketIds::SetPlayerGameType */0x3e);
    bs.writeVarInt(6); // Game Mode
    bs.sendTo(player);

    setTimeout(()=>{
        bs = new GMLIB_BinaryStream();
        bs.writePacketHeader(/* MinecraftPacketIds::SetPlayerGameType */0x3e);
        bs.writeVarInt(mode); // Game Mode
        bs.sendTo(player);
    },1);

    // const bs = new GMLIB_BinaryStream();
    // bs.writePacketHeader(/* MinecraftPacketIds::ContainerClose */0x2F); // Packet Header
    // bs.writeByte(/* ContainerID::Inventory */0); // Container ID
    // bs.writeByte(/* ContainerType::Inventory */-1); // Container Type
    // bs.writeBool(true); // Server Initiated Close
    // bs.sendTo(player);
    // log('已发送关闭背包数据包')
};

/**
 * 更新背包物品
 * @param {Player} player
 * @param {number} slot
 * @param {Item} item
 */
const updateItem = (player, slot, item) => {
    const bs = new GMLIB_BinaryStream();
    bs.writePacketHeader(/* MinecraftPacketIds::InventorySlot */0x32); // Packet Header
    bs.writeUnsignedVarInt(0); // Container ID
    bs.writeUnsignedVarInt(slot); // Slot ID
    bs.writeItem(item); // Item
    bs.sendTo(player);
};


const allMenu = {};

// 事件：操作菜单
Event.listen("onHandleRequestAction", (player, actionType, count, sourceContainerNetId, sourceSlot) => {
    //log('物品操作类型: ', actionType, ' 操作数量:', count, ' 容器类型:', sourceContainerNetId, ' 槽位:', sourceSlot)
    if (sourceContainerNetId != 'HotbarContainer' && sourceContainerNetId != 'InventoryContainer'){return;}
    if (allMenu[player.uuid] == undefined){return;}
    
    let playerMenu = allMenu[player.uuid];
    let callback = playerMenu.buttons[sourceSlot].callback;
    if (playerMenu.buttons[sourceSlot].sound){
        mc.runcmdEx(`playsound ${playerMenu.buttons[sourceSlot].sound} ${player.realName}`);
    }
    if (playerMenu.buttons[sourceSlot].isLastButton){
        playerMenu.close();
    }else{
        if (playerMenu.buttons[sourceSlot].isAutoClear){
            playerMenu.clear();
        }
    }
    callback ? callback(player) : undefined;
});

// 事件：关闭菜单
Event.listen("onSendContainerClosePacket", (player)=>{
    if (allMenu[player.uuid] == undefined){return;}
    player.refreshItems();
    delete allMenu[player.uuid];
});



class BackpackMenu {
    constructor(player){
        this.player = player;
        this.buttons = {};
        this.buttonDefault = {}; // 默认按钮设置
        this.#init();
        allMenu[player.uuid] = this;
    }

    /**
     * @description: 打开并清空菜单
     * @return {*}
     */    
    #init(){
        openInventory(this.player);
        this.clear();
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
     * @param {boolean} [args.isEnchanted] 是否附魔
     * @param {string} [args.sound] 按钮音效
     * @param {function} [args.callback] 按钮回调函数
     * @param {boolean} [args.isAutoClear] 按下按钮后是否自动清空菜单
     * @param {boolean} [args.isLastButton] 是否是最后一个按钮(点击此按钮后菜单关闭)
     * @return {*}
     */    
    updateButton({slot, item, type, count, displayName, loreNames, isEnchanted, sound, callback, isAutoClear, isLastButton}){
        type = type ?? (this.buttonDefault.type ?? "minecraft:air");
        count = count ?? (this.buttonDefault.count ?? 1);
        displayName = displayName ?? this.buttonDefault.displayName;
        loreNames = loreNames ?? this.buttonDefault.loreNames;
        isEnchanted = isEnchanted ?? this.buttonDefault.isEnchanted;
        sound = sound ?? this.buttonDefault.sound;
        callback = callback ?? this.buttonDefault.callback;
        isAutoClear = isLastButton ?? (this.buttonDefault.isAutoClear?? true);
        isLastButton = isLastButton ?? this.buttonDefault.isLastButton;
        item = item ?? (this.buttonDefault.item ?? mc.newItem(type, count));

        if (displayName){
            item.setDisplayName(displayName);
        }
        if (loreNames){
            item.setLore(loreNames);
        }
        if (isEnchanted){
            item.setNbt(item.getNbt().setTag("tag", item.getNbt().getTag("tag").setTag("ench", new NbtList([]))));
        }
        this.buttons[slot] = {item: item, sound: sound, callback: callback, isAutoClear:isAutoClear, isLastButton:isLastButton};
        updateItem(this.player, slot, item);
    }

    /**
     * @description: 清空菜单
     * @return {*}
     */    
    clear(){
        this.buttonDefault = {}; // 清空已设定的默认值
        for (let slot = 0; slot < 36; slot++){
            this.updateButton({slot: slot, type: "minecraft:air"});
        }
    }

    /**
     * @description: 关闭菜单
     * @return {*}
     */   
    close(){
        closeInventory(this.player);
        delete allMenu[this.player.uuid];
        this.player.refreshItems();
    }
}

const newBackpackMenu = (player)=>{
    return allMenu[player.uuid] ?? new BackpackMenu(player);
};










//=========================================
//=========================================
// 测试 在其他插件中还是需要require调用

let tmp = {};
mc.listen("onUseItemOn",function(pl, item){
    if (pl.isSimulatedPlayer()){return;}
    if (tmp[pl.xuid]!=null){return;}
    tmp[pl.xuid] = true;
    setTimeout(()=>{
        delete tmp[pl.xuid];
    }, 300);

    if (item.type == "minecraft:iron_ingot") {
        setTimeout(()=>{
            mainMenu(pl);
        },50); // 延迟以防止原版MC自动刷新物品栏
        return false;
    }
});

function mainMenu(pl){
    let playerMenu = newBackpackMenu(pl);
    playerMenu.buttonDefault.type = "minecraft:diamond"; // 设置默认物品类型
    playerMenu.buttonDefault.sound = "bottle.fill"; // 设置默认按钮音效
    playerMenu.updateButton({
        slot: 0, 
        displayName: "§e按钮0",
        callback: (pl)=>{
            log(`按下按钮 0`);
            subMenu(pl);
        }
    });

    playerMenu.updateButton({
        slot: 1, 
        count: 2,
        displayName: "§a按钮1",
        isEnchanted: true,
        callback: (pl)=>{
            log(`按下按钮 1`);
            subMenu(pl);
        }
    });
    playerMenu.updateButton({
        slot: 2, 
        count: 4,
        displayName: "按钮2",
        loreNames: ["§b我是按钮2", "§d传说品质"],
        callback: (pl)=>{
            log(`按下按钮 2`);
            subMenu(pl);
        }
    });
    playerMenu.updateButton({
        slot: 17, 
        type: "minecraft:barrier", 
        displayName: "关闭",
        sound: "bottle.empty",
        callback: (pl)=>{log(`按钮关闭菜单`);},
        isLastButton: true,
    });
}

function subMenu(pl){
    let playerMenu = newBackpackMenu(pl);
    playerMenu.updateButton({
        slot: 20,
        type: "minecraft:redstone", 
        displayName: "§e功能0",
        sound: "beacon.activate",
        callback: (pl)=>{pl.tell(`功能 0`);},
        isLastButton: true
    });
    playerMenu.updateButton({
        slot: 22,
        type: "minecraft:redstone", 
        displayName: "§a功能1",
        isEnchanted: true,
        sound: "beacon.activate",
        callback: (pl)=>{pl.tell(`功能 1`);},
        isLastButton: true
    });
    playerMenu.updateButton({
        slot: 24,
        type: "minecraft:redstone", 
        displayName: "§a功能2",
        loreNames: ["§b功能2", "§d传说品质"],
        sound: "beacon.activate",
        callback: (pl)=>{pl.tell(`功能 2`);},
        isLastButton: true
    });
    playerMenu.updateButton({
        slot: 17,
        type: "minecraft:compass", 
        displayName: "返回",
        sound: "block.itemframe.remove_item",
        callback: (pl)=>{
            log(`返回`);
            mainMenu(pl);
        }
    });
}
