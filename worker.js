
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Настройка Telegram Webhook
    if (request.method === "GET" && url.pathname === "/setup") {
      if (!env.WEBHOOK_SECRET || !env.BOT_TOKEN) {
        return new Response("Worker secrets are missing", {
          status: 500
        });
      }

      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }

      const result = await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: "https://xmoonsale-bot.xmoonsale.workers.dev/",
            secret_token: env.WEBHOOK_SECRET,
            allowed_updates: ["message"]
          })
        }
      );

      return new Response(await result.text(), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    // Проверка доступности Worker
    if (request.method !== "POST") {
      return new Response("🌌 xMoonSale is online!");
    }

    // Проверка секретного токена Telegram
    if (
      !env.WEBHOOK_SECRET ||
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") !==
        env.WEBHOOK_SECRET
    ) {
      return new Response("Forbidden", { status: 403 });
    }

    // Получение обновления от Telegram
    const update = await request.json();
    const message = update.message;

    if (!message || !message.chat) {
      return new Response("OK");
    }

    const chatId = message.chat.id;
    const command = (message.text || "").split(" ")[0];

    let reply;

    switch (command) {
      case "/start":
        reply =
          "🌌 Добро пожаловать в xMoonSale!\n\n" +
          "🎮 Магазин цифровых товаров\n\n" +
          "Выберите раздел:\n" +
          "/catalog — Каталог Steam\n" +
          "/orders — Мои заказы\n" +
          "/support — Поддержка\n" +
          "/about — О проекте";
        break;

      case "/catalog":
        reply =
          "🎮 ПОПОЛНЕНИЕ STEAM\n\n" +
          "Раздел находится в разработке.\n" +
          "Скоро здесь появятся предложения xMoonSale.";
        break;

      case "/orders":
        reply = "📦 История заказов пока находится в разработке.";
        break;

      case "/support":
        reply = "💬 Поддержка xMoonSale.\nОпишите свой вопрос.";
        break;

      case "/about":
        reply = "🌌 xMoonSale — цифровой магазин нового поколения.";
        break;

      default:
        reply = "Используйте /start для открытия меню.";
    }

    // Отправка ответа пользователю
    await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply
        })
      }
    );

    return new Response("OK");
  }
};
