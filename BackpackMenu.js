
// 导入按钮菜单框架
let BackpackMenu;
mc.listen("onServerStarted", ()=>{
    BackpackMenu = require("..\\BackpackMenu\\framework\\main.js").BackpackMenu;
});


// 菜单测试
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
    let playerMenu = BackpackMenu(pl);
    playerMenu.buttonDefault.type = "minecraft:diamond"; // 设置默认物品类型
    playerMenu.buttonDefault.sound = "bottle.fill"; // 设置默认按钮音效
    playerMenu.setButton({
        slot: 0, 
        displayName: "§e按钮0"
    }, (pl)=>{log(`按下按钮 0`);subMenu(pl);});
    playerMenu.setButton({
        slot: 1, 
        count: 2,
        displayName: "§a按钮1",
        enchants: [{id:2,lvl:3}],
    }, (pl)=>{log(`按下按钮 1`);subMenu(pl);});
    playerMenu.setButton({
        slot: 2, 
        count: 4,
        displayName: "按钮2",
        loreNames: ["§b我是按钮2", "§d传说品质"]
    },(pl)=>{log(`按下按钮 2`);subMenu(pl);});
    playerMenu.setButton({
        slot: 17, 
        type: "minecraft:barrier", 
        displayName: "关闭",
        sound: "bottle.empty"
    },(pl)=>{log(`按钮关闭菜单`);playerMenu.close();});
    playerMenu.updateAllButtons();
}

function subMenu(pl){
    let playerMenu = BackpackMenu(pl);
    playerMenu.setButton({
        slot: 20,
        type: "minecraft:redstone", 
        displayName: "§e功能0",
        sound: "beacon.activate",
    },(pl)=>{pl.tell(`功能 0`);playerMenu.close();});
    playerMenu.setButton({
        slot: 22,
        type: "minecraft:redstone", 
        displayName: "§a功能1",
        enchants: [],
        sound: "beacon.activate",
    },(pl)=>{pl.tell(`功能 1`);playerMenu.close();});
    playerMenu.setButton({
        slot: 24,
        type: "minecraft:redstone", 
        displayName: "§a功能2",
        loreNames: ["§b功能2", "§d传说品质"],
        sound: "beacon.activate",
    },(pl)=>{pl.tell(`功能 2`);playerMenu.close();});
    playerMenu.setButton({
        slot: 17,
        type: "minecraft:compass", 
        displayName: "返回",
        sound: "block.itemframe.remove_item"
    },(pl)=>{
        log(`返回`);
        mainMenu(pl);
    });
    playerMenu.updateAllButtons();
}