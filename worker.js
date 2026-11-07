
const API = (token) => `https://api.telegram.org/bot${token}`;

async function tg(token, method, data) {
  const response = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return response.json();
}

const KEYBOARD = (rows) => ({ inline_keyboard: rows });

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

const STEAM_MENU = KEYBOARD([
  [
    { text: "100 ₽", callback_data: "amount_100" },
    { text: "250 ₽", callback_data: "amount_250" }
  ],
  [
    { text: "500 ₽", callback_data: "amount_500" },
    { text: "1 000 ₽", callback_data: "amount_1000" }
  ],
  [{ text: "↩️ Назад", callback_data: "menu" }]
]);

const STATUS_NAMES = {
  pending: "⏳ Ожидает оплаты",
  paid: "💳 Оплачен",
  done: "✅ Выполнен",
  cancelled: "❌ Отменён"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function plain(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function isAdmin(env, userId) {
  return String(userId) === String(env.ADMIN_CHAT_ID);
}

function db(env) {
  if (!env.DB) throw new Error("Cloudflare KV binding DB is missing");
  return env.DB;
}

async function saveJson(env, key, value) {
  await db(env).put(key, JSON.stringify(value));
}

async function getJson(env, key) {
  const value = await db(env).get(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function listJson(env, prefix, limit = 1000) {
  const result = await db(env).list({ prefix, limit });
  const items = await Promise.all(
    result.keys.map((item) => getJson(env, item.name))
  );
  return items.filter(Boolean);
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

async function sendMenu(token, chatId, env) {
  const caption =
    "🌌 <b>xMoonSale</b>\n" +
    "━━━━━━━━━━━━━━━━━━\n\n" +
    "Добро пожаловать в цифровую вселенную! 💜\n\n" +
    "🎮 Игровые товары и сервисы\n" +
    "🚀 Удобное оформление заявок\n" +
    "✨ Новые возможности впереди\n\n" +
    "━━━━━━━━━━━━━━━━━━\n" +
    "Выбери нужный раздел:";

  if (env.BRAND_IMAGE_FILE_ID) {
    return tg(token, "sendPhoto", {
      chat_id: chatId,
      photo: env.BRAND_IMAGE_FILE_ID,
      caption,
      parse_mode: "HTML",
      reply_markup: MENU
    });
  }

  return tg(token, "sendMessage", {
    chat_id: chatId,
    text: caption,
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
      "Панель управления магазином.\n\n" +
      "Выбери нужный раздел:",
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
      "Выбери сумму пополнения:\n\n" +
      "🚀 Несколько простых шагов — и заявка готова.\n" +
      "🔒 Пароль от аккаунта не требуется.\n\n" +
      "━━━━━━━━━━━━━━━━━━",
    parse_mode: "HTML",
    reply_markup: STEAM_MENU
  });
}

async function showOrders(token, env, chatId, userId) {
  const orders = (await listJson(env, "order:"))
    .filter((o) => String(o.userId) === String(userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  let text = "📦 <b>МОИ ЗАКАЗЫ</b>\n━━━━━━━━━━━━━━━━━━\n\n";

  if (!orders.length) {
    text += "У тебя пока нет оформленных заявок.";
  } else {
    for (const order of orders) {
      text +=
        `🆔 <code>${escapeHtml(order.id)}</code>\n` +
        `🎮 Steam: <code>${escapeHtml(order.login)}</code>\n` +
        `💰 Сумма: <b>${escapeHtml(order.amount)} ₽</b>\n` +
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
    text: `${order.id} · ${order.amount} ₽ · ${STATUS_NAMES[order.status] || order.status}`,
    callback_data: `order_${order.id}`
  }]);

  rows.push([{ text: "↩️ В админ-меню", callback_data: "admin_home" }]);

  return tg(token, "sendMessage", {
    chat_id: chatId,
    text: "📦 <b>ПОСЛЕДНИЕ ЗАКАЗЫ</b>\n━━━━━━━━━━━━━━━━━━\nВыбери заказ для управления:",
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

  return tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "📦 <b>ЗАКАЗ " + escapeHtml(order.id) + "</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "🎮 Сервис: Steam\n" +
      "👤 Логин: <code>" + escapeHtml(order.login) + "</code>\n" +
      "💰 Сумма: <b>" + escapeHtml(order.amount) + " ₽</b>\n" +
      "👥 Telegram ID: <code>" + escapeHtml(order.userId) + "</code>\n" +
      "Статус: " + (STATUS_NAMES[order.status] || order.status) + "\n\n" +
      "Выбери действие:",
    parse_mode: "HTML",
    reply_markup: KEYBOARD([
      [{ text: "💳 Отметить оплаченным", callback_data: `op_paid_${order.id}` }],
      [{ text: "✅ Отметить выполненным", callback_data: `op_done_${order.id}` }],
      [{ text: "❌ Отменить заказ", callback_data: `op_cancel_${order.id}` }],
      [{ text: "↩️ К заказам", callback_data: "admin_orders" }]
    ])
  });
}

async function changeOrderStatus(token, env, orderId, status) {
  const order = await getJson(env, `order:${orderId}`);
  if (!order) return false;

  order.status = status;
  order.updatedAt = new Date().toISOString();
  await saveJson(env, `order:${orderId}`, order);

  await tg(token, "sendMessage", {
    chat_id: order.userId,
    text:
      "🌌 <b>xMoonSale</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "Обновление по твоей заявке <code>" + escapeHtml(order.id) + "</code>\n\n" +
      "Новый статус: <b>" + STATUS_NAMES[status] + "</b>\n\n" +
      "💜 Спасибо, что выбираешь xMoonSale!",
    parse_mode: "HTML"
  });

  return true;
}

async function showStats(token, env, chatId) {
  const users = await listJson(env, "user:");
  const orders = await listJson(env, "order:");

  const pending = orders.filter((o) => o.status === "pending").length;
  const paid = orders.filter((o) => o.status === "paid").length;
  const done = orders.filter((o) => o.status === "done").length;

  return tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "📊 <b>СТАТИСТИКА xMoonSale</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "👥 Пользователей: <b>" + users.length + "</b>\n" +
      "📦 Всего заказов: <b>" + orders.length + "</b>\n" +
      "⏳ Ожидают оплаты: <b>" + pending + "</b>\n" +
      "💳 Оплачено: <b>" + paid + "</b>\n" +
      "✅ Выполнено: <b>" + done + "</b>\n\n" +
      "━━━━━━━━━━━━━━━━━━",
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
    let result;

    if (draft.photo) {
      result = await tg(token, "sendPhoto", {
        chat_id: user.id,
        photo: draft.photo,
        caption: draft.text || ""
      });
    } else {
      result = await tg(token, "sendMessage", {
        chat_id: user.id,
        text: draft.text
      });
    }

    if (result?.ok) sent++;
    else failed++;
  }

  await db(env).delete("broadcast:draft");

  return tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "📢 <b>РАССЫЛКА ЗАВЕРШЕНА</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "✅ Доставлено: " + sent + "\n" +
      "⚠️ Не доставлено: " + failed + "\n" +
      "👥 Всего пользователей: " + users.length,
    parse_mode: "HTML",
    reply_markup: ADMIN_MENU
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET || !env.ADMIN_CHAT_ID) {
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

    if (
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") !==
      env.WEBHOOK_SECRET
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const update = await request.json();

      // =========================
      // CALLBACK BUTTONS
      // =========================

      if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id;
        const userId = cb.from.id;
        const messageId = cb.message.message_id;
        const data = cb.data || "";

        await tg(env.BOT_TOKEN, "answerCallbackQuery", {
          callback_query_id: cb.id
        });

        await saveUser(env, cb.from);

        if (data.startsWith("admin_") || data.startsWith("broadcast_") ||
            data.startsWith("bc_") || data.startsWith("order_") ||
            data.startsWith("op_")) {
          if (!isAdmin(env, userId)) {
            return new Response("OK");
          }
        }

        if (data === "admin_home") {
          await sendAdminMenu(env.BOT_TOKEN, chatId);
          return new Response("OK");
        }

        if (data === "admin_orders") {
          await showAdminOrders(env.BOT_TOKEN, env, chatId);
          return new Response("OK");
        }

        if (data === "admin_stats") {
          await showStats(env.BOT_TOKEN, env, chatId);
          return new Response("OK");
        }

        if (data === "broadcast_start") {
          await saveJson(env, `state:${chatId}`, { type: "broadcast_compose" });
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text:
              "📢 <b>НОВАЯ РАССЫЛКА</b>\n\n" +
              "Отправь следующим сообщением текст акции или новость.\n\n" +
              "Можно отправить фотографию с подписью.\n" +
              "Перед отправкой всем пользователям покажу предварительный просмотр.",
            parse_mode: "HTML",
            reply_markup: KEYBOARD([
              [{ text: "❌ Отмена", callback_data: "bc_cancel" }]
            ])
          });
          return new Response("OK");
        }

        if (data === "bc_cancel") {
          await db(env).delete(`state:${chatId}`);
          await db(env).delete("broadcast:draft");
          await sendAdminMenu(env.BOT_TOKEN, chatId);
          return new Response("OK");
        }

        if (data === "bc_send") {
          await sendBroadcast(env.BOT_TOKEN, env, chatId);
          return new Response("OK");
        }

        if (data.startsWith("order_")) {
          await showOrder(env.BOT_TOKEN, env, chatId, data.slice(6));
          return new Response("OK");
        }

        if (data.startsWith("op_")) {
          const parts = data.split("_");
          const status = parts[1];
          const orderId = parts.slice(2).join("_");
          const allowed = ["paid", "done", "cancel"];

          if (allowed.includes(status)) {
            const saved = await changeOrderStatus(
              env.BOT_TOKEN,
              env,
              orderId,
              status === "cancel" ? "cancelled" : status
            );

            await tg(env.BOT_TOKEN, "sendMessage", {
              chat_id: chatId,
              text: saved ? "✅ Статус заказа обновлён." : "⚠️ Заказ не найден.",
              reply_markup: ADMIN_MENU
            });
          }
          return new Response("OK");
        }

        if (data === "menu") {
          await sendMenu(env.BOT_TOKEN, chatId, env);
          return new Response("OK");
        }

        if (data === "steam") {
          await sendSteamMenu(env.BOT_TOKEN, chatId, messageId);
          return new Response("OK");
        }

        if (data.startsWith("amount_")) {
          const amount = Number(data.slice(7));

          if (![100, 250, 500, 1000].includes(amount)) {
            return new Response("Invalid amount");
          }

          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text:
              "🌌 xMoonSale | STEAM\n" +
              "━━━━━━━━━━━━━━━━━━\n\n" +
              "💰 Выбрана сумма: " + amount + " ₽\n\n" +
              "👤 Отправь ответом на это сообщение свой логин Steam.\n\n" +
              "⚠️ Нужен только логин аккаунта. Никогда не отправляй пароль!\n\n" +
              "━━━━━━━━━━━━━━━━━━",
            reply_markup: {
              force_reply: true,
              input_field_placeholder: "Логин Steam"
            }
          });
          return new Response("OK");
        }

        if (data === "orders") {
          await showOrders(env.BOT_TOKEN, env, chatId, userId);
          return new Response("OK");
        }

        const pages = {
          support:
            "💬 <b>ПОДДЕРЖКА</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
            "Нужна помощь?\n\nНапиши нам: @axg0d\n\nМы постараемся помочь! 💜",
          about:
            "🌌 <b>О ПРОЕКТЕ xMoonSale</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
            "Цифровая площадка, которая развивается вместе с тобой.\n\n" +
            "🎮 Игровые товары\n🚀 Цифровые сервисы\n✨ Новые возможности\n\n" +
            "Наша цель — создать удобную цифровую вселенную.\n\n" +
            "Спасибо, что ты с нами! 💜"
        };

        if (pages[data]) {
          await tg(env.BOT_TOKEN, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: pages[data],
            parse_mode: "HTML",
            reply_markup: BACK
          });
        }

        return new Response("OK");
      }

      // =========================
      // INCOMING MESSAGES
      // =========================

      const message = update.message;
      if (!message || !message.chat) return new Response("OK");

      const chatId = message.chat.id;
      const userId = message.from?.id;
      const text = (message.text || "").trim();

      await saveUser(env, message.from);

      if (text === "/start" || text === "/menu") {
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text: "🌌 Открываем xMoonSale...",
          reply_markup: { remove_keyboard: true }
        });
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
        await db(env).delete(`state:${chatId}`);
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text: "↩️ Действие отменено."
        });
        await sendMenu(env.BOT_TOKEN, chatId, env);
        return new Response("OK");
      }

      // Рассылка: администратор присылает текст или фото
      const state = await getJson(env, `state:${chatId}`);

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
        await saveJson(env, "broadcast:draft", draft);
        await db(env).delete(`state:${chatId}`);

        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text: "👀 <b>Предварительный просмотр рассылки:</b>",
          parse_mode: "HTML"
        });
        await broadcastPreview(env.BOT_TOKEN, chatId, draft);
        return new Response("OK");
      }

      const replyText = plain(message.reply_to_message?.text || "");

      // Получение логина Steam
      if (replyText.startsWith("🌌 xMoonSale | STEAM")) {
        const amountMatch = replyText.match(/Выбрана сумма: (\d+) ₽/);
        const amount = amountMatch ? Number(amountMatch[1]) : 0;

        if (![100, 250, 500, 1000].includes(amount)) {
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "⚠️ Не удалось определить сумму. Начни заново через /start."
          });
          return new Response("OK");
        }

        if (!/^[A-Za-z0-9_.-]{2,64}$/.test(text)) {
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "⚠️ Отправь именно логин Steam, без пароля.",
            reply_markup: {
              force_reply: true,
              input_field_placeholder: "Логин Steam"
            }
          });
          return new Response("OK");
        }

        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text:
            "🌌 xMoonSale | ПРОВЕРКА ЗАЯВКИ\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "🎮 Сервис: Steam\n" +
            "💰 Сумма: " + amount + " ₽\n" +
            "👤 Логин: " + text + "\n\n" +
            "Проверь данные перед подтверждением.\n\n" +
            "Для подтверждения ответь словом ДА.\n" +
            "Для отмены отправь /cancel.\n\n" +
            "━━━━━━━━━━━━━━━━━━",
          reply_markup: {
            force_reply: true,
            input_field_placeholder: "ДА"
          }
        });
        return new Response("OK");
      }

      // Подтверждение заявки
      if (replyText.startsWith("🌌 xMoonSale | ПРОВЕРКА ЗАЯВКИ")) {
        const amountMatch = replyText.match(/💰 Сумма: (\d+) ₽/);
        const loginMatch = replyText.match(/👤 Логин: ([^\n]+)/);

        if (text.toUpperCase() !== "ДА") {
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "⚠️ Заявка не подтверждена. Отправь /start, чтобы начать заново."
          });
          return new Response("OK");
        }

        const amount = amountMatch ? amountMatch[1] : "—";
        const login = loginMatch ? loginMatch[1] : "—";
        const orderId = "XM-" + crypto.randomUUID().slice(0, 8).toUpperCase();

        const order = {
          id: orderId,
          userId: String(userId),
          chatId: String(chatId),
          login,
          amount,
          status: "pending",
          createdAt: new Date().toISOString()
        };

        await saveJson(env, `order:${orderId}`, order);

        const adminResult = await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: env.ADMIN_CHAT_ID,
          text:
            "🌌 <b>НОВАЯ ЗАЯВКА xMoonSale</b>\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "🆔 Номер: <code>" + escapeHtml(orderId) + "</code>\n" +
            "🎮 Товар: Пополнение Steam\n" +
            "💰 Сумма: <b>" + escapeHtml(amount) + " ₽</b>\n" +
            "👤 Логин: <code>" + escapeHtml(login) + "</code>\n" +
            "👥 Telegram ID: <code>" + escapeHtml(userId) + "</code>\n\n" +
            "⏳ Статус: <b>Ожидает оплаты</b>",
          parse_mode: "HTML",
          reply_markup: KEYBOARD([
            [{ text: "💳 Оплачен", callback_data: `op_paid_${orderId}` }],
            [{ text: "✅ Выполнен", callback_data: `op_done_${orderId}` }],
            [{ text: "📦 Открыть заказ", callback_data: `order_${orderId}` }]
          ])
        });

        if (!adminResult?.ok) {
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "⚠️ Не удалось уведомить администратора. Попробуй позже."
          });
          return new Response("OK");
        }

        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text:
            "🌌 <b>xMoonSale</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
            "✅ <b>Заявка принята!</b>\n\n" +
            "🆔 Номер: <code>" + escapeHtml(orderId) + "</code>\n" +
            "🎮 Steam: <code>" + escapeHtml(login) + "</code>\n" +
            "💰 Сумма: <b>" + escapeHtml(amount) + " ₽</b>\n\n" +
            "⏳ Статус: Ожидает оплаты\n\n" +
            "⚠️ Оплата и автоматическое пополнение пока не подключены.\n\n" +
            "Спасибо, что выбираешь xMoonSale! 💜",
          parse_mode: "HTML",
          reply_markup: BACK
        });

        return new Response("OK");
      }

      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "🌌 Используй меню xMoonSale для выбора нужного раздела.",
        reply_markup: MENU
      });

      return new Response("OK");
    } catch (error) {
      return new Response("Worker error: " + String(error), { status: 500 });
    }
  }
};
