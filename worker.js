
const API = (token) => `https://api.telegram.org/bot${token}`;

function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "🛍 Каталог товаров", callback_data: "catalog" }],
      [{ text: "🎮 Пополнение Steam", callback_data: "steam" }],
      [{ text: "📦 Мои заказы", callback_data: "orders" }],
      [
        { text: "💬 Поддержка", callback_data: "support" },
        { text: "ℹ️ О проекте", callback_data: "about" }
      ]
    ]
  };
}

function backMenu() {
  return {
    inline_keyboard: [
      [{ text: "↩️ Главное меню", callback_data: "menu" }]
    ]
  };
}

function page(action) {
  switch (action) {
    case "catalog":
      return {
        text:
          "🛍 КАТАЛОГ xMoonSale\n\n" +
          "Выбери интересующее направление:\n\n" +
          "🎮 Игры и пополнения\n" +
          "💻 Программы и сервисы\n" +
          "🔑 Цифровые ключи\n" +
          "⚙️ Игровые настройки\n\n" +
          "Каталог постепенно наполняется!",
        keyboard: backMenu()
      };

    case "steam":
      return {
        text:
          "🎮 ПОПОЛНЕНИЕ STEAM\n\n" +
          "Мы готовим предложения для пополнения Steam.\n\n" +
          "Скоро здесь появятся доступные варианты оформления заказа.",
        keyboard: backMenu()
      };

    case "orders":
      return {
        text:
          "📦 МОИ ЗАКАЗЫ\n\n" +
          "История покупок пока находится в разработке.\n\n" +
          "Здесь будут отображаться твои заказы.",
        keyboard: backMenu()
      };

    case "support":
      return {
        text:
          "💬 ПОДДЕРЖКА xMoonSale\n\n" +
          "Опиши свой вопрос следующим сообщением.\n\n" +
          "Мы поможем разобраться!",
        keyboard: backMenu()
      };

    case "about":
      return {
        text:
          "🌌 О ПРОЕКТЕ xMoonSale\n\n" +
          "xMoonSale — развивающаяся цифровая площадка.\n\n" +
          "Наша цель — объединить цифровые товары, игровые сервисы и полезные инструменты в одной экосистеме.\n\n" +
          "Добро пожаловать в нашу вселенную! 💜",
        keyboard: backMenu()
      };

    default:
      return {
        text:
          "🌌 xMoonSale — твой цифровой магазин!\n\n" +
          "Выбери нужный раздел:",
        keyboard: mainMenu()
      };
  }
}

async function telegram(token, method, data) {
  return fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) {
      return new Response("Worker secrets are missing", {
        status: 500
      });
    }

    // Настройка Webhook
    if (request.method === "GET" && url.pathname === "/setup") {
      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }

      const result = await telegram(env.BOT_TOKEN, "setWebhook", {
        url: "https://xmoonsale-bot.xmoonsale.workers.dev/",
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"]
      });

      return new Response(await result.text(), {
        headers: { "Content-Type": "application/json" }
      });
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

    // Нажатие Inline-кнопки
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const messageId = callback.message?.message_id;

      await telegram(env.BOT_TOKEN, "answerCallbackQuery", {
        callback_query_id: callback.id
      });

      if (!chatId || !messageId) {
        return new Response("OK");
      }

      const selected = page(callback.data);

      const result = await telegram(
        env.BOT_TOKEN,
        "editMessageText",
        {
          chat_id: chatId,
          message_id: messageId,
          text: selected.text,
          reply_markup: selected.keyboard
        }
      );

      return new Response("OK");
    }

    // Обычные сообщения
    const message = update.message;

    if (!message || !message.chat) {
      return new Response("OK");
    }

    const chatId = message.chat.id;
    const text = (message.text || "").trim();
    const command = text.split(" ")[0].toLowerCase();

    if (command === "/start" || command === "/menu") {
      // Убираем старую серую клавиатуру
      await telegram(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "🌌 Загружаем меню xMoonSale...",
        reply_markup: { remove_keyboard: true }
      });

      const menu = page("menu");

      await telegram(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: menu.text,
        reply_markup: menu.keyboard
      });

      return new Response("OK");
    }

    const commands = {
      "/catalog": "catalog",
      "/steam": "steam",
      "/orders": "orders",
      "/support": "support",
      "/about": "about"
    };

    const action = commands[command];

    if (action) {
      const selected = page(action);

      await telegram(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: selected.text,
        reply_markup: selected.keyboard
      });

      return new Response("OK");
    }

    await telegram(env.BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text:
        "🌌 Используй меню xMoonSale, чтобы выбрать нужный раздел.",
      reply_markup: mainMenu()
    });

    return new Response("OK");
  }
};
