const API = (token) => `https://api.telegram.org/bot${token}`;

async function tg(token, method, data) {
  const response = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) console.error(`Telegram ${method} failed`, result);
  return result;
}

const KEYBOARD = (rows) => ({ inline_keyboard: rows });

const PRODUCTS = {
  150: { price: 199, label: "150 ₽" },
  250: { price: 329, label: "250 ₽" },
  500: { price: 649, label: "500 ₽", tag: "🔥 Популярное" },
  750: { price: 979, label: "750 ₽" },
  1000: { price: 1299, label: "1 000 ₽", tag: "💜 Выгодный выбор" },
  1250: { price: 1629, label: "1 250 ₽" },
  1500: { price: 1949, label: "1 500 ₽" },
  1750: { price: 2299, label: "1 750 ₽" },
  2000: { price: 2599, label: "2 000 ₽", tag: "🚀 Максимум" }
};

const MENU = KEYBOARD([
  [{ text: "🎮 Пополнить Steam", callback_data: "steam" }],
  [{ text: "📦 Мои заказы", callback_data: "orders" }],
  [
    { text: "💬 Поддержка", callback_data: "support" },
    { text: "✨ О проекте", callback_data: "about" }
  ]
]);

const BACK = KEYBOARD([
  [{ text: "🌌 Главное меню", callback_data: "menu" }]
]);

const ADMIN_MENU = KEYBOARD([
  [{ text: "📦 Заказы", callback_data: "admin_orders" }],
  [{ text: "📢 Уведомления и рассылка", callback_data: "broadcast_start" }],
  [{ text: "📊 Статистика", callback_data: "admin_stats" }],
  [{ text: "🌌 Меню магазина", callback_data: "menu" }]
]);

const STATUS_NAMES = {
  pending: "⏳ Ожидает оплаты",
  paid: "💳 Оплачен",
  done: "✅ Выполнен",
  cancelled: "❌ Отменён"
};

// Курс RUB → BYN. Можно изменить через переменную Cloudflare.
const DEFAULT_RUB_TO_BYN_RATE = 0.0384;

function getExchangeRate(env) {
  const rate = Number(env.RUB_TO_BYN_RATE);
  return Number.isFinite(rate) && rate > 0
    ? rate
    : DEFAULT_RUB_TO_BYN_RATE;
}

function calculateBYN(rubAmount, rate) {
  const value = Number(rubAmount) * Number(rate);
  return Math.ceil((value - 1e-9) * 10) / 10;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function isAdmin(env, userId) {
  return String(userId) === String(env.ADMIN_CHAT_ID);
}

function db(env) {
  if (!env.DB) throw new Error("Cloudflare KV binding DB is missing");
  return env.DB;
}

async function saveJson(env, key, value, ttl) {
  await db(env).put(
    key,
    JSON.stringify(value),
    ttl ? { expirationTtl: ttl } : undefined
  );
}

async function getJson(env, key) {
  const raw = await db(env).get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function deleteKey(env, key) {
  await db(env).delete(key);
}

async function listJson(env, prefix, limit = 1000) {
  let cursor;
  const result = [];
  do {
    const page = await db(env).list({
      prefix,
      limit: Math.min(1000, limit - result.length),
      cursor
    });
    const values = await Promise.all(
      page.keys.map((item) => getJson(env, item.name))
    );
    result.push(...values.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && result.length < limit);
  return result;
}

async function saveUser(env, user) {
  if (!user?.id) return;
  await saveJson(env, `user:${user.id}`, {
    id: String(user.id),
    firstName: user.first_name || "",
    username: user.username || "",
    updatedAt: new Date().toISOString()
  });
}

function steamKeyboard() {
  const amounts = Object.keys(PRODUCTS).map(Number);
  const rows = [];
  for (let i = 0; i < amounts.length; i += 2) {
    rows.push(amounts.slice(i, i + 2).map((amount) => {
      const product = PRODUCTS[amount];
      return {
        text: `${product.tag ? product.tag + " · " : ""}${product.label} → ${product.price} ₽`,
        callback_data: `amount_${amount}`
      };
    }));
  }
  rows.push([{ text: "↩️ Назад", callback_data: "menu" }]);
  return KEYBOARD(rows);
}

async function sendMenu(token, chatId, env) {
  const text =
    "🌌 <b>xMoonSale</b>\n" +
    "━━━━━━━━━━━━━━━━━━\n\n" +
    "Добро пожаловать в цифровую вселенную! 💜\n\n" +
    "🎮 Пополнение Steam\n" +
    "🚀 Простое оформление заказа\n" +
    "🔒 Пароль от аккаунта не требуется\n\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "Выбери нужный раздел:";
  if (env.BRAND_IMAGE_FILE_ID) {
    return tg(token, "sendPhoto", {
      chat_id: chatId,
      photo: env.BRAND_IMAGE_FILE_ID,
      caption: text,
      parse_mode: "HTML",
      reply_markup: MENU
    });
  }
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: MENU
  });
}

async function sendAdminMenu(token, chatId) {
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "🌌 <b>xMoonSale | ADMIN</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "Панель управления магазином.\nВыбери раздел:",
    parse_mode: "HTML",
    reply_markup: ADMIN_MENU
  });
}

async function sendSteamMenu(token, chatId, messageId) {
  return tg(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text:
      "🎮 <b>STEAM | ПОПОЛНЕНИЕ</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "Выбери номинал пополнения.\n" +
      "Цена указана сразу — без скрытых доплат.\n\n" +
      "🔒 Пароль от Steam не требуется.",
    parse_mode: "HTML",
    reply_markup: steamKeyboard()
  });
}

async function showOrders(token, env, chatId, userId) {
  const orders = (await listJson(env, "order:"))
    .filter((o) => String(o.userId) === String(userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  let text = "📦 <b>МОИ ЗАКАЗЫ</b>\n━━━━━━━━━━━━━━━━━━\n\n";
  if (!orders.length) {
    text += "У тебя пока нет оформленных заявок.";
  } else {
    for (const order of orders) {
      text +=
        `🆔 <code>${escapeHtml(order.id)}</code>\n` +
        `🎮 Steam: <code>${escapeHtml(order.login)}</code>\n` +
        `💎 Пополнение: <b>${order.amount} ₽</b>\n` +
        `💰 К оплате: <b>${order.price} ₽</b>\n` +
        `Статус: ${STATUS_NAMES[order.status] || order.status}\n\n`;
    }
  }
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text: text + "\n💜 xMoonSale",
    parse_mode: "HTML",
    reply_markup: BACK
  });
}

async function showAdminOrders(token, env, chatId) {
  const orders = (await listJson(env, "order:"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  if (!orders.length) {
    return tg(token, "sendMessage", {
      chat_id: chatId,
      text: "📦 <b>Заказов пока нет.</b>",
      parse_mode: "HTML",
      reply_markup: ADMIN_MENU
    });
  }

  const rows = orders.map((order) => [{
    text: `${order.id} · ${order.price} ₽ · ${STATUS_NAMES[order.status] || order.status}`,
    callback_data: `order_${order.id}`
  }]);

  rows.push([{ text: "↩️ В админ-меню", callback_data: "admin_home" }]);
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text: "📦 <b>ПОСЛЕДНИЕ ЗАКАЗЫ</b>\n━━━━━━━━━━━━━━━━━━\nВыбери заказ:",
    parse_mode: "HTML",
    reply_markup: KEYBOARD(rows)
  });
}

async function showOrder(token, env, chatId, orderId) {
  const order = await getJson(env, `order:${orderId}`);

  if (!order) {
    return tg(token, "sendMessage", {
      chat_id: chatId,
      text: "⚠️ Заказ не найден.",
      reply_markup: ADMIN_MENU
    });
  }

  const orderRate = Number(order.exchangeRate) > 0
    ? Number(order.exchangeRate)
    : getExchangeRate(env);

  const orderBYN = order.priceBYN !== undefined && order.priceBYN !== null
    ? Number(order.priceBYN)
    : calculateBYN(order.price, orderRate);

  const rows = [];
  if (order.status === "pending") {
    rows.push([{ text: "💳 Подтвердить оплату", callback_data: `op_paid_${order.id}` }]);
    rows.push([{ text: "❌ Отменить заказ", callback_data: `op_cancel_${order.id}` }]);
  } else if (order.status === "paid") {
    rows.push([{ text: "✅ Отметить выполненным", callback_data: `op_done_${order.id}` }]);
  }
  rows.push([{ text: "↩️ К заказам", callback_data: "admin_orders" }]);

  return tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      `📦 <b>ЗАКАЗ ${escapeHtml(order.id)}</b>\n` +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "🎮 Сервис: Steam\n" +
      `👤 Логин: <code>${escapeHtml(order.login)}</code>\n` +
      `💎 Пополнение: <b>${order.amount} ₽</b>\n` +
      `💰 К оплате: <b>${order.price} ₽</b>\n` +
      `💱 Расчётная сумма: <b>${orderBYN.toFixed(2)} BYN</b>\n` +
      `📈 Курс: <code>1 RUB = ${orderRate.toFixed(4)} BYN</code>\n` +
      `👥 Telegram ID: <code>${escapeHtml(order.userId)}</code>\n` +
      `Статус: ${STATUS_NAMES[order.status] || order.status}\n\n` +
      "Выбери действие:",
    parse_mode: "HTML",
    reply_markup: KEYBOARD(rows)
  });
}

async function changeOrderStatus(token, env, orderId, status) {
  const order = await getJson(env, `order:${orderId}`);
  if (!order) return { ok: false, reason: "not_found" };

  const allowed = {
    pending: ["paid", "cancelled"],
    paid: ["done"],
    done: [],
    cancelled: []
  };

  if (!allowed[order.status]?.includes(status)) {
    return { ok: false, reason: "invalid_transition" };
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  await saveJson(env, `order:${orderId}`, order);

  let extra = "";
  if (status === "paid") {
    extra = "\n\n💜 Оплата подтверждена. Заказ скоро будет обработан.";
  } else if (status === "done") {
    extra = "\n\n🎉 Заказ отмечен как выполненный. Спасибо за покупку!";
  } else if (status === "cancelled") {
    extra = "\n\nЕсли нужна помощь, напиши в поддержку: @axg0d";
  }

  await tg(token, "sendMessage", {
    chat_id: order.chatId || order.userId,
    text:
      "🌌 <b>xMoonSale</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
      `Обновление по заказу <code>${escapeHtml(order.id)}</code>\n\n` +
      `Новый статус: <b>${STATUS_NAMES[status]}</b>${extra}`,
    parse_mode: "HTML"
  });

  return { ok: true };
}

async function showStats(token, env, chatId) {
  const users = await listJson(env, "user:");
  const orders = await listJson(env, "order:");
  const count = (status) => orders.filter((o) => o.status === status).length;
  const completedTotal = orders
    .filter((o) => o.status === "done")
    .reduce((sum, o) => sum + Number(o.price || 0), 0);

  return tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "📊 <b>СТАТИСТИКА xMoonSale</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
      `👥 Пользователей: <b>${users.length}</b>\n` +
      `📦 Всего заказов: <b>${orders.length}</b>\n` +
      `⏳ Ожидают оплаты: <b>${count("pending")}</b>\n` +
      `💳 Оплачено: <b>${count("paid")}</b>\n` +
      `✅ Выполнено: <b>${count("done")}</b>\n` +
      `❌ Отменено: <b>${count("cancelled")}</b>\n\n` +
      `💰 Сумма выполненных заказов: <b>${completedTotal} ₽</b>`,
    parse_mode: "HTML",
    reply_markup: ADMIN_MENU
  });
}

async function broadcastPreview(token, chatId, draft) {
  const keyboard = KEYBOARD([
    [{ text: "🚀 Отправить всем", callback_data: "bc_send" }],
    [{ text: "❌ Отменить", callback_data: "bc_cancel" }]
  ]);

  if (draft.photo) {
    return tg(token, "sendPhoto", {
      chat_id: chatId,
      photo: draft.photo,
      caption: draft.text || "🌌 xMoonSale",
      reply_markup: keyboard
    });
  }

  return tg(token, "sendMessage", {
    chat_id: chatId,
    text: draft.text,
    reply_markup: keyboard
  });
}

async function sendBroadcast(token, env, chatId) {
  const draft = await getJson(env, "broadcast:draft");

  if (!draft) {
    return tg(token, "sendMessage", {
      chat_id: chatId,
      text: "⚠️ Черновик рассылки не найден.",
      reply_markup: ADMIN_MENU
    });
  }

  const users = await listJson(env, "user:");
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    const result = draft.photo
      ? await tg(token, "sendPhoto", {
          chat_id: user.id,
          photo: draft.photo,
          caption: draft.text || ""
        })
      : await tg(token, "sendMessage", {
          chat_id: user.id,
          text: draft.text
        });

    if (result?.ok) sent++;
    else failed++;
  }

  await deleteKey(env, "broadcast:draft");
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "📢 <b>РАССЫЛКА ЗАВЕРШЕНА</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
      `✅ Доставлено: ${sent}\n⚠️ Не доставлено: ${failed}\n` +
      `👥 Всего пользователей: ${users.length}`,
    parse_mode: "HTML",
    reply_markup: ADMIN_MENU
  });
}

function paymentMessage(env, order) {
  // Убираем строки с упоминанием BYN из инструкции покупателю.
  const details = String(env.PAYMENT_DETAILS || "")
    .trim()
    .split("\n")
    .filter((line) => !/BYN|белорусск/i.test(line))
    .join("\n")
    .trim();

  if (!details) {
    return (
      "💳 <b>Оплата</b>\n\n" +
      "Заявка создана. Администратор скоро пришлёт инструкции по оплате.\n\n" +
      "Пожалуйста, не переводи деньги до получения реквизитов."
    );
  }

  return (
    "💳 <b>ИНСТРУКЦИЯ ПО ОПЛАТЕ</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
    `${escapeHtml(details)}\n\n` +
    `Сумма к оплате: <b>${order.price} ₽</b>\n` +
    `Номер заказа: <code>${escapeHtml(order.id)}</code>\n\n` +
    "После оплаты дождись подтверждения администратора. Пароль Steam не отправляй."
  );
}
async function createOrder(token, env, chatId, userId, state) {
  const product = PRODUCTS[state.amount];

  if (!product || !state.login) {
    await tg(token, "sendMessage", {
      chat_id: chatId,
      text: "⚠️ Не удалось создать заказ. Начни оформление заново.",
      reply_markup: MENU
    });
    return;
  }

  const currentState = await getJson(env, `state:${userId}`);

  if (currentState?.type !== "steam_confirm") {
    if (currentState?.type === "order_created") {
      await tg(token, "sendMessage", {
        chat_id: chatId,
        text: `Этот заказ уже создан: ${currentState.orderId}. Повторно оформлять его не нужно.`,
        reply_markup: BACK
      });
    }
    return;
  }

  const orderId = "XM-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  // Сохраняем курс и расчётную сумму в момент создания заказа.
  const exchangeRate = getExchangeRate(env);
  const priceBYN = calculateBYN(product.price, exchangeRate);

  const order = {
    id: orderId,
    userId: String(userId),
    chatId: String(chatId),
    login: state.login,
    amount: Number(state.amount),
    price: product.price,
    exchangeRate,
    priceBYN,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await saveJson(env, `order:${orderId}`, order);
  await saveJson(env, `state:${userId}`, { type: "order_created", orderId }, 86400);

  const adminResult = await tg(token, "sendMessage", {
    chat_id: env.ADMIN_CHAT_ID,
    text:
      "🌌 <b>НОВАЯ ЗАЯВКА xMoonSale</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
      `🆔 Номер: <code>${escapeHtml(orderId)}</code>\n` +
      "🎮 Товар: Пополнение Steam\n" +
      `💎 Номинал: <b>${order.amount} ₽</b>\n` +
      `💰 Цена: <b>${order.price} RUB</b>\n` +
      `💱 Расчётная сумма: <b>${order.priceBYN.toFixed(2)} BYN</b>\n` +
      `📈 Курс: <code>1 RUB = ${order.exchangeRate.toFixed(4)} BYN</code>\n` +
      `👤 Логин: <code>${escapeHtml(order.login)}</code>\n` +
      `👥 Telegram ID: <code>${escapeHtml(userId)}</code>\n\n` +
      "⏳ Статус: <b>Ожидает оплаты</b>",
    parse_mode: "HTML",
    reply_markup: KEYBOARD([
      [{ text: "💳 Оплачен", callback_data: `op_paid_${orderId}` }],
      [{ text: "❌ Отменить", callback_data: `op_cancel_${orderId}` }],
      [{ text: "📦 Открыть заказ", callback_data: `order_${orderId}` }]
    ])
  });

  if (!adminResult?.ok) {
    await tg(token, "sendMessage", {
      chat_id: chatId,
      text:
        `⚠️ Заказ ${orderId} сохранён, но уведомление администратору не доставлено.\n` +
        "Не создавай повторную заявку. Напиши @axg0d.",
      reply_markup: BACK
    });
    return;
  }

  await tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "🌌 <b>xMoonSale</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
      "✅ <b>Заявка принята!</b>\n\n" +
      `🆔 Номер: <code>${escapeHtml(orderId)}</code>\n` +
      `🎮 Steam: <code>${escapeHtml(order.login)}</code>\n` +
      `💎 Пополнение: <b>${order.amount} ₽</b>\n` +
      `💰 К оплате: <b>${order.price} ₽</b>\n\n` +
      "⏳ Статус: Ожидает оплаты\n\n" +
      paymentMessage(env, order) +
      "\n\n💜 Спасибо, что выбираешь xMoonSale!",
    parse_mode: "HTML",
    reply_markup: BACK
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET || !env.ADMIN_CHAT_ID || !env.DB) {
      return new Response("Worker configuration missing", { status: 500 });
    }

    if (request.method === "GET" && url.pathname === "/setup") {
      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }

      const result = await tg(env.BOT_TOKEN, "setWebhook", {
        url: "https://xmoonsale-bot.xmoonsale.workers.dev/",
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"]
      });

      return Response.json(result);
    }

    if (request.method !== "POST") {
      return new Response("🌌 xMoonSale is online!");
    }

    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const update = await request.json();

      // CALLBACK BUTTONS
      if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message?.chat?.id;
        const userId = cb.from?.id;
        const messageId = cb.message?.message_id;
        const data = cb.data || "";

        await tg(env.BOT_TOKEN, "answerCallbackQuery", {
          callback_query_id: cb.id
        });

        await saveUser(env, cb.from);

        const adminAction = /^(admin_|broadcast_|bc_|order_|op_)/.test(data);
        if (adminAction && !isAdmin(env, userId)) {
          return new Response("OK");
        }

        if (data === "admin_home") {
          await sendAdminMenu(env.BOT_TOKEN, chatId);
        } else if (data === "admin_orders") {
          await showAdminOrders(env.BOT_TOKEN, env, chatId);
        } else if (data === "admin_stats") {
          await showStats(env.BOT_TOKEN, env, chatId);
        } else if (data === "broadcast_start") {
          await saveJson(env, `state:${userId}`, { type: "broadcast_compose" }, 3600);
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text:
              "📢 <b>НОВАЯ РАССЫЛКА</b>\n\n" +
              "Отправь следующим сообщением текст или фотографию с подписью.\n" +
              "Перед отправкой всем пользователям покажу предпросмотр.",
            parse_mode: "HTML",
            reply_markup: KEYBOARD([[{ text: "❌ Отмена", callback_data: "bc_cancel" }]])
          });
        } else if (data === "bc_cancel") {
          await deleteKey(env, `state:${userId}`);
          await deleteKey(env, "broadcast:draft");
          await sendAdminMenu(env.BOT_TOKEN, chatId);
        } else if (data === "bc_send") {
          await sendBroadcast(env.BOT_TOKEN, env, chatId);
        } else if (data.startsWith("order_")) {
          await showOrder(env.BOT_TOKEN, env, chatId, data.slice(6));
        } else if (data.startsWith("op_")) {
          const parts = data.split("_");
          const action = parts[1];
          const orderId = parts.slice(2).join("_");
          const status = action === "cancel" ? "cancelled" : action;

          if (["paid", "done", "cancelled"].includes(status)) {
            const result = await changeOrderStatus(env.BOT_TOKEN, env, orderId, status);
            const message = result.ok
              ? "✅ Статус заказа обновлён."
              : result.reason === "invalid_transition"
                ? "⚠️ Это действие недоступно для текущего статуса."
                : "⚠️ Заказ не найден.";

            await tg(env.BOT_TOKEN, "sendMessage", {
              chat_id: chatId,
              text: message,
              reply_markup: ADMIN_MENU
            });
          }
        } else if (data === "menu") {
          await sendMenu(env.BOT_TOKEN, chatId, env);
        } else if (data === "steam") {
          const result = await sendSteamMenu(env.BOT_TOKEN, chatId, messageId);
          if (!result?.ok) {
            await tg(env.BOT_TOKEN, "sendMessage", {
              chat_id: chatId,
              text: "🎮 <b>Выбери сумму пополнения:</b>",
              parse_mode: "HTML",
              reply_markup: steamKeyboard()
            });
          }
        } else if (data.startsWith("amount_")) {
          const amount = Number(data.slice(7));
          if (!PRODUCTS[amount]) return new Response("OK");

          await saveJson(env, `state:${userId}`, {
            type: "steam_login",
            amount,
            createdAt: new Date().toISOString()
          }, 1800);

          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text:
              "🌌 <b>xMoonSale | STEAM</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
              `💎 Пополнение: <b>${amount} ₽</b>\n` +
              `💰 К оплате: <b>${PRODUCTS[amount].price} ₽</b>\n\n` +
              "Отправь свой логин Steam следующим сообщением.\n\n" +
              "⚠️ Нужен именно логин аккаунта. Никогда не отправляй пароль!",
            parse_mode: "HTML",
            reply_markup: KEYBOARD([[{ text: "❌ Отмена", callback_data: "checkout_cancel" }]])
          });
        } else if (data === "checkout_confirm") {
          const checkout = await getJson(env, `state:${userId}`);

          if (checkout?.type === "steam_confirm") {
            await createOrder(env.BOT_TOKEN, env, chatId, userId, checkout);
          } else if (checkout?.type === "order_created") {
            await tg(env.BOT_TOKEN, "sendMessage", {
              chat_id: chatId,
              text: `Этот заказ уже создан: ${checkout.orderId}. Повторно оформлять его не нужно.`,
              reply_markup: BACK
            });
          } else {
            await tg(env.BOT_TOKEN, "sendMessage", {
              chat_id: chatId,
              text: "⌛ Сессия оформления истекла. Начни заново через меню.",
              reply_markup: MENU
            });
          }
        } else if (data === "checkout_cancel") {
          await deleteKey(env, `state:${userId}`);
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "↩️ Оформление отменено.",
            reply_markup: MENU
          });
        } else if (data === "orders") {
          await showOrders(env.BOT_TOKEN, env, chatId, userId);
        } else if (data === "support") {
          await tg(env.BOT_TOKEN, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text:
              "💬 <b>ПОДДЕРЖКА</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
              "Нужна помощь?\nНапиши нам: @axg0d\n\nМы постараемся помочь! 💜",
            parse_mode: "HTML",
            reply_markup: BACK
          });
        } else if (data === "about") {
          await tg(env.BOT_TOKEN, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text:
              "🌌 <b>О ПРОЕКТЕ xMoonSale</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
              "Цифровая площадка, которая развивается вместе с тобой.\n\n" +
              "🎮 Игровые товары\n🚀 Цифровые сервисы\n✨ Новые возможности\n\n" +
              "Спасибо, что ты с нами! 💜",
            parse_mode: "HTML",
            reply_markup: BACK
          });
        }

        return new Response("OK");
      }

      // INCOMING MESSAGES
      const message = update.message;
      if (!message?.chat) return new Response("OK");

      const chatId = message.chat.id;
      const userId = message.from?.id;
      const text = (message.text || "").trim();

      await saveUser(env, message.from);

      if (text === "/start" || text === "/menu") {
        await deleteKey(env, `state:${userId}`);
        await sendMenu(env.BOT_TOKEN, chatId, env);
        return new Response("OK");
      }

      if (text === "/admin") {
        if (!isAdmin(env, userId)) {
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "⛔ Доступ запрещён."
          });
          return new Response("OK");
        }
        await sendAdminMenu(env.BOT_TOKEN, chatId);
        return new Response("OK");
      }

      if (text === "/cancel") {
        await deleteKey(env, `state:${userId}`);
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text: "↩️ Действие отменено."
        });
        await sendMenu(env.BOT_TOKEN, chatId, env);
        return new Response("OK");
      }

      const state = await getJson(env, `state:${userId}`);

      // BROADCAST COMPOSE
      if (state?.type === "broadcast_compose" && isAdmin(env, userId)) {
        const photo = message.photo?.length
          ? message.photo[message.photo.length - 1].file_id
          : null;
        const caption = (message.caption || text || "").trim();

        if (!photo && !caption) {
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "⚠️ Отправь текст или фотографию с подписью."
          });
          return new Response("OK");
        }

        const draft = { photo, text: caption };
        await saveJson(env, "broadcast:draft", draft, 3600);
        await deleteKey(env, `state:${userId}`);

        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text: "👀 <b>Предварительный просмотр рассылки:</b>",
          parse_mode: "HTML"
        });

        await broadcastPreview(env.BOT_TOKEN, chatId, draft);
        return new Response("OK");
      }

      // STEAM LOGIN
      if (state?.type === "steam_login") {
        if (!/^[A-Za-z0-9_.-]{2,64}$/.test(text)) {
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text:
              "⚠️ Проверь логин Steam. Допустимы латинские буквы, цифры, " +
              "точка, дефис и подчёркивание. Пароль не нужен."
          });
          return new Response("OK");
        }

        state.login = text;
        state.type = "steam_confirm";
        await saveJson(env, `state:${userId}`, state, 1800);

        const product = PRODUCTS[state.amount];

        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text:
            "🌌 <b>xMoonSale | ПРОВЕРКА ЗАЯВКИ</b>\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "🎮 Сервис: Steam\n" +
            `💎 Пополнение: <b>${state.amount} ₽</b>\n` +
            `💰 К оплате: <b>${product.price} ₽</b>\n` +
            `👤 Логин: <code>${escapeHtml(text)}</code>\n\n` +
            "Проверь данные и подтверди заказ кнопкой ниже.",
          parse_mode: "HTML",
          reply_markup: KEYBOARD([
            [{ text: "✅ Подтвердить заказ", callback_data: "checkout_confirm" }],
            [{ text: "❌ Отменить", callback_data: "checkout_cancel" }]
          ])
        });

        return new Response("OK");
      }

      // FALLBACK
      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "🌌 Используй меню xMoonSale для выбора нужного раздела.",
        reply_markup: MENU
      });

      return new Response("OK");
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Worker error", { status: 500 });
    }
  }
};