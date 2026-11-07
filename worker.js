
const API = (token) => `https://api.telegram.org/bot${token}`;

async function tg(token, method, data) {
  const response = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  return response.json();
}

const MENU = {
  inline_keyboard: [
    [{ text: "🎮 Пополнить Steam", callback_data: "steam" }],
    [{ text: "📦 Мои заказы", callback_data: "orders" }],
    [
      { text: "💬 Поддержка", callback_data: "support" },
      { text: "✨ О проекте", callback_data: "about" }
    ]
  ]
};

const BACK = {
  inline_keyboard: [
    [{ text: "🌌 Главное меню", callback_data: "menu" }]
  ]
};

function steamMenu() {
  return {
    inline_keyboard: [
      [
        { text: "100 ₽", callback_data: "amount_100" },
        { text: "250 ₽", callback_data: "amount_250" }
      ],
      [
        { text: "500 ₽", callback_data: "amount_500" },
        { text: "1 000 ₽", callback_data: "amount_1000" }
      ],
      [{ text: "↩️ Назад", callback_data: "menu" }]
    ]
  };
}

async function sendMenu(token, chatId) {
  return tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "🌌 <b>xMoonSale</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "Добро пожаловать в цифровую вселенную! 💜\n\n" +
      "🎮 Игровые товары и сервисы\n" +
      "🚀 Удобное оформление заявок\n" +
      "✨ Новые возможности впереди\n\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "Выбери нужный раздел:",
    parse_mode: "HTML",
    reply_markup: MENU
  });
}

function plain(text) {
  return (text || "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) {
      return new Response("Worker configuration missing", {
        status: 500
      });
    }

    // Настройка Telegram Webhook
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

    const update = await request.json();

    // =========================
    // КНОПКИ
    // =========================

    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const data = cb.data || "";

      await tg(env.BOT_TOKEN, "answerCallbackQuery", {
        callback_query_id: cb.id
      });

      if (data === "menu") {
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text:
            "🌌 <b>xMoonSale</b>\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "Твоя цифровая вселенная начинается здесь 💜\n\n" +
            "Выбери нужный раздел:",
          parse_mode: "HTML",
          reply_markup: MENU
        });
      }

      if (data === "steam") {
        await tg(env.BOT_TOKEN, "editMessageText", {
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
          reply_markup: steamMenu()
        });
      }

      if (data.startsWith("amount_")) {
        const amount = Number(data.replace("amount_", ""));

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
            "⚠️ Нужен только логин аккаунта.\n" +
            "Никогда не отправляй пароль!\n\n" +
            "━━━━━━━━━━━━━━━━━━",
          reply_markup: {
            force_reply: true,
            input_field_placeholder: "Логин Steam"
          }
        });
      }

      const pages = {
        orders:
          "📦 <b>МОИ ЗАКАЗЫ</b>\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "История заказов появится здесь после подключения базы данных.\n\n" +
          "💜 xMoonSale",

        support:
          "💬 <b>ПОДДЕРЖКА</b>\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "Нужна помощь?\n\n" +
          "Напиши нам: @axg0d\n\n" +
          "Мы постараемся помочь! 💜",

        about:
          "🌌 <b>О ПРОЕКТЕ xMoonSale</b>\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "Цифровая площадка, которая развивается вместе с тобой.\n\n" +
          "🎮 Игровые товары\n" +
          "🚀 Цифровые сервисы\n" +
          "✨ Новые возможности\n\n" +
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
    // СООБЩЕНИЯ
    // =========================

    const message = update.message;

    if (!message || !message.chat) {
      return new Response("OK");
    }

    const chatId = message.chat.id;
    const text = (message.text || "").trim();

    if (text === "/start" || text === "/menu") {
      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "🌌 Открываем xMoonSale...",
        reply_markup: { remove_keyboard: true }
      });

      await sendMenu(env.BOT_TOKEN, chatId);
      return new Response("OK");
    }

    if (text === "/cancel") {
      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "↩️ Оформление отменено."
      });

      await sendMenu(env.BOT_TOKEN, chatId);
      return new Response("OK");
    }

    // ВАЖНО: Telegram передаёт текст сообщения
    // без HTML-тегов. Поэтому сравниваем обычный текст.
    const replyText = plain(message.reply_to_message?.text || "");

    // =========================
    // ПОЛУЧЕНИЕ ЛОГИНА STEAM
    // =========================

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
          text:
            "⚠️ Не удалось распознать логин.\n\n" +
            "Отправь именно логин Steam, без пароля.",
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

    // =========================
    // ПОДТВЕРЖДЕНИЕ ЗАЯВКИ
    // =========================

    if (replyText.startsWith("🌌 xMoonSale | ПРОВЕРКА ЗАЯВКИ")) {
      const amountMatch = replyText.match(/💰 Сумма: (\d+) ₽/);
      const loginMatch = replyText.match(/👤 Логин: ([^\n]+)/);

      if (text.toUpperCase() !== "ДА") {
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text:
            "⚠️ Заявка не подтверждена.\n\n" +
            "Отправь /start, чтобы начать заново."
        });
        return new Response("OK");
      }

      const amount = amountMatch ? amountMatch[1] : "—";
      const login = loginMatch ? loginMatch[1] : "—";
      const orderId = "XM-" + crypto.randomUUID().slice(0, 8).toUpperCase();

      // Уведомление администратору
      if (env.ADMIN_CHAT_ID) {
        const adminResult = await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: env.ADMIN_CHAT_ID,
          text:
            "🌌 <b>НОВАЯ ЗАЯВКА xMoonSale</b>\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "🆔 Номер: <code>" + escapeHtml(orderId) + "</code>\n" +
            "🎮 Товар: Пополнение Steam\n" +
            "💰 Сумма: <b>" + escapeHtml(amount) + " ₽</b>\n" +
            "👤 Логин: <code>" + escapeHtml(login) + "</code>\n" +
            "👥 Telegram ID: <code>" + chatId + "</code>\n\n" +
            "⏳ Статус: <b>Ожидает оплаты</b>\n\n" +
            "⚠️ Тестовая заявка. Оплата не подключена.\n" +
            "━━━━━━━━━━━━━━━━━━",
          parse_mode: "HTML"
        });

        if (!adminResult.ok) {
          await tg(env.BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text:
              "⚠️ Не удалось отправить заявку администратору.\n\n" +
              "Попробуй позже или обратись в поддержку @axg0d."
          });

          return new Response("OK");
        }
      }

      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text:
          "🌌 <b>xMoonSale</b>\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "✅ <b>Заявка подтверждена!</b>\n\n" +
          "🆔 Номер: <code>" + escapeHtml(orderId) + "</code>\n" +
          "🎮 Steam: <code>" + escapeHtml(login) + "</code>\n" +
          "💰 Сумма: <b>" + escapeHtml(amount) + " ₽</b>\n\n" +
          "⏳ Статус: Ожидает оплаты\n\n" +
          "⚠️ Магазин пока работает в тестовом режиме.\n" +
          "Оплата и автоматическое пополнение ещё не подключены.\n\n" +
          "Спасибо, что выбираешь xMoonSale! 💜",
        parse_mode: "HTML",
        reply_markup: BACK
      });

      return new Response("OK");
    }

    await tg(env.BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text:
        "🌌 Используй меню xMoonSale для выбора нужного раздела.",
      reply_markup: MENU
    });

    return new Response("OK");
  }
};
