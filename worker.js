export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("🌌 xMoonSale is online!");
    }

    const update = await request.json();
    const message = update.message;

    if (!message) return new Response("OK");

    const chatId = message.chat.id;
    const text = message.text || "";

    let reply;

    if (text === "/start") {
      reply = "🌌 Добро пожаловать в xMoonSale!\n\n" +
        "🎮 Наш магазин цифровых товаров\n\n" +
        "Выберите команду:\n" +
        "/catalog — Каталог Steam\n" +
        "/orders — Мои заказы\n" +
        "/support — Поддержка\n" +
        "/about — О проекте";
    } else if (text === "/catalog") {
      reply = "🎮 Пополнение Steam\n\nСкоро здесь появятся предложения!";
    } else if (text === "/orders") {
      reply = "📦 Раздел заказов пока настраивается.";
    } else if (text === "/support") {
      reply = "💬 Поддержка xMoonSale.\nНапишите свой вопрос.";
    } else if (text === "/about") {
      reply = "🌌 xMoonSale — цифровой магазин нового поколения.";
    } else {
      reply = "Используйте /start для открытия меню.";
    }

    await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply
        })
      }
    );

    return new Response("OK");
  }
};