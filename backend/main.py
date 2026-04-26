if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", port=8000, host="localhost", reload=True)
