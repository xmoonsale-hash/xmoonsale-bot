
const API = (token) => `https://api.telegram.org/bot${token}`;

async function tg(token, method, data) {
  const response = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return response.json();
}

const menu = {
  inline_keyboard: [
    [{ text: "🎮 Пополнить Steam", callback_data: "steam" }],
    [{ text: "📦 Мои заказы", callback_data: "orders" }],
    [
      { text: "💬 Поддержка", callback_data: "support" },
      { text: "ℹ️ О проекте", callback_data: "about" }
    ]
  ]
};

const back = {
  inline_keyboard: [
    [{ text: "↩️ Главное меню", callback_data: "menu" }]
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
  await tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "🌌 xMoonSale\n\n" +
      "Добро пожаловать в цифровую вселенную!\n\n" +
      "🎮 Выбери нужный раздел:",
    reply_markup: menu
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) {
      return new Response("Worker secrets are missing", { status: 500 });
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

    // Обработка нажатий кнопок
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const data = cb.data;

      await tg(env.BOT_TOKEN, "answerCallbackQuery", {
        callback_query_id: cb.id
      });

      if (data === "menu") {
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: "🌌 xMoonSale\n\nДобро пожаловать! Выбери раздел:",
          reply_markup: menu
        });
      }

      if (data === "steam") {
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text:
            "🎮 ПОПОЛНЕНИЕ STEAM\n\n" +
            "Выбери сумму пополнения:\n\n" +
            "🌌 Быстро. Удобно. Надёжно.",
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
            "🌌 xMoonSale | STEAM\n\n" +
            "Выбрана сумма: " + amount + " ₽\n\n" +
            "✍️ Отправь ответом на это сообщение свой логин Steam.\n\n" +
            "⚠️ Нужен только логин аккаунта. Никогда не отправляй пароль!",
          reply_markup: {
            force_reply: true,
            input_field_placeholder: "Твой логин Steam"
          }
        });
      }

      const pages = {
        orders:
          "📦 МОИ ЗАКАЗЫ\n\nИстория заказов пока находится в разработке.",
        support:
          "💬 ПОДДЕРЖКА\n\nНапиши нам свой вопрос. Мы поможем разобраться.",
        about:
          "🌌 О xMoonSale\n\nЦифровая площадка, которая объединяет игровые товары и полезные сервисы."
      };

      if (pages[data]) {
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: pages[data],
          reply_markup: back
        });
      }

      return new Response("OK");
    }

    // Обработка сообщений
    const message = update.message;
    if (!message || !message.chat) return new Response("OK");

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
      await sendMenu(env.BOT_TOKEN, chatId);
      return new Response("OK");
    }

    // Покупатель отвечает логином на запрос бота
    const replyText = message.reply_to_message?.text || "";

    if (replyText.startsWith("🌌 xMoonSale | STEAM")) {
      const amountMatch = replyText.match(/Выбрана сумма: (\d+) ₽/);
      const amount = amountMatch ? Number(amountMatch[1]) : 0;

      if (!/^[A-Za-z0-9_.-]{2,64}$/.test(text)) {
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text:
            "⚠️ Не удалось распознать логин.\n\n" +
            "Отправь именно логин Steam, без пароля.",
          reply_markup: {
            force_reply: true
          }
        });
        return new Response("OK");
      }

      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text:
          "🌌 xMoonSale | ПРОВЕРКА ЗАКАЗА\n\n" +
          "🎮 Пополнение Steam\n" +
          "💰 Сумма: " + amount + " ₽\n" +
          "👤 Логин: " + text + "\n\n" +
          "Проверь данные.\n\n" +
          "Для подтверждения ответь на это сообщение словом ДА.\n" +
          "Для отмены отправь /cancel.",
        reply_markup: {
          force_reply: true,
          input_field_placeholder: "ДА"
        }
      });

      return new Response("OK");
    }

    // Подтверждение предварительной заявки
    if (replyText.startsWith("🌌 xMoonSale | ПРОВЕРКА ЗАКАЗА")) {
      const amountMatch = replyText.match(/💰 Сумма: (\d+) ₽/);
      const loginMatch = replyText.match(/👤 Логин: ([^\n]+)/);

      if (text.toUpperCase() !== "ДА") {
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text: "Заказ не подтверждён. Отправь /start, чтобы начать заново."
        });
        return new Response("OK");
      }

      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text:
          "🌌 xMoonSale\n\n" +
          "✅ Данные предварительной заявки подтверждены!\n\n" +
          "🎮 Steam: " + (loginMatch ? loginMatch[1] : "—") + "\n" +
          "💰 Сумма пополнения: " +
          (amountMatch ? amountMatch[1] : "—") + " ₽\n\n" +
          "⚠️ Сейчас магазин работает в тестовом режиме.\n" +
          "Оплата и автоматическое выполнение заказа ещё не подключены.\n\n" +
          "Спасибо, что выбираешь xMoonSale! 💜",
        reply_markup: back
      });

      return new Response("OK");
    }

    await tg(env.BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: "🌌 Используй меню xMoonSale для выбора раздела.",
      reply_markup: menu
    });

    return new Response("OK");
  }
};
