const API = (token) => `https://api.telegram.org/bot${token}`;

async function tg(token, method, data) {
  const response = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return response.json();
}

const BRAND = "🌌 xMoonSale";

const menu = {
  inline_keyboard: [
    [{ text: "🎮  Пополнить Steam", callback_data: "steam" }],
    [{ text: "📦  Мои заказы", callback_data: "orders" }],
    [
      { text: "💬 Поддержка", callback_data: "support" },
      { text: "✨ О проекте", callback_data: "about" }
    ]
  ]
};

const back = {
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
  await tg(token, "sendMessage", {
    chat_id: chatId,
    text:
      "🌌 <b>xMoonSale</b>\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "Добро пожаловать в нашу цифровую вселенную! 💜\n\n" +
      "🎮 Игровые товары и цифровые сервисы\n" +
      "🚀 Удобное оформление заказов\n" +
      "✨ Развитие большой цифровой площадки\n\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "Выбери нужный раздел:",
    parse_mode: "HTML",
    reply_markup: menu
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

    // Кнопки меню
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
          reply_markup: menu
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
            "🚀 Оформи заявку всего за несколько шагов.\n" +
            "🔒 Пароль от аккаунта не требуется.\n\n" +
            "━━━━━━━━━━━━━━━━━━\n" +
            "💜 xMoonSale",
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
            "🌌 <b>xMoonSale | STEAM</b>\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "💰 Выбрана сумма: <b>" + amount + " ₽</b>\n\n" +
            "👤 Теперь отправь ответом на это сообщение свой логин Steam.\n\n" +
            "⚠️ Нужен только логин аккаунта.\n" +
            "<b>Никогда не отправляй пароль!</b>\n\n" +
            "━━━━━━━━━━━━━━━━━━",
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
            input_field_placeholder: "Твой логин Steam"
          }
        });
      }

      const pages = {
        orders:
          "📦 <b>МОИ ЗАКАЗЫ</b>\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "История заказов пока находится в разработке.\n\n" +
          "Скоро здесь появится управление твоими покупками 💜",

        support:
          "💬 <b>ПОДДЕРЖКА</b>\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "Возник вопрос или нужна помощь?\n\n" +
          "Напиши нам: @axg0d\n\n" +
          "Мы постараемся помочь! 💜",

        about:
          "🌌 <b>О ПРОЕКТЕ xMoonSale</b>\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "xMoonSale — цифровая площадка, которая развивается вместе с тобой.\n\n" +
          "🎮 Игровые товары\n" +
          "🚀 Цифровые сервисы\n" +
          "✨ Новые возможности впереди\n\n" +
          "Наша цель — создать удобную цифровую вселенную.\n\n" +
          "Спасибо, что ты с нами! 💜"
      };

      if (pages[data]) {
        await tg(env.BOT_TOKEN, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: pages[data],
          parse_mode: "HTML",
          reply_markup: back
        });
      }

      return new Response("OK");
    }

    // Сообщения пользователя
    const message = update.message;
    if (!message || !message.chat) {
      return new Response("OK");
    }

    const chatId = message.chat.id;
    const text = (message.text || "").trim();

    if (text === "/start" || text === "/menu") {
      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "🌌 Загружаем цифровую вселенную...",
        reply_markup: { remove_keyboard: true }
      });

      await sendMenu(env.BOT_TOKEN, chatId);
      return new Response("OK");
    }

    if (text === "/cancel") {
      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "↩️ Оформление заявки отменено."
      });
      await sendMenu(env.BOT_TOKEN, chatId);
      return new Response("OK");
    }

    const replyText = message.reply_to_message?.text || "";

    // Получение логина Steam
    if (replyText.startsWith("🌌 <b>xMoonSale | STEAM</b>")) {
      const amountMatch = replyText.match(/Выбрана сумма: <b>(\d+) ₽/);
      const amount = amountMatch ? Number(amountMatch[1]) : 0;

      if (!/^[A-Za-z0-9_.-]{2,64}$/.test(text)) {
        await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: chatId,
          text:
            "⚠️ <b>Неверный формат логина.</b>\n\n" +
            "Попробуй ещё раз. Нужен именно логин Steam, без пароля.",
          parse_mode: "HTML",
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
          "🌌 <b>xMoonSale | ПРОВЕРКА ЗАЯВКИ</b>\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "🎮 Сервис: Steam\n" +
          "💰 Сумма: <b>" + amount + " ₽</b>\n" +
          "👤 Логин: <code>" + text + "</code>\n\n" +
          "Проверь данные перед подтверждением.\n\n" +
          "Для подтверждения ответь словом <b>ДА</b>.\n" +
          "Для отмены отправь /cancel.\n\n" +
          "━━━━━━━━━━━━━━━━━━",
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
          input_field_placeholder: "ДА"
        }
      });

      return new Response("OK");
    }

    // Подтверждение заявки и уведомление администратора
    if (replyText.startsWith("🌌 <b>xMoonSale | ПРОВЕРКА ЗАЯВКИ</b>")) {
      const amountMatch = replyText.match(/💰 Сумма: <b>(\d+) ₽/);
      const loginMatch = replyText.match(/👤 Логин: <code>([^<]+)<\/code>/);

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
      const orderId =
        "XM-" + Date.now().toString().slice(-8);

      // Уведомление владельцу магазина
      if (env.ADMIN_CHAT_ID) {
        const adminResult = await tg(env.BOT_TOKEN, "sendMessage", {
          chat_id: env.ADMIN_CHAT_ID,
          text:
            "🌌 <b>НОВАЯ ЗАЯВКА xMoonSale</b>\n" +
            "━━━━━━━━━━━━━━━━━━\n\n" +
            "🆔 Номер: <code>" + orderId + "</code>\n" +
            "🎮 Товар: Пополнение Steam\n" +
            "💰 Сумма: <b>" + amount + " ₽</b>\n" +
            "👤 Логин: <code>" + login + "</code>\n" +
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
              "⚠️ Не удалось передать заявку администратору.\n\n" +
              "Попробуй позже или напиши в поддержку @axg0d."
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
          "🆔 Номер: <code>" + orderId + "</code>\n" +
          "🎮 Steam: <code>" + login + "</code>\n" +
          "💰 Сумма: <b>" + amount + " ₽</b>\n\n" +
          "⏳ Статус: Ожидает оплаты\n\n" +
          "⚠️ Магазин пока работает в тестовом режиме.\n" +
          "Оплата и автоматическое пополнение ещё не подключены.\n\n" +
          "Спасибо, что выбираешь xMoonSale! 💜",
        parse_mode: "HTML",
        reply_markup: back
      });

      return new Response("OK");
    }

    await tg(env.BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text:
        "🌌 Используй меню xMoonSale, чтобы выбрать нужный раздел.",
      reply_markup: menu
    });

    return new Response("OK");
  }
};