import assert from 'assert';
import {
  HandlerSource,
  LoggedInClientHandlerSource,
  NetResponseCallback,
  TSMap,
} from 'glov/common/types';
import { ChannelServer } from 'glov/server/channel_server';
import { ChannelWorker } from 'glov/server/channel_worker';
import { randAlphaNumericId } from 'glov/server/server_util';

class RoomListWorker extends ChannelWorker {
  // constructor(channel_server, channel_id, channel_data) {
  //   super(channel_server, channel_id, channel_data);
  // }
}
RoomListWorker.prototype.maintain_client_list = false;
RoomListWorker.prototype.emit_join_leave_events = false;
RoomListWorker.prototype.require_login = true;
RoomListWorker.prototype.auto_destroy = true;
RoomListWorker.prototype.require_subscribe = false;

export type RoomListResponse = {
  rooms: unknown[];
};

export type RoomRequest = {
  level_idx: number;
  num_players: number;
};

export type RoomResponse = {
  room_id: string;
  player_idx: number;
};

type RoomRecord = {
  level_idx: number;
  players: string[];
  num_players: number;
};

RoomListWorker.registerClientHandler('list_get', function (
  this: RoomListWorker,
  src: HandlerSource,
  data: unknown,
  resp_func: NetResponseCallback<RoomListResponse>
): void {
  resp_func(null, {
    rooms: [],
  });
});

RoomListWorker.registerLoggedInClientHandler('room_alloc', function (
  this: RoomListWorker,
  src: LoggedInClientHandlerSource,
  data: RoomRequest,
  resp_func: NetResponseCallback<RoomResponse>
): void {
  assert(data);
  assert.equal(typeof data.num_players, 'number');
  assert.equal(typeof data.level_idx, 'number');
  let rooms = this.getChannelData<TSMap<RoomRecord>>('rooms', {});

  let room_id;
  let len = 4;
  do {
    room_id = randAlphaNumericId(len);
    ++len;
  } while (rooms[room_id]);
  let roomrec: RoomRecord = {
    level_idx: data.level_idx,
    players: [src.user_id],
    num_players: data.num_players,
  };
  this.setChannelData(`rooms.${room_id}`, roomrec);

  resp_func(null, {
    room_id,
    player_idx: 0,
  });
});


export function roomlistWorkerInit(channel_server: ChannelServer): void {
  channel_server.registerChannelWorker('roomlist', RoomListWorker, {
    autocreate: true,
    subid_regex: /^the$/,
  });
}
