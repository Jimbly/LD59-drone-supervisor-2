import assert from 'assert';
import { Diff, diffApply } from 'glov/common/differ';
import { Packet } from 'glov/common/packet';
import { HandlerSource, LoggedInClientHandlerSource, NetResponseCallback } from 'glov/common/types';
import { logdata } from 'glov/common/util';
import { channelDataDifferCreate } from 'glov/server/channel_data_differ';
import { ChannelServer } from 'glov/server/channel_server';
import { ChannelData, ChannelWorker } from 'glov/server/channel_worker';
import { chattableWorkerInit } from 'glov/server/chattable_worker';
import type { GameStateSerialized } from '../client/main';

type ChannelDataDiffer = ReturnType<typeof channelDataDifferCreate>;

class MultiplayerWorker extends ChannelWorker {
  differ: ChannelDataDiffer;
  constructor(channel_server: ChannelServer, channel_id: string, channel_data: Partial<ChannelData>) {
    super(channel_server, channel_id, channel_data);
    this.differ = channelDataDifferCreate(this);
  }
}
MultiplayerWorker.prototype.maintain_client_list = true;
MultiplayerWorker.prototype.emit_join_leave_events = true;
MultiplayerWorker.prototype.require_login = true;
MultiplayerWorker.prototype.auto_destroy = true;

chattableWorkerInit(MultiplayerWorker);

MultiplayerWorker.registerLoggedInClientHandler('edit_op', function (
  this: MultiplayerWorker,
  src: LoggedInClientHandlerSource,
  pak: Packet,
  resp_func: NetResponseCallback
): void {
  let { user_id } = src;
  let diff: Diff = pak.readJSON() as Diff;
  this.logSrc(src, `build edit from ${user_id}:`, diff);
  let game_state = this.getChannelData('public.gs', {});
  this.differ.start();
  diffApply(game_state, diff);
  this.differ.end();
  // let param: BuildModeOp = {
  //   sub_id: this.getSubscriberId(src.channel_id) || src.channel_id,
  //   diff,
  // };
  // this.channelEmit('edit_op', param);
  // this.setChannelData('private.state', this.data.private.state);
  resp_func();
});

MultiplayerWorker.registerLoggedInClientHandler('init', function (
  this: MultiplayerWorker,
  src: LoggedInClientHandlerSource,
  data: GameStateSerialized,
  resp_func: NetResponseCallback
): void {
  let { user_id } = src;
  this.logSrc(src, `game init from ${user_id}: ${logdata(data)}`);
  let game_state = this.getChannelData<GameStateSerialized>('public.gs', null!);
  assert(!game_state || !game_state.players);
  assert(data.players);
  assert.equal(data.players[0].user_id, user_id);
  this.setChannelData('public.gs', data);
  resp_func();
});


export type UserJoinParam = {
  player_idx: number;
  user_id: string;
};

MultiplayerWorker.registerServerHandler('user_join', function (
  this: MultiplayerWorker,
  src: HandlerSource,
  data: UserJoinParam,
  resp_func: NetResponseCallback
): void {
  this.logSrc(src, `room join from ${data.user_id} at index ${data.player_idx}`);
  let game_state = this.getChannelData<GameStateSerialized>('public.gs', null!);
  assert(game_state && game_state.players.length);
  assert(!game_state.players[data.player_idx].user_id);
  this.setChannelData(`public.gs.players.${data.player_idx}.user_id`, data.user_id);
  resp_func();
});


export function multiplayerWorkerInit(channel_server: ChannelServer): void {
  channel_server.registerChannelWorker('multiplayer', MultiplayerWorker, {
    autocreate: true,
    subid_regex: /^[0-9A-Z]+$/,
  });
}
