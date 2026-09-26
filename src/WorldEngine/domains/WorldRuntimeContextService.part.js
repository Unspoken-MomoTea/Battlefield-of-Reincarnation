    class WorldRuntimeContextService {
        constructor(engine){this.engine=engine;}
        snapshot(){
            const engine=this.engine;
                        const mvu = engine.env.Mvu || engine.host.Mvu;
                        const getMessages = engine.fn('getChatMessages');
                        if (!mvu || !getMessages) throw new Error('等待 MVU 与酒馆消息接口');
                        const message = getMessages(-1)[0];
                        if (!message) throw new Error('当前没有消息');
                        const id = message.message_id != null ? message.message_id : message.id;
                        if (!Number.isInteger(Number(id))) throw new Error('当前楼层编号无效');
                        const raw = mvu.getMvuData({type:'message',message_id:Number(id)});
                        if (!raw || !raw.stat_data || !raw.stat_data.世界) throw new Error('当前楼层尚未初始化 MVU');
                        const context = engine.host.SillyTavern && engine.host.SillyTavern.getContext ? engine.host.SillyTavern.getContext() : {};
                        const chatFn = engine.fn('getCurrentChatId');
                        const chat = chatFn ? chatFn() : context.chatId;
                        if (chat == null) throw new Error('无法确认当前聊天标识');
                        const text = String(message.message != null ? message.message : message.mes || '');
                        const fingerprint = JSON.stringify([String(chat),Number(id),message.swipe_id || 0,digest(text)]);
                        return {mvu,raw:copy(raw),stat:copy(raw.stat_data),id:Number(id),text,fingerprint,message};
        }
        blocked(snapshot){
                        const s = snapshot.stat;
                        if ((s.系统状态 || {}).是否在主神空间 || s.世界.名称 === '主神空间') return '当前位于主神空间，副本推进暂停';
                        if (!s.世界.名称 || s.世界.名称 === '待初始化') return '等待副本初始化';
                        if (/轮回清算协议/.test(snapshot.text)) return '结算楼层由结算美化程序处理';
                        if (snapshot.message.is_user || snapshot.message.role === 'user') return '等待正文完成';
                        return '';
        }
    }
