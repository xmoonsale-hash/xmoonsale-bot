
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

      const result = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "https://xmoonsale-bot.xmoonsale.workers.dev/",
            secret_token: env.WEBHOOK_SECRET,
            allowed_updates: ["message"]
          })
        }
      );

      return new Response(await result.text());
    }

    if (request.method !== "POST") {
      return new Response("🌌 xMoonSale is online!");
    }

    // Проверка Telegram
    if (
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") !==
      env.WEBHOOK_SECRET
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    const update = await request.json();
    const message = update.message;

    if (!message || !message.chat) {
      return new Response("OK");
    }

    const chatId = message.chat.id;
    const text = (message.text || "").trim();
    const command = text.split(" ")[0].toLowerCase();

    const keyboard = {
      keyboard: [
        [{ text: "🛍 Каталог товаров" }],
        [{ text: "🎮 Пополнение Steam" }],
        [{ text: "📦 Мои заказы" }],
        [
          { text: "💬 Поддержка" },
          { text: "ℹ️ О проекте" }
        ]
      ],
      resize_keyboard: true,
      is_persistent: true
    };

    let reply;
    let showKeyboard = true;

    switch (command) {
      case "/start":
      case "/menu":
      case "🛍 каталог товаров":
        reply =
          "🌌 xMoonSale — твой цифровой магазин!\n\n" +
          "Добро пожаловать в нашу экосистему.\n\n" +
          "🛍 Выбери интересующий тебя раздел ниже.";
        break;

      case "/catalog":
        reply =
          "🛍 КАТАЛОГ xMoonSale\n\n" +
          "Здесь будут собраны наши товары:\n\n" +
          "🎮 Игры и пополнения\n" +
          "💻 Программы и сервисы\n" +
          "🔑 Цифровые ключи\n" +
          "⚙️ Игровые настройки\n" +
          "🎁 Другие цифровые товары\n\n" +
          "Каталог постепенно наполняется!";
        break;

      case "🎮 пополнение steam":
      case "/steam":
        reply =
          "🎮 ПОПОЛНЕНИЕ STEAM\n\n" +
          "Добро пожаловать в раздел Steam!\n\n" +
          "Сейчас мы готовим каталог предложений.\n" +
          "Скоро здесь можно будет оформить заказ.";
        break;

      case "📦 мои заказы":
      case "/orders":
        reply =
          "📦 МОИ ЗАКАЗЫ\n\n" +
          "Раздел истории заказов готовится.\n" +
          "Здесь будут отображаться твои покупки.";
        break;

      case "💬 поддержка":
      case "/support":
        reply =
          "💬 ПОДДЕРЖКА xMoonSale\n\n" +
          "Возник вопрос или нужна помощь?\n\n" +
          "Напиши своё сообщение — мы поможем разобраться.";
        break;

      case "ℹ️ о проекте":
      case "/about":
        reply =
          "🌌 О xMoonSale\n\n" +
          "xMoonSale — развивающаяся цифровая торговая площадка.\n\n" +
          "Наша цель — объединить цифровые товары, игровые сервисы и полезные инструменты в одной экосистеме.\n\n" +
          "Добро пожаловать в нашу вселенную! 💜";
        break;

      default:
        reply =
          "🌌 Не совсем понял твой запрос.\n\n" +
          "Воспользуйся кнопками меню, чтобы выбрать нужный раздел.";
    }

    const result = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply,
          reply_markup: keyboard
        })
      }
    );

    if (!result.ok) {
      return new Response("Telegram message error", { status: 502 });
    }

    return new Response("OK");
  }
};
