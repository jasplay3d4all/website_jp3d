from fastapi import FastAPI
from fastapi_socketio import SocketManager

app = FastAPI()
socket_manager = SocketManager(app=app)

# socket_handlers.py
from .app import app

@app.sio.on('join')
async def handle_join(sid, *args, **kwargs):
    await app.sio.emit('lobby', 'User joined')
