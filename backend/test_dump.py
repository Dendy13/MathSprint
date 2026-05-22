import asyncio
from datetime import datetime
from models.room import Room, RoomConfig, RoomPlayer, RoomStatus
from models.question import MathOperation, Difficulty

host = RoomPlayer(uid="host", display_name="Host", rp_before=1200)
config = RoomConfig(op=MathOperation.ADD, diff=Difficulty.EASY, question_limit=10, elo_wager=25, time_limit_seconds=60)
room = Room(room_id="TEST", host_uid="host", status=RoomStatus.WAITING, config=config, players={"host": host}, question_stack=[], max_players=2, created_at=datetime.utcnow())

print(type(room.model_dump()['status']))
print(type(room.model_dump()['created_at']))
