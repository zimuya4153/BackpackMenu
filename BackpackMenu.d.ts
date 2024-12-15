type ItemData = {
    /** 物品命名空间ID */
    type?: string,
    /** 物品数量 */
    amount?: number,
    /** 物品命名 */
    displayName?: string,
    /** 物品Lore */
    lores?: string[],
    /** 物品附魔 */
    enchants: {
        /** 附魔ID */
        id: number,
        /** 附魔等级 */
        level: number,
    }[];
} | Item;

class BackpackMenu {
    /** 设置槽位回调 */
    setCallback(
        /** 槽位 */
        slot: number,
        /** 回调 */
        callback: (menu: BackpackMenu, player: Player, slot: number) => void,
    ): BackpackMenu;

    /** 设置最终回调(如果点击的槽位未设置回调, 则调用此回调) */
    setCallback(
        /** 回调 */
        callback: (menu: BackpackMenu, player: Player | undefined, slot: number) => void,
    ): BackpackMenu;

    /** 设置槽位 */
    setButton(
        /** 槽位 */
        slot: number,
        /** 物品数据 */
        data: ItemData,
        /** 回调 */
        callback?: (menu: BackpackMenu, player: Player | undefined, slot: number) => void,
    ): BackpackMenu;

    /** 发包更新槽位 */
    #updateButton(
        /** 槽位 */
        slot: number,
        /** 物品数据 */
        data: ItemData,
    ): BackpackMenu;

    /** 发包更新所有槽位 */
    #updateAllButton(): BackpackMenu;

    /** 打开菜单 */
    open(): BackpackMenu;

    /** 关闭菜单 */
    close(): BackpackMenu;

    /** 菜单是否为打开状态 */
    isOpen(): boolean;

    /** 获取菜单主人 */
    getPlayer(): Player | undefined;

    /** 触发槽位回调 */
    callback(
        /** 槽位 */
        slot: number
    ): BackpackMenu;

    /** 清除所有槽位 */
    clear(
        /** 为客户端关闭 */
        isClient?: boolean
    ): BackpackMenu;
}

/** 创建或获取菜单 */
export function BackpackMenu(
    /** 菜单的主人 */
    player: Player,
    /** 菜单的最终回调(如果点击的槽位未设置回调, 则调用此回调) */
    callback?: (player: Player, slot: number) => void,
): BackpackMenu;

/** 根据物品数据生成物品 */
export function spawnItem(
    /** 物品数据 */
    data: ItemData
): Item;