import assert from 'assert';
import {
  LoggedInClientHandlerSource,
  NetResponseCallback,
  TSMap,
} from 'glov/common/types';
import { identity } from 'glov/common/util';
import { ChannelServer } from 'glov/server/channel_server';
import { ChannelWorker } from 'glov/server/channel_worker';
import { randAlphaNumericId } from 'glov/server/server_util';
import { UserJoinParam } from './multiplayer_worker';

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
  rooms: RoomRecord[];
};

export type RoomListRequest = {
  spectate: boolean;
};

export type RoomRequest = {
  level_idx: number;
  num_players: number;
};

export type RoomResponse = {
  room_id: string;
  player_idx: number;
};

export type RoomJoinSpecificRequest = {
  room_id: string;
  player_idx: number;
};

export type RoomRecord = {
  room_id: string;
  level_idx: number;
  players: string[];
  num_players: number;
};

type RoomRecordStorage = {
  room_id: string;
  level_idx: number;
  players: (string | null)[];
  num_players: number;
};

function toRoomRecord(a: RoomRecordStorage): RoomRecord {
  for (let ii = 0; ii < a.players.length; ++ii) {
    if (!a.players[ii]) {
      return {
        ...a,
        players: a.players.filter(identity) as string[],
      };
    }
  }
  return a as RoomRecord;
}

RoomListWorker.registerLoggedInClientHandler('list_get', function (
  this: RoomListWorker,
  src: LoggedInClientHandlerSource,
  data: RoomListRequest | null,
  resp_func: NetResponseCallback<RoomListResponse>
): void {
  let { user_id } = src;
  let rooms = this.getChannelData<TSMap<RoomRecordStorage>>('private.rooms', {});

  let my_rooms = [];
  let open_rooms = [];
  let open_count: Record<number, number> = {};
  let keys = Object.keys(rooms);
  keys.reverse();

  let include_spectate = data && data.spectate;
  let max_per_type = include_spectate ? 100 : 4;

  for (let jj = 0; jj < keys.length; ++jj) {
    let key = keys[jj];
    let entry = rooms[key]!;
    entry.room_id = key; // fix up old data
    if (entry.players.includes(user_id)) {
      my_rooms.push(entry);
    } else {
      let any_good = false;
      let num_players = 0;
      for (let ii = 0; ii < entry.players.length; ++ii) {
        let uid = entry.players[ii];
        if (uid) {
          ++num_players;
          if (!uid.startsWith('left:')) {
            any_good = true;
          }
        }
      }
      if (!any_good) {
        // clean up
        this.setChannelData(`private.rooms.${key}`, undefined);
      }
      if (any_good && (num_players < entry.num_players || include_spectate)) {
        let c = open_count[entry.level_idx] = (open_count[entry.level_idx] || 0) + 1;
        if (c < max_per_type) {
          open_rooms.push(entry);
        }
      }
    }
  }

  resp_func(null, {
    rooms: my_rooms.concat(open_rooms).map(toRoomRecord),
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
  let rooms = this.getChannelData<TSMap<RoomRecordStorage>>('private.rooms', {});

  let room_id;
  let len = 4;
  do {
    room_id = randAlphaNumericId(len);
    ++len;
  } while (rooms[room_id]);
  let roomrec: RoomRecordStorage = {
    room_id,
    level_idx: data.level_idx,
    players: [src.user_id],
    num_players: data.num_players,
  };
  this.setChannelData(`private.rooms.${room_id}`, roomrec);

  resp_func(null, {
    room_id,
    player_idx: 0,
  });
});

RoomListWorker.registerLoggedInClientHandler('room_join', function (
  this: RoomListWorker,
  src: LoggedInClientHandlerSource,
  param: string | RoomJoinSpecificRequest,
  resp_func: NetResponseCallback<RoomResponse>
): void {
  let { user_id } = src;
  assert(param);
  let room_id;
  let desired_player_idx = -1;
  if (typeof param === 'string') {
    room_id = param;
  } else {
    room_id = param.room_id;
    desired_player_idx = param.player_idx;
  }
  assert.equal(typeof room_id, 'string');
  assert.equal(typeof desired_player_idx, 'number');
  assert(room_id.match(/^[0-9A-Z]+$/));
  let room = this.getChannelData<RoomRecordStorage | null>(`private.rooms.${room_id}`, null);
  assert(room);

  for (let player_idx = 0; player_idx < room.players.length; ++player_idx) {
    if (room.players[player_idx] === `left:${user_id}`) {
      this.setChannelData(`private.rooms.${room_id}.players.${player_idx}`, user_id);
    }
    if (room.players[player_idx] === user_id) {
      return resp_func(null, {
        room_id,
        player_idx,
      });
    }
  }

  let player_idx = -1;
  for (let ii = 0; ii < room.num_players; ++ii) {
    if (!room.players[ii] && (player_idx === -1 || ii === desired_player_idx)) {
      player_idx = ii;
    }
  }
  if (player_idx === -1) {
    return resp_func('ERR_ROOM_FULL');
  }
  while (room.players.length <= player_idx) {
    room.players.push(null);
  }
  room.players[player_idx] = user_id;
  this.setChannelData(`private.rooms.${room_id}.players`, room.players);
  this.sendChannelMessage<UserJoinParam>(`multiplayer.${room_id}`, 'user_join', {
    player_idx,
    user_id: user_id,
  }, function (err) {
    if (err) {
      throw err;
    }
    resp_func(null, {
      room_id,
      player_idx,
    });
  });
});

RoomListWorker.registerLoggedInClientHandler('forget', function (
  this: RoomListWorker,
  src: LoggedInClientHandlerSource,
  room_id: string,
  resp_func: NetResponseCallback<RoomResponse>
): void {
  let { user_id } = src;
  assert(room_id);
  assert.equal(typeof room_id, 'string');
  assert(room_id.match(/^[0-9A-Z]+$/));
  let room = this.getChannelData<RoomRecordStorage | null>(`private.rooms.${room_id}`, null);
  assert(room);
  let player_idx = room.players.indexOf(user_id);
  if (player_idx === -1) {
    return resp_func('ERR_NOT_IN_ROOM');
  }
  this.setChannelData(`private.rooms.${room_id}.players.${player_idx}`, `left:${user_id}`);
  resp_func();
  // this.sendChannelMessage<UserJoinParam>(`multiplayer.${room_id}`, 'user_leave', {
  //   player_idx,
  //   user_id: src.user_id,
  // }, function (err) {
  // });
});


export function roomlistWorkerInit(channel_server: ChannelServer): void {
  channel_server.registerChannelWorker('roomlist', RoomListWorker, {
    autocreate: true,
    subid_regex: /^the$/,
  });
}
