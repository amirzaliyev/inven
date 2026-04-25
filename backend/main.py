async def main() -> None:
    import uvicorn
    from bot.main import bot, dp

    uvicorn.run("app.main:app", port=8000, host="localhost", reload=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
