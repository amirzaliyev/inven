import asyncio
import logging
import sys
from aiogram import Bot, Dispatcher
from aiogram.types import MenuButtonWebApp, WebAppInfo
from core.config import settings

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format="%(levelname)s:     %(asctime)s - %(message)s - %(name)s",
)


async def main() -> None:
    bot = Bot(settings.bot_token)
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="Open App", web_app=WebAppInfo(url=str(settings.web_app_url))
        )
    )
    dp = Dispatcher()

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
