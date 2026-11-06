
import os
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

TOKEN = os.getenv("BOT_TOKEN")

bot = telebot.TeleBot(TOKEN)

def main_menu():
    keyboard = InlineKeyboardMarkup(row_width=1)

    keyboard.add(
        InlineKeyboardButton("🎮 Пополнить Steam", callback_data="steam"),
        InlineKeyboardButton("📦 Мои заказы", callback_data="orders"),
        InlineKeyboardButton("💬 Поддержка", callback_data="support"),
        InlineKeyboardButton("🌌 О xMoonSale", callback_data="about")
    )

    return keyboard


@bot.message_handler(commands=["start"])
def start(message):
    bot.send_message(
        message.chat.id,
        "🌌 Добро пожаловать в xMoonSale!\n\n"
        "🎮 Магазин пополнения Steam.\n"
        "💜 Выберите нужный раздел:",
        reply_markup=main_menu()
    )


@bot.callback_query_handler(func=lambda call: True)
def callbacks(call):
    if call.data == "steam":
        text = (
            "🎮 ПОПОЛНЕНИЕ STEAM\n\n"
            "Каталог предложений скоро появится.\n"
            "Пока мы готовим магазин."
        )
    elif call.data == "orders":
        text = "📦 Здесь будут отображаться ваши заказы."
    elif call.data == "support":
        text = "💬 По вопросам заказа обратитесь в поддержку xMoonSale."
    elif call.data == "about":
        text = "🌌 xMoonSale — магазин пополнения Steam."
    else:
        text = "Неизвестный раздел."

    bot.answer_callback_query(call.id)
    bot.send_message(call.message.chat.id, text)


print("xMoonSale Bot started!")
bot.infinity_polling()
