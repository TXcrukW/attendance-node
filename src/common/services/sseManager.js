/**
 * SSE 管理器 —— 维护管理后台在班看板的长连接客户端
 *
 * 用法：
 *   const sseManager = require('../common/services/sseManager');
 *
 *   // 注册连接（在 SSE 路由中）
 *   sseManager.addClient(res);
 *
 *   // 推送最新数据给所有连接的管理端（在状态变更后调用）
 *   sseManager.broadcast(data);
 */

const clients = new Set();

/**
 * 将一个 SSE response 对象加入订阅集合，并在断连时自动移除。
 * @param {import('express').Response} res
 */
function addClient(res) {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

/**
 * 向所有已连接的管理端推送数据。
 * @param {object} data  - 任意可 JSON 序列化的对象
 */
function broadcast(data) {
  if (clients.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (_) {
      clients.delete(res);
    }
  }
}

/** 当前活跃的 SSE 连接数（调试用）*/
function clientCount() {
  return clients.size;
}

module.exports = { addClient, broadcast, clientCount };
