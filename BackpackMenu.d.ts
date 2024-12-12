enum sendTextType {
    Raw = 0x0,
    Chat = 0x1,
    Translate = 0x2,
    Popup = 0x3,
    JukeboxPopup = 0x4,
    Tip = 0x5,
    SystemMessage = 0x6,
    Whisper = 0x7,
    Announcement = 0x8,
    TextObjectWhisper = 0x9,
    TextObject = 0xA,
    TextObjectAnnouncement = 0xB,
};

interface Player {
    /**
       * 发送一个文本消息给玩家
       * @param msg 待发送的文本
       * @param type 消息类型
       * @param args 待替换的参数
       */
    tell(msg: string, type?: sendTextType | number, ...args: any[]): void;

    /**
     * 发送一个文本消息给玩家
     * @param msg 待发送的文本
     * @param type 消息类型
     * @param args 待替换的参数
     */
    sendText(msg: string, type?: sendTextType | number, ...args: any[]): void;
}